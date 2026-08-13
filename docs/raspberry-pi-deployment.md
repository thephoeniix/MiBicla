# Despliegue en Raspberry Pi 4

Esta guía usa la topología elegida para Mi Bicla:

- Raspberry Pi OS Lite de 64 bits arrancando desde el SSD.
- MicroSD reservada para recuperación.
- PostgreSQL administrado en Neon.
- Nginx y la API en la Raspberry Pi.
- Dominio público con HTTPS.

Sustituye `mibicla.example.com`, los nombres de archivo y las credenciales de
ejemplo antes de ejecutar los comandos.

## 1. Preparar el SSD

1. Con Raspberry Pi Imager, instala Raspberry Pi OS Lite de 64 bits directamente
   en el SSD. Configura usuario, contraseña, zona horaria, hostname y SSH desde
   las opciones avanzadas del Imager.
2. Conecta el SSD a un puerto USB 3 azul de la Raspberry y usa Ethernet durante
   la instalación si es posible.
3. Arranca sin la microSD. Si un firmware antiguo no reconoce el SSD, arranca
   temporalmente desde la microSD, ejecuta `sudo rpi-eeprom-update -a`, reinicia
   y vuelve a probar el SSD.
4. Reserva una dirección IPv4 para la Raspberry desde el DHCP del router. No
   configures una IP fija duplicada dentro del sistema operativo.

Comprueba la arquitectura y el disco raíz:

```sh
uname -m
findmnt /
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS
```

`uname -m` debe responder `aarch64` y `/` debe estar en el SSD.

## 2. Instalar el sistema base

```sh
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y nginx postgresql-client certbot python3-certbot-nginx curl xz-utils ca-certificates
sudo reboot
```

Instala la versión ARM64 exacta de Node requerida por el proyecto:

```sh
cd /tmp
curl -fsSLO https://nodejs.org/dist/v20.20.2/node-v20.20.2-linux-arm64.tar.xz
curl -fsSLO https://nodejs.org/dist/v20.20.2/SHASUMS256.txt
sha256sum --ignore-missing -c SHASUMS256.txt
sudo tar -xJf node-v20.20.2-linux-arm64.tar.xz -C /usr/local --strip-components=1
node --version
npm --version
```

Las versiones esperadas son Node `v20.20.2` y npm `10.8.2`.

## 3. Preparar usuario y directorios

```sh
sudo useradd --system --home /var/lib/mibicla --create-home --shell /usr/sbin/nologin mibicla
sudo install -d -o mibicla -g mibicla /opt/mibicla/releases
sudo install -d -m 700 -o mibicla -g mibicla /var/lib/mibicla/backups /var/lib/mibicla/uploads
sudo install -d -m 700 -o root -g root /etc/mibicla
```

El código versionado vive en `/opt/mibicla`; las imágenes y respaldos viven en
`/var/lib/mibicla`, fuera de cada release.

## 4. Configurar Neon y secretos

Crea una rama de producción separada en Neon y copia su cadena de conexión con
TLS. Genera los secretos en la Raspberry:

```sh
openssl rand -base64 48
openssl rand -hex 32
```

Crea `/etc/mibicla/api.env` con permisos `0600`:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://USUARIO:CONTRASENA@HOST/BASE?sslmode=require
APP_BASE_URL=https://mibicla.example.com
API_BASE_URL=https://mibicla.example.com
ALLOWED_ORIGINS=https://mibicla.example.com
TRUST_PROXY=1
HOST=127.0.0.1
PORT=3000
UPLOAD_DIR=/var/lib/mibicla/uploads
SESSION_SECRET=<salida de openssl rand -base64 48>
APP_ENCRYPTION_KEY=<salida de openssl rand -hex 32>
```

```sh
sudo chown mibicla:mibicla /etc/mibicla/api.env
sudo chmod 600 /etc/mibicla/api.env
```

No reutilices la rama Neon de desarrollo. En producción, ejecuta el seed solo
mediante `SEED_CONFIRM=APPLY npm run db:seed:production`; es necesario para
crear roles y permisos y es seguro repetirlo porque no elimina asignaciones.

## 5. Publicar el primer release

En la computadora de desarrollo, después de `npm run verify`:

```sh
npm run release -- primera-produccion
scp releases/mibicla-primera-produccion.tar.gz* USUARIO@IP_DE_LA_RASPBERRY:/tmp/
```

En la Raspberry:

```sh
cd /tmp
sha256sum -c mibicla-primera-produccion.tar.gz.sha256
sudo -u mibicla mkdir /opt/mibicla/releases/primera-produccion
sudo -u mibicla tar -xzf mibicla-primera-produccion.tar.gz -C /opt/mibicla/releases/primera-produccion
sudo -u mibicla npm ci --prefix /opt/mibicla/releases/primera-produccion
```

Respalda y migra Neon antes de activar el release:

```sh
sudo -u mibicla sh -c 'set -a; . /etc/mibicla/api.env; set +a; /opt/mibicla/releases/primera-produccion/scripts/backup-db.sh'
sudo -u mibicla sh -c 'cd /opt/mibicla/releases/primera-produccion && set -a; . /etc/mibicla/api.env; set +a; MIGRATION_CONFIRM=APPLY npm run db:migrate:production'
sudo -u mibicla sh -c 'cd /opt/mibicla/releases/primera-produccion && set -a; . /etc/mibicla/api.env; set +a; SEED_CONFIRM=APPLY npm run db:seed:production'
```

El seed agrega de forma idempotente los roles, permisos y asignaciones que
falten. Para crear la primera cuenta, abre una terminal de root, carga el
entorno y captura la contraseña sin mostrarla:

```sh
sudo -i
set -a; . /etc/mibicla/api.env; set +a
read -r -p 'Nombre: ' OWNER_NAME
read -r -p 'Correo: ' OWNER_EMAIL
read -r -s -p 'Contraseña: ' OWNER_PASSWORD; printf '\n'
export OWNER_NAME OWNER_EMAIL OWNER_PASSWORD
export HOME=/var/lib/mibicla
runuser -u mibicla --preserve-environment -- sh -c 'cd /opt/mibicla/releases/primera-produccion && npm run db:create-owner:production'
unset OWNER_NAME OWNER_EMAIL OWNER_PASSWORD
exit
```

El script no sobrescribe una cuenta existente. Finalmente activa el release:

```sh
sudo -u mibicla ln -sfn /opt/mibicla/releases/primera-produccion /opt/mibicla/current.next
sudo -u mibicla mv -Tf /opt/mibicla/current.next /opt/mibicla/current
```

Instala y arranca el servicio:

```sh
sudo cp /opt/mibicla/current/deploy/mi-bicla-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mi-bicla-api.service
sudo systemctl status mi-bicla-api.service
curl --fail http://127.0.0.1:3000/healthz
curl --fail http://127.0.0.1:3000/readyz
```

## 6. Dominio y HTTPS

1. Crea un registro DNS `A` hacia la IPv4 pública del negocio. Solo crea `AAAA`
   si la Raspberry es accesible realmente por IPv6.
2. Reenvía TCP 80 y 443 en el router hacia la IPv4 reservada de la Raspberry.
3. Si el proveedor usa CGNAT y no permite el reenvío, detente y usa Cloudflare
   Tunnel; Certbot con puertos abiertos no funcionará.
4. Emite el primer certificado con el servidor temporal de Certbot:

```sh
sudo systemctl stop nginx
sudo certbot certonly --standalone -d mibicla.example.com
```

5. Copia la configuración, reemplaza el dominio y valida Nginx:

```sh
sudo cp /opt/mibicla/current/deploy/nginx.conf.example /etc/nginx/sites-available/mibicla
sudo nano /etc/nginx/sites-available/mibicla
sudo ln -s /etc/nginx/sites-available/mibicla /etc/nginx/sites-enabled/mibicla
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
```

Confirma HTTPS y prueba la renovación automática:

```sh
curl --fail https://mibicla.example.com/readyz
sudo certbot renew --dry-run
```

## 7. Verificación y operación

```sh
sudo journalctl -u mi-bicla-api.service -n 100 --no-pager
systemctl is-enabled mi-bicla-api.service nginx certbot.timer
df -h /
```

Prueba desde una red externa: landing, registro, aprobación, activación, login,
QR, taller y carga de una imagen de producto. Reinicia la Raspberry y repite
`/readyz` y la visualización de la imagen cargada.

Los dumps en el mismo SSD no protegen frente a una falla del SSD. Programa el
respaldo diario de PostgreSQL y copia tanto `/var/lib/mibicla/backups` como
`/var/lib/mibicla/uploads` a otro dispositivo o almacenamiento remoto cifrado.
Neon aporta recuperación administrada, pero no sustituye el respaldo de las
imágenes locales ni una prueba periódica de restauración.
