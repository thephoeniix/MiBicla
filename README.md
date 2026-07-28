# Mi Bicla Querétaro

Monorepo TypeScript para la administración de Mi Bicla Querétaro. Incluye una API Express, PostgreSQL con Drizzle y un frontend React funcional para configuración del negocio, clientes, fidelidad, bicicletas y taller.

## Requisitos

- Node.js `20.20.2`
- npm `10.8.2`
- PostgreSQL para ejecutar la aplicación y las tareas de base de datos

## Preparación

1. Copia `.env.example` a `.env` y completa los valores. `SESSION_SECRET` requiere al menos 32 caracteres.
2. Ejecuta `npm install`.
3. Ejecuta `npm run db:migrate`.
4. Ejecuta `npm run db:seed`.
5. Crea la cuenta propietaria:

   ```sh
   OWNER_NAME='...' OWNER_EMAIL='...' OWNER_PASSWORD='...' npm run db:create-owner
   ```

La contraseña del owner requiere entre 12 y 128 caracteres, minúscula, mayúscula, número y símbolo. El script es idempotente y nunca sobrescribe una cuenta existente.

## Ejecución y verificación

- Proyecto completo: `npm run dev`
- API: `npm run dev -w @mi-bicla/api-server`
- Frontend: `npm run dev -w @mi-bicla/web`
- Limpieza segura de límites vencidos: `npm run db:cleanup-rate-limits`
- Verificación completa local: `npm run verify` ejecuta typecheck, lint, pruebas
  y build.

Las pruebas de integración requieren una base PostgreSQL desechable indicada por `TEST_DATABASE_URL`; nunca debe apuntar a producción.

## Integración continua

GitHub Actions ejecuta `npm ci` y `npm run verify` en cada pull request dirigido
a `main` y en cada push a `main`. Esta primera capa de CI solo valida tipos,
lint, pruebas unitarias y build; además comprueba errores de whitespace en el
rango de commits del pull request o push. No utiliza secretos, no ejecuta
migraciones, no se conecta a Neon y no despliega.

## Variables de entorno

La aplicación utiliza `DATABASE_URL`, `NODE_ENV`, `APP_BASE_URL`, `API_BASE_URL`, `SESSION_SECRET`, `APP_ENCRYPTION_KEY`, `TRUST_PROXY`, `ALLOWED_ORIGINS` y `PORT`. Los scripts del owner usan `OWNER_NAME`, `OWNER_EMAIL` y `OWNER_PASSWORD`; las pruebas de integración usan `TEST_DATABASE_URL`. El frontend acepta `VITE_API_BASE_URL`.

## Migraciones

Las migraciones se aplican en orden y no se deben reescribir después de haber sido desplegadas:

- `0000_phase_1.sql`: autenticación, administradores, roles, permisos, sesiones, auditoría y límites de peticiones.
- `0001_business_settings.sql`: configuración general del negocio y configuración inicial de depósitos.
- `0002_multiple_deposit_options.sql`: múltiples opciones de depósito activables y ordenables.
- `0003_nullable_business_urls.sql`: URLs opcionales y anulables en Business Settings.
- `0004_phase_2.sql`: clientes, tokens públicos, saldos, movimientos, recompensas y fidelidad.
- `0005_workshop.sql`: bicicletas, solicitudes, órdenes de taller, servicios, piezas, historial, seguimiento y configuración.
- `0006_bicycle_details.sql`: frenos, suspensión, transmisión y estado general de las bicicletas.
- `0007_workshop_service_catalog.sql`: catálogo configurable de servicios de taller y relación opcional con las líneas históricas de una orden.

## Seguridad y operación

La cookie de sesión es `HttpOnly`, `Secure` en producción y `SameSite=Lax`. Las peticiones del frontend incluyen credenciales. El token de sesión aleatorio y el token CSRF se persisten en el servidor únicamente mediante SHA-256; el frontend conserva el CSRF en `sessionStorage` y lo envía como `X-CSRF-Token` en métodos mutables.

Las sesiones vencen tras 30 minutos de inactividad o 8 horas absolutas y se actualizan como máximo cada 5 minutos. Las mutaciones validan el origen, rechazan `Sec-Fetch-Site` cross-site y requieren CSRF después de autenticar. El rate limit usa ventanas UTC deterministas de 15 minutos, UPSERT atómico y claves hasheadas.

El acceso administrativo está protegido mediante RBAC y permisos específicos. Las operaciones relevantes generan auditoría, evitando guardar secretos bancarios. La aplicación utiliza baja lógica donde debe preservar referencias históricas, incluidos administradores, bicicletas y servicios de catálogo utilizados.

Cuenta, CLABE y tarjeta se cifran con AES-256-GCM. `APP_ENCRYPTION_KEY` debe contener 32 bytes en hexadecimal —64 caracteres—, mantenerse fuera del repositorio y respaldarse; perderla impide descifrar los datos. Puede generarse con `openssl rand -hex 32`.

Los servicios actualizan `updated_at` explícitamente. Los seeds agregan asignaciones faltantes sin borrar asignaciones existentes.

## Fase 1: base administrativa

La Fase 1 permanece como la base histórica del proyecto. Introdujo administradores, autenticación, sesiones seguras, RBAC, permisos, CSRF, rate limiting, auditoría y scripts operativos. Su migración inicial es `packages/db/drizzle/0000_phase_1.sql`; las funcionalidades posteriores amplían esta base y no sustituyen sus controles de seguridad.

Las rutas de autenticación existentes son:

- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`

## Business Settings

El panel administrativo permite editar información general, redes sociales y opciones de depósito. Los campos opcionales vacíos se normalizan como `null`; las actualizaciones parciales no borran secciones omitidas.

Las opciones de depósito pueden crearse, editarse, activarse, ordenarse y eliminarse. Los valores sensibles nunca se devuelven completos en respuestas administrativas: se exponen indicadores y representaciones enmascaradas. Durante una edición, los secretos vacíos se conservan; `clearAccountNumber`, `clearClabe` y `clearCardNumber` permiten borrarlos explícitamente.

Rutas:

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/settings/deposits`
- `POST /api/admin/settings/deposits`
- `PATCH /api/admin/settings/deposits/reorder`
- `GET /api/admin/settings/deposits/:id`
- `PUT /api/admin/settings/deposits/:id`
- `DELETE /api/admin/settings/deposits/:id`
- `PATCH /api/admin/settings/deposits/:id/status`
- `GET /api/public/business`
- `GET /api/public/depositos`

## Clientes y fidelidad

Los clientes tienen búsqueda administrativa, edición, baja lógica, detalle, QR público, saldos y recompensas. `birthDate` acepta exclusivamente una fecha válida en formato ISO `YYYY-MM-DD`; una cadena vacía se normaliza como `null` y no se permiten fechas futuras.

Los teléfonos mexicanos pueden capturarse con espacios, guiones o paréntesis. Se normalizan como `+52` seguido de 10 dígitos, por ejemplo `446 258 0377` se guarda como `+524462580377`. También se aceptan entradas compatibles que ya incluyan `+52` o el prefijo histórico `+52 1`.

La fidelidad usa reglas configurables cuyos importes se expresan en centavos. Los ajustes manuales requieren configuración habilitada, motivo, permiso `adjust_loyalty` y respetan `allowNegativeBalance`. Cuando se alcanza `rewardUnits`, se descuentan unidades y se crean recompensas disponibles.

Rutas:

- `GET /api/admin/customers`
- `POST /api/admin/customers`
- `GET /api/admin/customers/:id`
- `PUT /api/admin/customers/:id`
- `DELETE /api/admin/customers/:id`
- `POST /api/admin/customers/:id/token`
- `POST /api/admin/customers/:id/loyalty-adjustments`
- `GET /api/admin/settings/loyalty`
- `PUT /api/admin/settings/loyalty`
- `GET /api/public/customer/:token`

La tarjeta pública se presenta en `/c/:token`. El UUID del cliente nunca funciona como credencial pública; los tokens públicos se almacenan únicamente como SHA-256.

## Bicicletas

Las bicicletas se asocian opcionalmente con un cliente y admiten apodo, marca, modelo, año, tipo, color, rodada, identificación privada, notas y estado. Los formularios incluyen catálogos orientativos y la opción “Otro”; los DTO no limitan los valores a esos catálogos.

Los campos agregados por `0006_bicycle_details.sql` son:

- `brakeType`: tipo de frenos.
- `suspensionType`: tipo de suspensión.
- `drivetrain`: marca o sistema de transmisión; corresponde al concepto de producto `drivetrainBrand`, aunque el nombre implementado actualmente en el contrato y la base de datos es `drivetrain`.
- `generalCondition`: estado general de la bicicleta.

Los números de serie y cuadro son privados y no se muestran en el seguimiento público.

Rutas:

- `GET /api/admin/bicycles`
- `POST /api/admin/bicycles`
- `GET /api/admin/bicycles/:id`
- `PUT /api/admin/bicycles/:id`
- `DELETE /api/admin/bicycles/:id`
- `GET /api/admin/customers/:customerId/bicycles`

## Taller

El taller gestiona solicitudes públicas, órdenes, estados, piezas, servicios, avances para el cliente, notificaciones por WhatsApp y seguimiento mediante token. Al crear una orden, el administrador selecciona un cliente y una de sus bicicletas; la orden guarda el `bicycleId` y no duplica las características de la bicicleta.

El flujo ordinario de estados es `received → inspection → diagnosis → waiting_approval → approved → in_progress → quality_check → ready → delivered`. También permite `in_progress ↔ waiting_parts` y cancelación antes de la entrega. Solo el owner puede forzar una corrección extraordinaria y debe aportar un motivo.

Servicios y piezas calculan `quantity × unitPriceCents` en el servidor. Los subtotales excluyen líneas canceladas y el total nunca confía en cálculos enviados por el frontend. Las respuestas financieras requieren `view_workshop_financials`.

El seguimiento público `/taller/:token` utiliza un token aleatorio almacenado como SHA-256, responde con `noindex, nofollow` y omite serie, cuadro, datos personales, notas internas y costos. WhatsApp abre una URL `wa.me` y registra `opened`, no `sent`.

Rutas administrativas principales:

- `GET /api/admin/workshop/requests`
- `GET /api/admin/workshop/requests/:id`
- `PATCH /api/admin/workshop/requests/:id/status`
- `POST /api/admin/workshop/requests/:id/convert`
- `GET /api/admin/workshop/orders`
- `POST /api/admin/workshop/orders`
- `GET /api/admin/workshop/orders/:id`
- `GET /api/admin/workshop/orders/:id/financials`
- `PUT /api/admin/workshop/orders/:id`
- `PATCH /api/admin/workshop/orders/:id/status`
- `POST /api/admin/workshop/orders/:id/services`
- `PUT /api/admin/workshop/orders/:id/services/:lineId`
- `DELETE /api/admin/workshop/orders/:id/services/:lineId`
- `POST /api/admin/workshop/orders/:id/parts`
- `PUT /api/admin/workshop/orders/:id/parts/:lineId`
- `DELETE /api/admin/workshop/orders/:id/parts/:lineId`
- `POST /api/admin/workshop/orders/:id/updates`
- `PUT /api/admin/workshop/orders/:id/updates/:updateId`
- `DELETE /api/admin/workshop/orders/:id/updates/:updateId`
- `POST /api/admin/workshop/orders/:id/regenerate-token`
- `POST /api/admin/workshop/orders/:id/whatsapp`
- `POST /api/admin/workshop/orders/:id/mark-delivered`
- `GET /api/admin/workshop/technicians`
- `GET /api/admin/settings/workshop`
- `PUT /api/admin/settings/workshop`

Rutas públicas:

- `POST /api/public/workshop/requests`
- `GET /api/public/workshop/:token`

Las pantallas públicas correspondientes son `/taller/solicitud` y `/taller/:token`.

## Catálogo de servicios de taller

La migración `0007_workshop_service_catalog.sql` crea un catálogo configurable con estos servicios iniciales:

- Parchado de llanta
- Instalación tubeless
- Rellenado de líquido tubeless
- Bike wash
- Servicio preventivo
- Servicio completo

El catálogo no restringe los nombres a esa lista. Cada servicio permite nombre, descripción, precio sugerido en centavos, duración estimada, visibilidad para el cliente, estado activo y orden de presentación.

Cuando un servicio se agrega a una orden, la línea conserva una copia del nombre, descripción y precio aplicados en ese momento. Editar posteriormente el catálogo no modifica las órdenes históricas. Un servicio sin uso puede eliminarse físicamente; si ya está referenciado por una orden, se aplica una baja lógica para conservar la integridad histórica.

Rutas administrativas:

- `GET /api/admin/workshop/service-catalog`
- `POST /api/admin/workshop/service-catalog`
- `PUT /api/admin/workshop/service-catalog/:id`
- `DELETE /api/admin/workshop/service-catalog/:id`

La lectura requiere `view_workshop_orders`; crear, editar o eliminar requiere `manage_workshop_services`.
