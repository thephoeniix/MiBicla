# Diseño técnico: portal real del cliente (tarjeta y órdenes autenticadas)

Estado: propuesta para revisión. No existe implementación backend, contrato,
migración ni cambio de rutas todavía. Este documento no debe interpretarse
como código listo para copiar — es la base para pedir autorización antes de
tocar `artifacts/api`, `packages/api-contract` o `packages/db`.

## Por qué existe este documento

`GET /api/customer/me` (la única fuente de datos del portal autenticado hoy)
solo devuelve identidad (`id, name, phone, accountStatus`). No hay ningún
endpoint bajo sesión de cliente que devuelva saldo de fidelidad, recompensas
u órdenes. Los datos reales de tarjeta y seguimiento solo existen hoy detrás
de tokens públicos (`/api/public/customer/:token`,
`/api/public/workshop/:token`). Antes de reconectar "Mi tarjeta" y "Consultar
mi orden" a la sesión, hace falta este diseño.

## Relaciones e índices reales (confirmados, no asumidos)

```
customers (id)
  └─< customer_bicycles (customer_id, índice: bicycles_customer_idx)
        └─< workshop_orders (customer_id, bicycle_id — ambos NOT NULL)
              índices: workshop_orders_customer_idx, workshop_orders_status_idx
```

- `workshop_orders.customer_id` y `.bicycle_id` son `NOT NULL` con
  `onDelete: "restrict"` — una orden siempre pertenece a un cliente y una
  bicicleta concretos, sin estados huérfanos.
- `workshop_orders_customer_idx` ya existe — filtrar por
  `customer_id = :sessionCustomerId` no requiere ninguna migración nueva.
- El folio público ya existe: `workshop_orders.order_number` (`varchar(40)`,
  único) — es el identificador pensado para mostrarse al cliente, no el `id`
  interno (uuid).
- Los tokens públicos (`customer_public_tokens.public_token_hash`,
  `workshop_public_tokens.token_hash`) se guardan **hasheados**; el valor
  crudo nunca se persiste tras generarse. Cualquier endpoint nuevo debe
  mantener este mismo principio si en algún momento necesitara exponer un
  token (hoy no lo necesita).

## Lógica de servicio ya existente que debe reutilizarse, no duplicarse

- `CustomersService.get(customerId)` (`artifacts/api/src/services/customers.service.ts`)
  ya arma `{ balance, rewards }` para cualquier `customerId`. Lo usa hoy
  `getPublic(token)` después de resolver el `customerId` desde el token. Un
  endpoint de sesión llamaría exactamente al mismo método, resolviendo el
  `customerId` desde `res.locals.customerAuth.customer.id` en vez de un
  token. **No debe reescribirse la consulta de saldo/recompensas.**
- `WorkshopService.getOrder(id)` ya arma orden + servicios + partes +
  historial + actualizaciones. Lo usa hoy `publicOrder(token)`, que además
  filtra por `isCustomerVisible`/`customerVisible` y traduce el estado con
  `publicStatusLabels`. Ese bloque de filtrado (líneas ~756–799 de
  `workshop.service.ts`) debería extraerse a una función privada compartida
  (p. ej. `toCustomerSafeOrder(order, bike, detail, labels)`) que use tanto
  `publicOrder(token)` como el nuevo método de sesión — para no mantener dos
  copias de qué campos son visibles para el cliente.
- **No existe** ninguna función única que calcule una "próxima acción" para
  el cliente. Lo que vi en el panel admin (`Workshop.tsx`,
  `PRIMARY_TRANSITION`/`TRANSITION_LABEL`) es exclusivamente frontend y para
  uso del staff — no es reutilizable ni equivalente a algo pensado para el
  cliente. Siguiendo tu instrucción explícita, **no propongo inventar** ese
  cálculo aquí. La lista de órdenes se apoya en `publicStatus` (ya existe,
  ya tiene etiquetas en español vía `publicStatusLabels`) y en
  `customerVisibleSummary` (ya existe) — ninguno de los dos es nuevo.

## Endpoints propuestos

Todos bajo `requireCustomer` (mismo middleware que ya protege `/session` y
`/me` — cookie `mb_customer_session` + CSRF en mutaciones; estas tres rutas
son de solo lectura, así que no necesitan CSRF, igual que `GET /me` hoy).

### `GET /api/customer/loyalty`

Resuelve `customerId` exclusivamente de `res.locals.customerAuth.customer.id`.
Reutiliza `CustomersService.get(customerId)` + la consulta de
`loyaltySettings` ya existente en `getPublic`.

Respuesta (mismo shape que ya consume `CustomerCard.tsx`, sin el campo
`name` porque el portal ya lo tiene vía `/me`):

```json
{
  "balance": { "availableUnits": 4, "updatedAt": "2026-08-01T12:00:00.000Z" },
  "rewards": [
    { "id": "...", "rewardName": "...", "rewardDiscountPercent": "10", "requiredUnits": 8, "status": "available" }
  ],
  "loyaltyProgram": { "enabled": true, "rewardUnits": 8, "rewardName": "...", "rewardDescription": "..." },
  "updatedAt": "2026-08-01T12:00:00.000Z"
}
```

Si el cliente no tiene cuenta de fidelidad activa aún: 200 con
`loyaltyProgram: null` y `rewards: []` (igual que hoy hace `getPublic` para
un token válido sin programa activo) — nunca 404, porque el cliente
autenticado siempre "existe" para sí mismo.

### `GET /api/customer/orders`

Lista compacta, ordenada por fecha relevante descendente:

```json
[
  {
    "orderNumber": "OT-000123",
    "bicycle": { "nickname": "La Roja", "brand": "Trek", "model": "Marlin 7" },
    "publicStatus": "En reparación",
    "isActive": true,
    "relevantDate": "2026-08-01T12:00:00.000Z"
  }
]
```

- `orderNumber` es el identificador para navegar al detalle — nunca el `id`
  uuid interno, para no exponerlo en la URL.
- `isActive` se deriva una sola vez en el servicio a partir del `status` real
  (`delivered`/`cancelled` → histórica; cualquier otro valor del enum ya
  existente → activa). No es un campo nuevo en base de datos, es una
  proyección del estado que ya existe.
- `relevantDate`: `deliveredAt ?? readyAt ?? estimatedCompletionAt ?? createdAt`
  (el primero que exista), para que "fecha relevante" tenga un criterio único
  y documentado en vez de improvisarse en cada vista.
- Cero, una o varias órdenes: el array simplemente refleja lo que hay. La
  decisión de "abrir directo" vs. "mostrar selector" es de la vista
  (frontend), no del endpoint — el endpoint no debe intentar adivinar cuál es
  "la" orden relevante.

### `GET /api/customer/orders/:orderNumber`

Reutiliza `WorkshopService.getOrder(id)` + el mismo filtrado de
visibilidad que ya usa `publicOrder(token)`, después de resolver el pedido
así:

```sql
select * from workshop_orders
where order_number = :orderNumber and customer_id = :sessionCustomerId
limit 1
```

La pertenencia se resuelve **en la misma consulta**, no con un `SELECT` por
`orderNumber` seguido de una comparación en código — así una orden que
existe pero es de otro cliente y una que no existe producen exactamente la
misma respuesta (`404`), sin diferencia observable. Esto es lo que ya pide
la sección de seguridad: no revelar si el recurso existe para otra cuenta.

## Separación de `CustomerCard` en presentación + adaptador

Hoy `CustomerCard.tsx` mezcla la carga de datos (`loadCard`, con
`apiFetch(/api/public/customer/${token})`, polling cada 30s, `AbortController`)
con la presentación (todo el JSX de la tarjeta). Propuesta:

1. Extraer el JSX puro (todo lo que hoy está entre `if (loadState === "ready")`
   en adelante) a un componente `LoyaltyCardView` que reciba `Card` ya
   resuelto como prop — cero `fetch` dentro.
2. Dejar dos hooks/adaptadores delgados, cada uno responsable solo de *cómo*
   se obtienen los datos, no de cómo se muestran:
   - `usePublicLoyaltyCard(token)` — el `loadCard` actual, sin cambios de
     comportamiento (polling, `AbortController`, mismo manejo de error).
   - `useMyLoyaltyCard()` — mismo patrón, pero contra
     `GET /api/customer/loyalty` vía `customerFetch` (no `apiFetch`, para
     heredar `credentials:"include"` y el manejo de 401 ya existente).
3. `CustomerCard.tsx` (ruta `/c/:token`) pasa a ser un envoltorio de 5 líneas
   sobre `usePublicLoyaltyCard` + `LoyaltyCardView`. La futura vista de sesión
   sería el mismo patrón con `useMyLoyaltyCard`.

Esto es exactamente lo que pediste: no duplicar la tarjeta ni sus cálculos
(el `MAX_VISIBLE_LOYALTY_ICONS`, `progressPoints`, `earnedIconCount`, etc.
viven una sola vez en `LoyaltyCardView`).

## Pruebas de pertenencia necesarias antes de implementar

- Cliente A no puede ver `GET /api/customer/orders/:orderNumber` de una orden
  de Cliente B → 404, mismo cuerpo que un folio inexistente.
- `GET /api/customer/orders` de Cliente A nunca incluye folios de Cliente B,
  aun con cientos de órdenes de por medio (probar con `orderNumber`s
  entremezclados, no solo con dos clientes).
- Ninguno de los tres endpoints acepta ni lee `customerId`/`customer_id` de
  `query`, `body` ni `params` — solo de `res.locals.customerAuth`.
- `GET /api/customer/loyalty` sin programa de fidelidad activo → 200 con
  `loyaltyProgram: null`, nunca error.
- Los tres endpoints responden 401 igual que `/me` cuando no hay sesión, y
  ninguno acepta el token de recuperación ni `MB-XXXXXXXX` como credencial.

## Compatibilidad con componentes actuales

- `LoyaltyCardView` (extraído de `CustomerCard`) y `Stepper`/`Timeline`/
  `StatusBadge`/`statusLabel` (ya en `components/ui.tsx` y
  `components/domain.tsx`, usados hoy por `WorkshopTracking.tsx`) se
  reutilizan sin cambios visuales.
- `/taller/:token` sigue resolviendo exclusivamente por `publicOrder(token)`
  — el nuevo `myOrder` no reemplaza esa ruta ni ese método, son caminos
  paralelos que comparten el helper de formateo, no el de autenticación.

## Fuera de alcance de este documento

- Wiring de "Mi tarjeta"/"Consultar mi orden" hacia estas rutas (fase
  siguiente, ya acordada como pendiente de aprobación por separado).
- Cualquier índice o migración nueva — no hizo falta ninguna para lo descrito
  arriba, pero si el volumen de órdenes por cliente creciera mucho,
  `workshop_orders_customer_idx` ya cubre el caso de uso principal
  (`WHERE customer_id = ...`), así que no se anticipa necesidad inmediata.
