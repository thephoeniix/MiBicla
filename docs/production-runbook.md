# Operación en producción

## Topología recomendada

- Raspberry Pi 4/5 o servidor Linux de 64 bits con Node.js 20.20.2, npm 10.8.2, Nginx y PostgreSQL 16 remoto o administrado. Para Raspberry Pi 4 con SSD, consulta la [guía paso a paso](raspberry-pi-deployment.md).
- Nginx termina HTTPS, sirve `artifacts/web/dist` y reenvía `/api`, `/auth`, `/healthz` y `/readyz` a `127.0.0.1:3000`.
- systemd ejecuta `node artifacts/api/dist/index.js`, conserva logs en journald y reinicia el proceso si falla.
- Las imágenes subidas se almacenan en `UPLOAD_DIR`; en producción debe ser `/var/lib/mibicla/uploads`, fuera del release. También son persistentes PostgreSQL, los respaldos y los logs de journald.

## Instalación y release

1. Crear un usuario de sistema `mibicla`, `/opt/mibicla/releases` y `/var/lib/mibicla/backups`.
2. Generar el paquete con `npm run release -- <etiqueta>`, transferir el `.tar.gz` y su `.sha256`, y ejecutar `sha256sum -c <archivo>.sha256` en el servidor.
3. Extraer el release en un directorio nuevo, nunca sobre `current`, y ejecutar `npm ci`. El paquete ya contiene el build verificado, pero las dependencias nativas deben instalarse en la arquitectura destino.
4. Verificar `node artifacts/api/dist/index.js` con variables de producción antes de cambiar el enlace simbólico.
5. Respaldar PostgreSQL con `scripts/backup-db.sh`.
6. Cargar el entorno con `set -a; . /etc/mibicla/api.env; set +a`, revisar las migraciones pendientes y ejecutar únicamente con `MIGRATION_CONFIRM=APPLY npm run db:migrate:production`. Después, sincronizar roles y permisos con `SEED_CONFIRM=APPLY npm run db:seed:production`.
7. Cambiar atómicamente `/opt/mibicla/current` al release nuevo y reiniciar `mi-bicla-api.service`.
8. Comprobar `/healthz`, `/readyz`, landing, login y una consulta autenticada.

No ejecutar el comando de desarrollo `db:seed` en producción. El comando confirmado `db:seed:production` es idempotente, no elimina asignaciones y debe ejecutarse para incorporar roles o permisos faltantes. Las migraciones son acumulativas y nunca se editan después de publicarse.

Antes de transferir un release, `npm run test:e2e` valida localmente PostgreSQL 16, migraciones, API compilada en loopback, Nginx con HTTPS y navegación responsive. El entorno es desechable, usa `mibicla.test:8443` dentro de Chromium y no comparte contenedores ni volúmenes con `compose.local.yml`.

## Variables

Guardar `/etc/mibicla/api.env` con permisos `0600`, fuera del repositorio:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...
APP_BASE_URL=https://mibicla.example.com
API_BASE_URL=https://mibicla.example.com
ALLOWED_ORIGINS=https://mibicla.example.com
TRUST_PROXY=1
PORT=3000
HOST=127.0.0.1
UPLOAD_DIR=/var/lib/mibicla/uploads
SESSION_SECRET=<mínimo 32 caracteres aleatorios>
APP_ENCRYPTION_KEY=<64 caracteres hexadecimales>
```

La topología soportada sirve web y API desde el mismo origen. Dejar `VITE_API_BASE_URL` vacío genera llamadas relativas al mismo dominio. Nunca configurar `NODE_OPTIONS=--conditions=source` en producción.

## Dominio, TLS y cookies

1. Apuntar DNS A/AAAA al servidor.
2. Adaptar `deploy/nginx.conf.example` y emitir certificado con Certbot.
3. Confirmar redirección HTTP a HTTPS y `X-Forwarded-Proto: https`.
4. Mantener `TRUST_PROXY=1`; Express marcará las cookies `Secure`, `HttpOnly` y `SameSite=Lax` cuando `NODE_ENV=production`.
5. `ALLOWED_ORIGINS` debe enumerar exactamente los orígenes HTTPS permitidos, separados por coma y sin rutas.

## Respaldo y rollback

- Programar `scripts/backup-db.sh` antes de cada migración y diariamente mediante timer de systemd o cron. Copiar respaldos y `/var/lib/mibicla/uploads` periódicamente fuera del servidor.
- Probar restauraciones en una base aislada con `npm run test:backup`; el ensayo crea datos centinela, ejecuta el script real y valida una base restaurada independiente.
- Para un rollback solo de código, ejecutar `HEALTHCHECK_URL=https://mibicla.example.com scripts/rollback-release.sh <release-anterior>`. Si la comprobación falla, el script restaura automáticamente el enlace anterior.
- Si una migración incompatible ya fue aplicada, detener escrituras, crear una base nueva, restaurar el dump previo, actualizar `DATABASE_URL` y reiniciar. No intentar revertir SQL manualmente sobre la base activa.
- Conservar al menos dos releases y 14 días de respaldos verificados.

## Logs y monitoreo

- Consultar API: `journalctl -u mi-bicla-api.service -f`.
- Configurar rotación/persistencia de journald y alertas sobre reinicios, espacio en disco y respuestas no 200 de `/readyz`.
- `/healthz` confirma que el proceso vive; `/readyz` también comprueba PostgreSQL.
- Los logs no deben incluir cookies, tokens, contraseñas, `DATABASE_URL` ni `APP_ENCRYPTION_KEY`.

## Prueba en Raspberry o servidor definitivo

1. Confirmar arquitectura de Node y disponibilidad de `argon2` tras `npm ci`.
2. Ejecutar build y arranque compilado como el usuario `mibicla`.
3. Verificar reinicio con `systemctl restart` y apagado ordenado por SIGTERM.
4. Ejecutar el flujo real: registro, aprobación, enlace de WhatsApp, activación, login, tarjeta, bicicleta, solicitud y conversión a orden.
5. Probar móvil, tablet y escritorio con temas claro, oscuro y sistema.
6. Reiniciar el servidor y comprobar que PostgreSQL, imágenes subidas, logs y el release permanecen disponibles.
