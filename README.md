# Mi Bicla — Fase 1

Monorepo TypeScript con PostgreSQL/Drizzle, API Express y un frontend React mínimo. Esta fase cubre administración, autenticación, RBAC, sesiones, CSRF, rate limiting y auditoría.

## Preparación

1. `cp .env.example .env` y completa los valores. `SESSION_SECRET` requiere al menos 32 caracteres.
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `OWNER_NAME='...' OWNER_EMAIL='...' OWNER_PASSWORD='...' npm run db:create-owner`

El password del owner requiere 12–128 caracteres, minúscula, mayúscula, número y símbolo. El script es idempotente y nunca sobrescribe una cuenta existente.

## Ejecución

- Todo: `npm run dev`
- API: `npm run dev -w @mi-bicla/api-server`
- Web: `npm run dev -w @mi-bicla/web`
- Limpieza manual segura: `npm run db:cleanup-rate-limits` (elimina solamente filas con `expires_at < now()`).
- Verificación: `npm run typecheck && npm run lint && npm test && npm run build`

## Seguridad y operación

La cookie de sesión es HttpOnly, Secure en producción y SameSite=Lax. El token aleatorio de 32 bytes y el CSRF se guardan sólo como SHA-256. La sesión vence tras 30 minutos inactiva o 8 horas absolutas y se toca como máximo cada 5 minutos. Las mutaciones exigen Origin permitido, `Sec-Fetch-Site` no cross-site y, tras autenticar, `X-CSRF-Token`. El rate limit usa ventanas UTC deterministas de 15 minutos y un UPSERT atómico; sus claves están hasheadas.

`updated_at` se actualiza explícitamente en servicios y scripts. Los seeds agregan asignaciones faltantes pero deliberadamente no borran asignaciones existentes. La aplicación usa baja lógica (`deleted_at`) para administradores. La migración inicial es `packages/db/drizzle/0000_phase_1.sql`.

Las pruebas de integración requieren una PostgreSQL desechable indicada por `TEST_DATABASE_URL`; nunca deben apuntar a producción.

## Variables

`DATABASE_URL`, `NODE_ENV`, `APP_BASE_URL`, `API_BASE_URL`, `SESSION_SECRET`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `PORT`; para scripts del owner: `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD`; para integración: `TEST_DATABASE_URL`. El frontend acepta `VITE_API_BASE_URL`.

No se incluyen clientes, QR, puntos, compras, recompensas, taller, catálogo, promociones, eventos ni almacenamiento de imágenes: están fuera de la Fase 1.

## Business Settings

La migración `0001_business_settings.sql` agrega un registro singleton para información pública y una configuración de depósitos asociada. El panel ofrece General, Depósitos y Redes Sociales; `/depositos` sólo presenta campos activos y visibles. Cuenta, CLABE y tarjeta se cifran con AES-256-GCM y nunca se incluyen en auditoría.

La migración `0002_multiple_deposit_options.sql` conserva y renombra la configuración previa, permitiendo múltiples opciones activables y ordenables. Los secretos vacíos durante una edición se conservan; `clearAccountNumber`, `clearClabe` y `clearCardNumber` permiten borrarlos explícitamente. Las respuestas administrativas sólo incluyen indicadores y valores enmascarados.

Endpoints: `GET/PUT /api/admin/settings`; `GET/POST /api/admin/settings/deposits`; `GET/PUT/DELETE /api/admin/settings/deposits/:id`; `PATCH /api/admin/settings/deposits/:id/status`; `PATCH /api/admin/settings/deposits/reorder`; `GET /api/public/business` y `GET /api/public/depositos`. Los endpoints administrativos requieren sus permisos `view_*` o `manage_*` correspondientes.

Genera `APP_ENCRYPTION_KEY` como 32 bytes en hexadecimal (64 caracteres), consérvala fuera del repositorio y respáldala: perderla impide descifrar los datos bancarios. Ejemplo de generación: `openssl rand -hex 32`.
