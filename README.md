# Mediaudience Panel

Dashboard de métricas de campañas publicitarias por canal (CTV-OTT, Programático, Push Notification, YouTube, TikTok) para clientes de Mediaudience Latam. Cada cliente ve solo sus propios datos; el equipo interno puede ver varios clientes o todos, según su rol.

## Stack técnico

**Frontend:** React 19 + Vite + Tailwind CSS 4 + `react-router-dom` + Recharts (gráficos) + `react-simple-maps`/`d3-geo` (mapa de países).

**Backend:** Node.js + Express 5, `better-sqlite3` (base de datos embebida, sin servidor de BD aparte), `bcrypt` (passwords), `express-session` + `connect-sqlite3` (sesiones), `googleapis` (sync de Google Sheets), Resend (envío de correos transaccionales vía API REST directa, sin SDK).

**Infra:** VM en Google Cloud (`hub-mediaudience`), nginx como reverse proxy (`/api/*` → backend Node en `127.0.0.1:3001`, resto → build estático de Vite), systemd (`mediaudience-backend.service`) para mantener el backend corriendo, cron diario para sincronizar datos desde Google Sheets.

## Arquitectura

El panel **no es un sitio 100% estático**: nginx sirve el build de React para todo lo que no sea `/api/`, y el backend Express expone la data y la autenticación.

```
Google Sheets (1 por cliente+canal)
        │  scripts/syncSheets.js (cron diario, o "Sincronizar ahora" manual)
        ▼
JSON pre-calculados en src/data/... + tabla SQLite
        │
        ▼
server/dataRoutes.js  (GET /api/canal/:canal/...)
        │  filtra según el rol/cliente del usuario logueado
        ▼
Frontend (hooks/useApiData.js) → páginas de canal (KPIs, Mensual, Ciudades,
Dispositivos, Rendimiento por Campaña, Testigo, Rendimiento por Publisher)
```

### Roles (de mayor a menor privilegio)

- **Super Admin** — ve todo, único que puede gestionar otros Super Admin/Admin. Debe existir al menos uno activo siempre.
- **Admin** — gestiona Usuarios/Clientes/Servicios, ve todo sin filtro.
- **Usuario Interno** — ve solo los clientes que un Admin/Super Admin le asignó explícitamente (puede ser más de uno); opcionalmente puede tener un país asignado, que le suma acceso a todos los clientes de ese país.
- **Usuario Externo** — ve un solo cliente fijo.

Dentro de Usuario Interno/Externo, el acceso puede acotarse aún más por **anunciante** dentro de un cliente (un cliente puede agrupar varias marcas) — tabla `usuario_anunciantes`, opt-in: sin restricción explícita, el usuario ve todos los anunciantes del cliente, incluidos los que se agreguen después.

### Autenticación

Login con email/password (bcrypt) + sesión con cookie httpOnly (`express-session`, store en `server/sessions.sqlite`), 2FA por OTP en reingresos, invitación por correo al crear un usuario (contraseña temporal, se debe cambiar en el primer login).

## Estructura de carpetas

```
server/           Backend Express: rutas (authRoutes, adminRoutes, dataRoutes),
                  auth.js, db.js (esquema + migraciones SQLite), email.js,
                  middleware.js (requireUser/requireAdmin/requireSuperAdmin)
scripts/          syncSheets.js -- trae datos de Google Sheets a JSON/SQLite
src/              Frontend React: pages/ (por canal + admin/*), components/,
                  context/ (AuthContext), hooks/, data/ (JSON sincronizados)
secrets/          Credenciales sensibles (gitignored) -- cuenta de servicio
                  de Google Sheets
server/.env       Variables de entorno del backend (gitignored)
deploy.sh         Build + deploy + restart backend + commit/push a git
sync-and-deploy.sh  Corre syncSheets.js y, si sale bien, deploy.sh (cron 6am)
```

## Variables de entorno (`server/.env`, no en la raíz del proyecto)

| Variable | Uso |
|---|---|
| `SESSION_SECRET` | Firma de la cookie de sesión |
| `SESSION_COOKIE_SECURE` | `true` solo si el sitio corre bajo HTTPS real |
| `PORT` | Puerto del backend (default 3001) |
| `PANEL_URL` | Base URL usada en los correos de invitación/reset |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de correos transaccionales |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Opcional; por default usa `secrets/google-service-account.json` |

## Deploy

```
./deploy.sh
```

Hace `npm run build`, sincroniza `dist/` a `/var/www/mediaudience-panel`, reinicia `mediaudience-backend`, y **si hay cambios de código, los commitea y los sube a GitHub automáticamente** (con un chequeo defensivo que aborta el push, no el deploy, si detecta que se coló algún archivo de credenciales).

Para sincronizar datos de Sheets antes de deployar: `./sync-and-deploy.sh` (mismo cron diario a las 6am).

## Control de versiones (Git/GitHub)

Repo: `github.com/mediaudience/hub-mediaudience`.

**No hace falta hacer nada manual** — cada vez que se corre `./deploy.sh` con cambios de código pendientes, queda commiteado y subido solo. Si alguna vez hace falta guardar un cambio a mano (sin hacer un deploy completo), los 3 comandos son:

```bash
git add -A
git commit -m "Descripción corta del cambio"
git push
```
