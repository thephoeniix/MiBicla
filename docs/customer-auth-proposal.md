# Propuesta de autenticación de clientes

Estado: propuesta para revisión. No existe migración ni implementación backend.

## Separación de seguridad

La autenticación de clientes debe usar rutas, cookies, sesiones y middleware
independientes de administración. Ningún endpoint de cliente aceptará un
`customerId` enviado por el navegador para decidir el propietario de datos; el
identificador se obtendrá exclusivamente de la sesión validada.

## Tablas propuestas

### `customer_credentials`

- `id uuid primary key`
- `customer_id uuid not null unique references customers(id)`
- `phone_normalized text not null unique`
- `password_hash text not null`
- `phone_verified_at timestamptz not null`
- `password_changed_at timestamptz not null`
- `created_at`, `updated_at`

El teléfono debe normalizarse con la utilidad mexicana existente antes de
comparar o crear credenciales. La contraseña se almacenará con Argon2id y
parámetros versionados.

### `customer_sessions`

- `id uuid primary key`
- `customer_id uuid not null references customers(id)`
- `token_hash text not null unique`
- `csrf_secret_hash text not null`
- `expires_at`, `last_seen_at`, `revoked_at`, `created_at`

La cookie contendrá un token aleatorio opaco; la base sólo almacenará su hash.
Será `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en producción. La sesión
administrativa conservará otro nombre de cookie.

### `customer_otp_challenges`

- `id uuid primary key`
- `phone_normalized text not null`
- `purpose text not null`
- `code_hash text not null`
- `attempts integer not null default 0`
- `max_attempts integer not null`
- `expires_at`, `consumed_at`, `created_at`

Restricciones:

- `purpose in ('register', 'link', 'recover')`
- índice por `(phone_normalized, purpose, created_at desc)`
- índice parcial para retos no consumidos
- expiración corta y un único consumo

El código nunca se guardará ni registrará en claro.

### Bicicletas del cliente

La tabla actual de bicicletas debe auditarse antes de decidir si se extiende o
si requiere una tabla complementaria para `nickname`, `wheel_size`, `color` y
`photo_url`. Toda consulta quedará limitada por el `customer_id` de sesión.

## Vinculación con clientes existentes

1. El usuario captura teléfono y solicita un reto.
2. El proveedor entrega el código fuera de la aplicación.
3. La API verifica código, expiración, intentos y rate limit.
4. Sólo después de verificar el teléfono se busca un cliente existente por su
   teléfono normalizado.
5. Si existe y no tiene credencial, se vincula.
6. Si ya tiene credencial, se dirige a inicio de sesión o recuperación.
7. Si no existe, se crea el cliente y su credencial en una transacción.
8. Se crea una sesión y se redirige a `/mi`.

Nunca se vincula una cuenta únicamente porque el teléfono capturado coincide.

## Proveedor OTP

Definir una interfaz:

```ts
interface CustomerOtpProvider {
  send(input: {
    destination: string;
    purpose: "register" | "link" | "recover";
    code: string;
  }): Promise<{ status: "accepted" | "development"; providerReference?: string }>;
}
```

El adaptador de desarrollo no simulará un envío real. Expondrá el estado
`development` únicamente en entornos no productivos y entregará el código por
un canal local explícito que no escriba teléfono ni código en logs.

## API propuesta

- `POST /api/customer/auth/register/start`
- `POST /api/customer/auth/register/verify`
- `POST /api/customer/auth/login`
- `POST /api/customer/auth/recovery/start`
- `POST /api/customer/auth/recovery/verify`
- `POST /api/customer/auth/logout`
- `GET /api/customer/session`
- `GET /api/customer/dashboard`
- `GET /api/customer/loyalty`
- `GET /api/customer/workshop`
- `GET|POST|PATCH /api/customer/bicycles`

Las mutaciones exigirán CSRF, sesión de cliente y rate limiting. Los mensajes
de autenticación no revelarán si un teléfono está registrado.

## Riesgos

- Vinculación incorrecta por teléfonos históricos sin normalizar.
- Enumeración de cuentas mediante mensajes o tiempos de respuesta.
- Reutilización o fuerza bruta de OTP.
- Confusión entre cookies administrativas y de clientes.
- Órdenes o bicicletas expuestas por confiar en IDs del navegador.
- Dependencia de entrega y costos del proveedor de mensajería.

## Rollback

La migración futura debe ser aditiva. El rollback deshabilitará endpoints y
cookies de cliente, revocará sesiones y eliminará primero las tablas nuevas que
no contengan datos operativos preexistentes. No se alterarán ni eliminarán
clientes, órdenes, depósitos o credenciales administrativas existentes.

Antes de escribir o ejecutar la migración se requiere confirmar esta propuesta,
el proveedor OTP, la política de expiración y la estrategia de normalización de
teléfonos existentes.

