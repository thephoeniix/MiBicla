# Mi Bicla Querétaro: estado del proyecto y plan recomendado

> Revisión realizada el 28 de julio de 2026 sobre la rama `main`, incluyendo el
> README, la estructura del monorepo, los scripts, el código principal, las
> pruebas y los commits recientes.

## Resumen ejecutivo

Mi Bicla es una aplicación TypeScript para operar una tienda/taller de
bicicletas. Ya cuenta con una base funcional considerable:

- panel administrativo con autenticación, sesiones, roles y permisos;
- configuración del negocio, redes sociales y métodos de depósito;
- gestión de clientes, bicicletas y fidelidad;
- solicitudes y órdenes de taller, servicios, piezas, estados y seguimiento;
- páginas públicas para el negocio, depósitos, tarjeta de fidelidad y taller;
- API Express, PostgreSQL con Drizzle, contratos Zod y frontend React/Vite;
- 8 migraciones de base de datos y 93 pruebas unitarias que actualmente pasan.

El proyecto se encuentra en una etapa de **MVP avanzado / preproducción**. La
funcionalidad principal está modelada y buena parte está implementada, pero aún
faltan piezas operativas para llamarlo listo para producción: pruebas de
integración y end-to-end, CI/CD, despliegue documentado, observabilidad,
respaldos, recuperación, optimización de recursos y completar el portal real de
clientes que en los commits finales aparece como una demostración visual.

## Estado del repositorio

- Rama revisada: `main`.
- Estado al comenzar la revisión: limpio.
- Diferencia con remoto: `main` está **2 commits adelante de `origin/main`**.
- Commits locales aún no reflejados en `origin/main`:
  - `8889144` — `ui changes cool`
  - `f65acad` — `ya quedo`
- No se encontró configuración de GitHub Actions, otro proveedor de CI,
  Docker, Vercel ni un manifiesto de despliegue.
- `.env` está correctamente ignorado y no está versionado.
- Los directorios `dist` están ignorados, aunque existen localmente como
  resultado de builds.

Antes de abrir trabajo nuevo conviene publicar o respaldar los dos commits
locales y reemplazar los mensajes genéricos de futuros commits por mensajes que
expliquen intención y alcance.

## Arquitectura actual

```text
Navegador
  └─ React 19 + Vite
       ├─ sitio público
       ├─ panel administrativo
       └─ vistas demostrativas del portal de clientes
            │ fetch + cookies + CSRF
            ▼
       Express 5 API
            ├─ autenticación / RBAC / auditoría
            ├─ rutas administrativas
            ├─ rutas públicas
            └─ servicios de dominio
                 │ Drizzle ORM
                 ▼
             PostgreSQL
```

El monorepo usa npm workspaces:

| Componente | Responsabilidad |
|---|---|
| `artifacts/web` | Frontend React/Vite y estilos |
| `artifacts/api` | Servidor Express, middleware, rutas y servicios |
| `packages/api-contract` | DTO y validación compartida con Zod |
| `packages/db` | Esquema Drizzle, migraciones y scripts operativos |
| `packages/shared` | Entorno, seguridad, criptografía y constantes |
| `tests/unit` | Pruebas unitarias y de contratos |
| `docs` | Propuestas y documentación técnica |

La separación general es adecuada para el tamaño actual: contratos, persistencia
y utilidades no están mezclados directamente con las interfaces.

## Qué tiene implementado

### Base administrativa y seguridad

- Login, consulta de sesión y logout.
- Cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Sesiones con vencimiento por inactividad y vencimiento absoluto.
- Token CSRF y validación de origen para mutaciones.
- Rate limit de login, bloqueo temporal de cuenta y hash de claves sensibles.
- RBAC con roles y permisos.
- Auditoría de operaciones.
- Cifrado AES-256-GCM para datos bancarios.
- Scripts para migrar, sembrar roles/permisos, crear owner y limpiar rate limits.

### Configuración del negocio

- Información general y redes sociales.
- Múltiples opciones de depósito, orden, activación y baja.
- Enmascarado de datos sensibles y conservación explícita de secretos durante
  ediciones parciales.
- Página pública de depósitos.
- Selector y persistencia de tema visual.

### Clientes, bicicletas y fidelidad

- Alta, búsqueda, detalle, edición y baja lógica de clientes.
- Normalización de teléfono mexicano y validación de fecha de nacimiento.
- Bicicletas asociables a cliente con datos técnicos y estado.
- Tokens públicos hasheados para consultar tarjeta de fidelidad.
- Saldo, movimientos, recompensas y ajustes manuales con permisos.
- Escáner QR desde el panel.

### Taller

- Solicitudes públicas.
- Conversión de solicitud a orden.
- Flujo de estados y transiciones controladas.
- Servicios, piezas, precios, subtotales y totales calculados en servidor.
- Catálogo editable de servicios con preservación histórica.
- Actualizaciones visibles para cliente y notas internas separadas.
- Token privado de seguimiento público.
- Apertura de WhatsApp y registro de la acción.
- Restricción de información personal y financiera en respuestas públicas.

### Experiencia pública

- Inicio, taller, fidelidad, marcas y depósitos.
- Solicitud y seguimiento de taller.
- Tarjeta pública del cliente.
- Metadatos básicos por ruta y `noindex, nofollow` en páginas privadas por token.
- Diseño de marca, navegación pública y componentes responsivos.

## Qué dicen los commits recientes

La evolución reconstruida es:

1. `8767e06` estableció la Fase 1: autenticación, base de datos y seguridad.
2. `a59da66` y `90ae3bf` añadieron configuración del negocio y depósitos.
3. `670913d` incorporó el salto funcional mayor: clientes, fidelidad,
   bicicletas, taller, contratos, servicios y migraciones.
4. `458391b` reforzó la interfaz administrativa, el escáner QR y el sistema de
   diseño.
5. `91696dd` rediseñó fidelidad y depósitos con prioridad móvil.
6. `168c1f3` añadió temas y refinó navegación y configuración.
7. `8889144` amplió el sitio público, rutas, branding y agregó la propuesta del
   portal/autenticación de clientes.
8. `f65acad` ajustó y cerró visualmente navegación, taller, branding y páginas
   públicas.

Los dos últimos commits son principalmente de frontend. No agregan la
autenticación real del cliente: las rutas `/cuenta/*` y `/mi/*` renderizan
componentes llamados `Preview`, sus metadatos las describen como “vista previa”
o “vista demostrativa”, y la implementación futura está documentada en
`docs/customer-auth-proposal.md`.

También hay una diferencia entre el alcance del README y la UI comercial: la
página pública del taller usa una lista estática y declara que se conectará al
catálogo público en una fase posterior; la página de marcas no tiene todavía un
catálogo real.

## Pipeline actual

### Flujo de desarrollo

```text
Configurar .env
  → npm install
  → npm run db:migrate
  → npm run db:seed
  → npm run db:create-owner
  → npm run dev
```

`npm run dev` levanta API y web en paralelo. Por defecto:

- web: `http://localhost:5173`;
- API: `http://localhost:3000`;
- persistencia: PostgreSQL mediante `DATABASE_URL`.

### Flujo de una petición

```text
UI → apiFetch → Express
   → CORS / JSON / cookies / request ID / origen-CSRF
   → autenticación y permisos cuando aplica
   → validación Zod
   → servicio de dominio
   → transacción o consulta Drizzle
   → PostgreSQL
   → respuesta JSON normalizada
   → actualización de UI
```

Las operaciones relevantes agregan auditoría y las consultas públicas por token
comparan hashes en lugar de almacenar la credencial pública en claro.

### Verificación disponible

El README define esta compuerta manual:

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

Resultado de esta revisión:

| Verificación | Resultado |
|---|---|
| TypeScript en los 5 workspaces | Pasa |
| ESLint sin advertencias | Pasa |
| Pruebas | 14 archivos, 93 pruebas, todas pasan |
| Build de paquetes, API y web | Pasa |
| Migraciones contra PostgreSQL real | No verificado en esta revisión |
| Pruebas de integración | No existen actualmente en `tests/integration` |
| Pruebas end-to-end | No existen actualmente |

Por tanto, hoy existe un **pipeline local manual**, pero no un pipeline de
integración y entrega continua. Un push no tiene una comprobación automática
visible que impida integrar código roto ni un proceso documentado que despliegue
web, API y migraciones.

## Lo que falta o representa riesgo

### Prioridad alta: antes de producción

1. **Automatizar CI.** Ejecutar instalación reproducible, typecheck, lint,
   unit tests y build en cada pull request y push a `main`.
2. **Agregar pruebas de integración con PostgreSQL desechable.** El README
   menciona `TEST_DATABASE_URL`, pero no hay suite de integración. Deben cubrir
   autenticación, permisos, migraciones, depósitos cifrados, clientes,
   fidelidad, taller y concurrencia/transacciones.
3. **Agregar pruebas end-to-end.** Como mínimo: login administrativo, CRUD de
   cliente/bicicleta, solicitud pública, conversión a orden, cambio de estados,
   consulta por token, depósitos y fidelidad.
4. **Definir despliegue.** Elegir hosting para web/API y PostgreSQL, documentar
   variables, migraciones, rollback y promoción entre staging y producción.
5. **Definir respaldos y recuperación.** Frecuencia de backup, retención,
   restauración probada y custodia de `APP_ENCRYPTION_KEY`.
6. **Completar o retirar temporalmente el portal de clientes.** Las pantallas
   actuales son demos. Si quedan expuestas, deben etiquetarse inequívocamente;
   si forman parte del lanzamiento, hay que implementar la propuesta de
   autenticación, sesiones, verificación y recuperación.

### Prioridad media: estabilidad y operación

1. **Observabilidad:** logs estructurados, captura de errores, métricas de salud,
   latencia, errores 4xx/5xx y alertas.
2. **Health checks:** endpoints de vida y disponibilidad de dependencias.
3. **Cobertura medible:** umbrales de cobertura y reporte en CI; 93 pruebas
   verdes no garantizan cobertura suficiente de servicios extensos.
4. **Documentación de API:** OpenAPI o documentación equivalente generada desde
   los contratos para evitar divergencia con el README.
5. **Separar el bootstrap de la API.** `artifacts/api/src/index.ts` concentra
   configuración, middleware, autenticación y arranque. Una fábrica de
   aplicación facilitaría integración, pruebas y ejecución serverless.
6. **Router real en frontend.** La navegación depende de
   `window.location.pathname` y condicionales manuales. Un router declarativo
   simplificaría rutas anidadas, estados 404, guards y pruebas.
7. **Revisar consistencia de auditoría.** La función general de auditoría
   asigna un `entityType` específico de depósito cuando recibe cualquier
   `entityId`; conviene hacer el tipo explícito por operación.
8. **Tareas programadas:** automatizar la limpieza de rate limits y cualquier
   mantenimiento futuro.

### Prioridad media/baja: producto y rendimiento

1. **Conectar contenido público a datos reales:** catálogo público de taller y
   catálogo de marcas.
2. **Optimizar imágenes:** el build incluye recursos individuales de
   aproximadamente 0.9 MB, 1.17 MB, 2.66 MB y 3.0 MB, además de un SVG de
   ~254 kB. Conviene generar AVIF/WebP, tamaños responsivos y carga diferida.
3. **Reducir JavaScript inicial:** el build genera bundles de aproximadamente
   369 kB y 416 kB antes de gzip. Separar rutas con carga diferida evitaría
   enviar el panel administrativo y el sitio público juntos.
4. **Accesibilidad y navegadores reales:** auditorías con teclado, lector de
   pantalla, contraste, cámara/QR y móviles físicos.
5. **SEO técnico:** sitemap, canonical, datos estructurados y política clara
   para rutas públicas/indexables.
6. **PWA o experiencia sin conexión:** solo si aporta valor operativo en taller;
   no debería preceder estabilidad, pruebas y despliegue.

## Evaluación del README

El README es útil y sorprendentemente completo en dominio, rutas, seguridad y
migraciones. Permite entender qué se intentó construir. Sus principales
carencias son:

- no explica la estructura de carpetas ni las dependencias entre workspaces;
- no distingue claramente “implementado” de “preview/propuesta” para el portal
  de clientes;
- menciona pruebas de integración que no están presentes;
- no incluye CI/CD, staging, producción, rollback, backups ni monitoreo;
- no documenta requisitos mínimos de Node/npm/PostgreSQL;
- no incluye solución de problemas comunes ni datos de ejemplo;
- no contiene una matriz de estado por módulo o roadmap.

Conviene mantener el README como guía breve de incorporación y mover el detalle
de arquitectura, API, operación y roadmap a documentos separados.

## Cómo deberíamos proceder

### Etapa 0 — Proteger el estado actual

Duración sugerida: 0.5–1 día.

- Confirmar que los dos commits locales deben publicarse y hacer push.
- Crear una etiqueta o release interna del estado actual.
- Registrar versiones soportadas de Node, npm y PostgreSQL.
- Convertir la compuerta local en un solo script `npm run verify`.

**Salida:** una base reproducible y respaldada.

### Etapa 1 — CI e integración real

Duración sugerida: 2–4 días.

- Crear CI para `npm ci`, typecheck, lint, unit tests y build.
- Levantar PostgreSQL desechable en CI.
- Ejecutar todas las migraciones desde cero.
- Implementar pruebas de integración de los flujos críticos.
- Agregar cobertura y artefactos de diagnóstico.

**Criterio de salida:** ningún cambio entra a `main` sin verificaciones verdes y
las migraciones se prueban automáticamente desde una base vacía.

### Etapa 2 — Decisión y cierre del MVP

Duración sugerida: 1 día de definición y 1–3 semanas de implementación,
dependiendo de la decisión.

Tomar una decisión explícita:

- **MVP operativo interno:** lanzar panel, taller, depósitos y tarjetas por
  token; ocultar las rutas demo de cuenta del cliente.
- **MVP con portal de clientes:** implementar
  `docs/customer-auth-proposal.md`, incluyendo verificación, sesiones,
  recuperación, aislamiento de permisos y pruebas de seguridad.

La primera opción reduce mucho el tiempo y riesgo de lanzamiento. La segunda
entrega una experiencia de producto más completa, pero añade un segundo sistema
de identidad y una superficie de seguridad relevante.

### Etapa 3 — Staging y calidad end-to-end

Duración sugerida: 3–5 días.

- Crear entorno staging con datos ficticios.
- Automatizar E2E de los recorridos críticos.
- Probar QR/cámara, WhatsApp, responsive, accesibilidad y navegadores.
- Optimizar imágenes y dividir bundles por ruta.
- Validar permisos con una matriz owner/administrador/técnico.

**Criterio de salida:** un usuario puede completar los recorridos principales en
staging y los fallos relevantes son observables.

### Etapa 4 — Producción operable

Duración sugerida: 2–4 días más seguimiento.

- Despliegue versionado de web y API.
- Migraciones controladas antes de promover la aplicación.
- Logs, errores, métricas, health checks y alertas.
- Backups automáticos y simulación de restauración.
- Runbook de incidente y rollback.
- Revisión final de secretos, CORS, proxy, cookies y dominio.

**Criterio de salida:** el sistema no solo despliega; también puede monitorearse,
respaldarse y recuperarse.

## Próximo sprint recomendado

El siguiente sprint debería concentrarse en confiabilidad, no en añadir más
pantallas:

1. publicar los dos commits locales;
2. agregar `verify` y CI;
3. crear PostgreSQL de pruebas y validar migraciones;
4. cubrir con integración login/permisos, clientes, depósitos y taller;
5. decidir si el portal de clientes se implementa o se oculta para el MVP;
6. preparar staging;
7. agregar dos o tres E2E críticos;
8. optimizar los recursos más pesados.

Al terminar ese sprint se podrá estimar un lanzamiento con evidencia, en vez de
basarse únicamente en que la interfaz y las pruebas unitarias funcionan.

## Conclusión

La base técnica y el modelado de negocio son buenos para el tiempo de evolución
que muestran los commits. El mayor trabajo funcional ya no parece ser “crear el
sistema desde cero”, sino convertir un MVP avanzado en un producto operable y
verificable. La prioridad correcta es cerrar la brecha entre código funcional y
producción: automatización, base de datos real en pruebas, recorridos E2E,
despliegue, monitoreo y una decisión clara sobre el portal de clientes.
