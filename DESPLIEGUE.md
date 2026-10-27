# Despliegue y operación — Gosén

Guía para publicar la aplicación y mantenerla. Arquitectura de referencia (todo en planes gratuitos):

```
GitHub (código)  →  Vercel (la aplicación)  →  Aiven (MySQL gestionado, TLS)
```

Cualquier hosting con Node 22 y cualquier MySQL 8 sirven; solo cambian dónde se ponen las variables.

---

## 1. Variables de entorno

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `SECRETO_SESION` | **Sí** | Cadena aleatoria de 32+ caracteres que firma las sesiones. **Sin ella, en producción nadie puede iniciar sesión** (a propósito: el secreto de ejemplo es público). |
| `DB_HOST`, `DB_PUERTO` | Sí | Dirección y puerto de MySQL. |
| `DB_USUARIO`, `DB_CONTRASENA` | Sí | Cuenta de la aplicación. |
| `DB_NOMBRE` | Sí | Nombre de la base (`defaultdb` en Aiven). |
| `DB_SSL` | Si la base es remota | `true` cifra la conexión (Aiven y similares la exigen). |
| `DB_CONEXIONES` | Recomendada en Vercel | `3`. Cada instancia abre su propio pool y las bases gratuitas tienen pocas conexiones. |

Genera el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Las variables **nunca** van en Git (`.env*` está ignorado salvo `.env.example`).

---

## 2. Primer despliegue

### 2.1 Base de datos (Aiven)

1. Crea un servicio **MySQL** (plan gratuito) y copia host, puerto, usuario, contraseña y nombre de base.
2. En tu terminal define las variables (PowerShell) y crea el esquema **con un administrador propio**, sin datos de prueba:

```powershell
$env:DB_REMOTA = "true"; $env:DB_SSL = "true"
$env:DB_HOST = "…aivencloud.com"; $env:DB_PUERTO = "20335"
$env:DB_USUARIO = "avnadmin"; $env:DB_CONTRASENA = "…"; $env:DB_NOMBRE = "defaultdb"
$env:ADMIN_EMAIL = "tu@correo.com"; $env:ADMIN_CONTRASENA = "una contraseña larga con números 2026"
npm.cmd run db:setup
```

> ⚠️ **Sin `ADMIN_CONTRASENA`, `db:setup` siembra datos de prueba con cuentas de contraseña conocida**
> (`admin@gosen.local` / `Admin1234!`…). Eso es solo para desarrollo: en una base pública cualquiera podría entrar.
> Si ya lo hiciste, entra y cambia (o desactiva) esas 6 cuentas en **Usuarios** de inmediato.

3. `db:setup` **borra todo** lo que haya en esa base. Para una base que ya tiene datos reales, usa en su lugar
   `npm run db:migrar-todo` (con las mismas variables): crea lo que falte y no toca los datos.

### 2.2 Aplicación (Vercel)

1. Sube el repositorio a GitHub e impórtalo en Vercel (Framework: Next.js; no cambies el comando de build).
2. En **Settings → Environment Variables** carga las de la tabla anterior (`SECRETO_SESION`, `DB_*`, `DB_SSL=true`, `DB_CONEXIONES=3`).
3. Despliega y abre `https://tu-app.vercel.app/api/salud`: debe responder `200` con `{"estado":"ok", …}`.
4. Entra con el administrador que creaste.

---

## 3. Cada vez que cambie el esquema

Las funciones nuevas que añaden tablas o columnas traen su migración. Después de desplegar el código nuevo:

```powershell
# con las variables de la sección 2.1 definidas
npm.cmd run db:migrar-todo
```

Es seguro repetirlo: cada migración se salta lo que ya está hecho y ninguna borra datos.
Hazlo **antes** de que los usuarios usen la versión nueva; si olvidas una, la pantalla afectada falla
(el inicio de sesión sigue funcionando, solo sin el límite de intentos hasta que exista su tabla).

---

## 4. Respaldos

```powershell
npm.cmd run db:respaldar                       # → respaldos/<base>-<fecha>.sql
npm.cmd run db:restaurar -- respaldos/archivo.sql --confirmar
```

- Funciona con cualquier MySQL (no necesita `mysqldump`) y con TLS (`DB_SSL=true`).
- El archivo trae **datos personales** (nombres, teléfonos, ubicaciones, correos y hashes de contraseñas):
  guárdalo en un lugar privado. `respaldos/` está en `.gitignore`; no lo subas a Git ni lo mandes por chat.
- **Cuándo**: antes de cada migración o cambio grande, y al menos una vez por semana si hay uso real.
  Los planes gratuitos de las bases gestionadas normalmente **no** incluyen respaldos automáticos.
- `db:restaurar` **reemplaza** lo que haya en la base y exige `--confirmar`. Prueba tu respaldo restaurándolo en una
  base vacía de vez en cuando: un respaldo que nunca se probó no es un respaldo.

---

## 5. Monitoreo

- **`/api/salud`** (pública, sin detalles): `200` si la app y la base responden; `503` si la base no contesta o la
  configuración es insegura (por ejemplo, falta `SECRETO_SESION`). Conéctala a un monitor gratuito (UptimeRobot,
  Better Stack…) con aviso por correo.
- **Registro de errores**: cada error del servidor sale como **una línea JSON** (`nivel`, `mensaje`, `ruta`, `digest`…).
  En Vercel: *Logs*. La pantalla de error le muestra a la persona un **«Código del error»**: es el `digest`; búscalo en el registro.
- Nunca se registran cuerpos de petición, cookies ni encabezados.

---

## 6. Lista de seguridad antes de abrirla a otras personas

- [ ] `SECRETO_SESION` propio, de 32+ caracteres, solo en las variables del hosting.
- [ ] La contraseña de la base **no** ha salido de tu máquina ni del panel del proveedor
      (si la pegaste en un chat o un archivo, **rótala** en el panel del proveedor y actualiza Vercel).
- [ ] No existen cuentas de la siembra de desarrollo (`@gosen.local`) con contraseña conocida.
- [ ] Cada persona tiene su propia cuenta con el rol más bajo que le sirva (Roles → alcance y permisos).
- [ ] `https://…/api/salud` responde `ok`.
- [ ] Hiciste un respaldo y sabes restaurarlo.

Lo que la aplicación ya hace por ti: sesiones firmadas y caducan a los 7 días · cookie `httpOnly`, `secure`, `sameSite` ·
límite de **5 intentos fallidos por correo** (y 30 por IP) cada 15 minutos · contraseñas con scrypt y un tiempo de respuesta
igual exista o no el correo · cabeceras `Content-Security-Policy`, `X-Frame-Options: DENY`, HSTS y `nosniff` ·
permisos comprobados en el servidor y el alcance de cada rol dentro del SQL.

Lo que **no** hace: las sesiones ya emitidas siguen válidas hasta caducar aunque cambies la contraseña de esa cuenta
(desactivar la cuenta sí las corta al instante); no hay doble factor de autenticación.
