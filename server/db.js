import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data.sqlite')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migración del modelo de roles admin/cliente -> super_admin/admin/usuario_interno/usuario_externo.
// SQLite no permite alterar un CHECK existente, así que si `users` ya existe con el esquema viejo
// se reconstruye copiando los datos (cliente -> usuario_externo; el admin sembrado con el email de
// Super Admin pasa a super_admin) antes de recrearla con el CHECK nuevo.
const usersTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
if (usersTable && !usersTable.sql.includes('super_admin')) {
  db.exec(`
    ALTER TABLE users RENAME TO users_pre_roles_migration;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('super_admin', 'admin', 'usuario_interno', 'usuario_externo')),
      cliente_id INTEGER REFERENCES clientes(id),
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ultimo_login TEXT,
      CHECK (
        (rol IN ('super_admin', 'admin', 'usuario_interno') AND cliente_id IS NULL) OR
        (rol = 'usuario_externo' AND cliente_id IS NOT NULL)
      )
    );

    INSERT INTO users (id, email, password_hash, nombre, rol, cliente_id, activo, created_at, ultimo_login)
    SELECT
      id, email, password_hash, nombre,
      CASE
        WHEN rol = 'admin' AND email = 'jose@mediaudience.com' THEN 'super_admin'
        WHEN rol = 'cliente' THEN 'usuario_externo'
        ELSE rol
      END,
      cliente_id, activo, created_at, ultimo_login
    FROM users_pre_roles_migration;

    DROP TABLE users_pre_roles_migration;
  `)
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('super_admin', 'admin', 'usuario_interno', 'usuario_externo')),
    cliente_id INTEGER REFERENCES clientes(id),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_login TEXT,
    CHECK (
      (rol IN ('super_admin', 'admin', 'usuario_interno') AND cliente_id IS NULL) OR
      (rol = 'usuario_externo' AND cliente_id IS NOT NULL)
    )
  );

  CREATE TABLE IF NOT EXISTS cliente_anunciantes (
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    anunciante TEXT NOT NULL,
    PRIMARY KEY (cliente_id, anunciante)
  );

  -- Clientes que un Admin/Super Admin le habilita ver a un usuario_interno
  -- (varios a la vez). Sin filas para un usuario_interno = no ve nada todavía.
  CREATE TABLE IF NOT EXISTS usuario_clientes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    PRIMARY KEY (user_id, cliente_id)
  );

  -- Acota, dentro de un cliente ya visible para el usuario (usuario_externo o
  -- usuario_interno), a qué anunciantes de ese cliente puede ver -- un cliente
  -- puede agrupar varias marcas (ej. PE_Alicorp -> Alacena/Primor/Nicolini) y
  -- no todos los usuarios de ese cliente deben ver todas. Sin filas para un
  -- (usuario, cliente) = ve todos los anunciantes de ese cliente (default
  -- retrocompatible: la restricción es opt-in, nunca le quita acceso a nadie
  -- que ya tenía).
  CREATE TABLE IF NOT EXISTS usuario_anunciantes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    anunciante TEXT NOT NULL,
    PRIMARY KEY (user_id, cliente_id, anunciante)
  );
`)

// Un cliente puede contratar cualquier subconjunto de los 5 canales, cada uno
// con su propio Sheet de datos brutos (reemplaza al `clientes.sheet_id` único
// que asumía un solo Sheet por cliente para todos los canales).
const clienteColumns = db.prepare("PRAGMA table_info(clientes)").all().map((c) => c.name)
if (clienteColumns.includes('sheet_id')) {
  db.exec('ALTER TABLE clientes DROP COLUMN sheet_id')
}

// País de operación del cliente (código de la tabla `paises` de abajo) --
// puramente informativo, para que Admin > Clientes arme `nombre` como
// "{País}_{Nombre}" (ej. PE_Alicorp) sin que cada quien lo tipee a mano.
// Nullable: clientes creados antes de esto (ej. Cartavio) no lo tienen. Sin
// FOREIGN KEY a propósito (columna nullable, de solo etiqueta -- no amerita
// la migración de tabla completa que sí se justificó para cliente_canales).
if (!clienteColumns.includes('pais')) {
  db.exec('ALTER TABLE clientes ADD COLUMN pais TEXT')
}

// Catálogo de países de operación (antes una lista fija de 5 en el código:
// PE/EC/CL/MX/CO). Un Super Admin puede sumar uno nuevo cuando Mediaudience
// abra una operación (ver server/adminRoutes.js), sin tocar código ni
// redeployar -- mismo patrón que el catálogo de `canales` de abajo.
db.exec(`
  CREATE TABLE IF NOT EXISTS paises (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1
  );
`)

const insertarPais = db.prepare('INSERT OR IGNORE INTO paises (codigo, nombre) VALUES (?, ?)')
for (const [codigo, nombre] of [
  ['PE', 'Perú'],
  ['EC', 'Ecuador'],
  ['CL', 'Chile'],
  ['MX', 'México'],
  ['CO', 'Colombia'],
]) {
  insertarPais.run(codigo, nombre)
}

// Sheet ID por país para las 2 subsecciones de Gestión que muestran data
// administrativa sin ligarse a clientes/anunciantes (Campañas Servidas,
// Facturación) -- Admin/Super Admin lo cargan desde Admin > Sheets de
// Gestión (server/adminRoutes.js). Un solo Sheet por país con AMBAS
// secciones como pestañas fijas dentro ("Campañas Servidas" y
// "Facturación") -- no son 2 Sheets separados. No se pre-siembra una fila
// por país: se crea/actualiza con INSERT ... ON CONFLICT recién cuando
// alguien guarda un Sheet ID.
db.exec(`
  CREATE TABLE IF NOT EXISTS gestion_sheets (
    pais TEXT PRIMARY KEY REFERENCES paises(codigo),
    sheet_id TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Catálogo de servicios (antes una lista fija de 5 en el código: CTV-OTT,
// Programático, Youtube, Push Notification, TikTok). `slug` es el id de URL
// (usado también en cliente_canales.canal); `dir` es la carpeta real bajo
// src/data donde vive su data sincronizada -- para los 5 originales hereda el
// nombre de carpeta camelCase que ya existía en disco; para servicios nuevos
// creados por un Super Admin (ver server/adminRoutes.js), dir = slug.
db.exec(`
  CREATE TABLE IF NOT EXISTS canales (
    slug TEXT PRIMARY KEY,
    dir TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const insertarCanal = db.prepare(
  'INSERT OR IGNORE INTO canales (slug, dir, nombre) VALUES (?, ?, ?)'
)
for (const [slug, dir, nombre] of [
  ['ctv-ott', 'ctvOtt', 'CTV - OTT'],
  ['programatico', 'programatico', 'Programático'],
  ['youtube', 'youtube', 'Youtube'],
  ['push-notification', 'pushNotification', 'Push Notification'],
  ['tiktok', 'tiktok', 'TikTok'],
]) {
  insertarCanal.run(slug, dir, nombre)
}

// cliente_canales.canal tenía un CHECK con esos mismos 5 valores fijos --
// ahora que el catálogo es dinámico (tabla `canales`), se reemplaza por una
// FOREIGN KEY. SQLite no permite alterar un CHECK existente, así que si la
// tabla ya existe con el esquema viejo se reconstruye copiando los datos
// (mismo patrón que la migración de roles de arriba).
const clienteCanalesTable = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cliente_canales'")
  .get()
if (clienteCanalesTable && clienteCanalesTable.sql.includes('CHECK (canal IN')) {
  db.exec(`
    ALTER TABLE cliente_canales RENAME TO cliente_canales_pre_canales_dinamicos;

    CREATE TABLE cliente_canales (
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      canal TEXT NOT NULL REFERENCES canales(slug),
      sheet_id TEXT,
      PRIMARY KEY (cliente_id, canal)
    );

    INSERT INTO cliente_canales (cliente_id, canal, sheet_id)
    SELECT cliente_id, canal, sheet_id FROM cliente_canales_pre_canales_dinamicos;

    DROP TABLE cliente_canales_pre_canales_dinamicos;
  `)
}

db.exec(`
  CREATE TABLE IF NOT EXISTS cliente_canales (
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    canal TEXT NOT NULL REFERENCES canales(slug),
    sheet_id TEXT,
    PRIMARY KEY (cliente_id, canal)
  );
`)

// Columnas de seguridad (cambio de password obligatorio + bloqueo por intentos
// fallidos) agregadas después del esquema inicial de `users`.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name)
if (!userColumns.includes('debe_cambiar_password')) {
  db.exec('ALTER TABLE users ADD COLUMN debe_cambiar_password INTEGER NOT NULL DEFAULT 0')
}
if (!userColumns.includes('intentos_fallidos')) {
  db.exec('ALTER TABLE users ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0')
}
if (!userColumns.includes('bloqueado_hasta')) {
  db.exec('ALTER TABLE users ADD COLUMN bloqueado_hasta TEXT')
}

// Se marca en 1 cuando una sesión se cierra por inactividad/máximo de 24h
// (ver server/middleware.js) -- el próximo POST /login con contraseña correcta
// no inicia sesión de una, sino que manda el código OTP y exige verificarlo
// (server/auth.js). Un logout manual no la activa: no hay nada anómalo que
// justifique pedir un segundo factor en ese caso.
if (!userColumns.includes('requiere_otp')) {
  db.exec('ALTER TABLE users ADD COLUMN requiere_otp INTEGER NOT NULL DEFAULT 0')
}

// País asignado a un usuario_interno (código de `paises`, ver Admin > Países):
// le da acceso automático a TODOS los clientes activos de ese país, sin
// importar si se crean después -- se suma a (no reemplaza) la restricción
// manual cliente-por-cliente de `usuario_clientes`, para no romper nada de lo
// ya configurado. Nulo para el resto de los roles y para un usuario_interno
// que todavía se maneja solo con el checklist manual.
if (!userColumns.includes('pais')) {
  db.exec('ALTER TABLE users ADD COLUMN pais TEXT')
}

// Perfil dentro de usuario_interno (Manager/Ejecutivo Comercial/Operaciones/
// Administrativo, ver shared/perfilesInterno.js) -- acota qué SECCIONES de
// Gestión/Campañas puede abrir, no qué datos ve (eso lo sigue resolviendo
// país/usuario_clientes de arriba). Nulo = ve todas las secciones
// (retrocompatible con el usuario_interno que ya existía antes de esto).
if (!userColumns.includes('perfil')) {
  db.exec('ALTER TABLE users ADD COLUMN perfil TEXT')
}

// Códigos de reingreso enviados por correo cuando la sesión expira por
// inactividad (ver server/middleware.js). Se guarda el hash del código, nunca
// el valor en claro.
db.exec(`
  CREATE TABLE IF NOT EXISTS login_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    codigo_hash TEXT NOT NULL,
    intentos INTEGER NOT NULL DEFAULT 0,
    usado INTEGER NOT NULL DEFAULT 0,
    expira_en TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Tokens del flujo self-service "¿Has olvidado tu contraseña?" (server/auth.js)
// -- mismo patrón que login_otps: se guarda el hash del token, nunca el valor
// en claro, de un solo uso y con vencimiento.
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    usado INTEGER NOT NULL DEFAULT 0,
    expira_en TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Log de actividad -- solo lo puede ver Super Admin (server/adminRoutes.js).
// `actor_user_id` puede ser null (ej. login fallido con un email que no
// existe): el email igual queda para poder rastrear intentos contra cuentas
// inexistentes. `detalle` es texto libre pensado para mostrarse tal cual en
// la UI, no una estructura a parsear.
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER REFERENCES users(id),
    actor_email TEXT,
    accion TEXT NOT NULL,
    detalle TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at)')
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log (actor_user_id)')

// Catálogo dinámico de etapas del pipeline de Prospección (Gestión), editable
// desde Admin > Etapas de Prospección (Super Admin) -- mismo patrón que
// `paises`/`canales` de arriba. `tipo` marca las etapas terminales: 'ganada'
// es la única que habilita el botón "Convertir a Cliente" en el frontend,
// 'perdida' cierra el prospecto sin conversión, 'abierta' es el resto.
db.exec(`
  CREATE TABLE IF NOT EXISTS etapas_prospeccion (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('abierta', 'ganada', 'perdida')) DEFAULT 'abierta',
    activo INTEGER NOT NULL DEFAULT 1
  );
`)

const insertarEtapaProspeccion = db.prepare(
  'INSERT OR IGNORE INTO etapas_prospeccion (codigo, nombre, orden, tipo) VALUES (?, ?, ?, ?)'
)
for (const [codigo, nombre, orden, tipo] of [
  ['nuevo', 'Nuevo', 1, 'abierta'],
  ['contactado', 'Contactado', 2, 'abierta'],
  ['calificado', 'Calificado', 3, 'abierta'],
  ['propuesta', 'Propuesta enviada', 4, 'abierta'],
  ['negociacion', 'Negociación', 5, 'abierta'],
  ['ganado', 'Ganado', 6, 'ganada'],
  ['perdido', 'Perdido', 7, 'perdida'],
]) {
  insertarEtapaProspeccion.run(codigo, nombre, orden, tipo)
}

// Prospección de ventas (Gestión > Prospección) -- pipeline separado de
// `clientes`, pensado para que el equipo comercial de cada país lo trabaje
// antes de que un prospecto se convierta (o no) en cliente real. `pais` sigue
// el mismo catálogo dinámico que `clientes.pais`, sin FOREIGN KEY real por el
// mismo criterio (columna de solo etiqueta). `convertido_cliente_id` se llena
// recién cuando un Admin/Super Admin confirma la conversión (ver
// server/prospeccionAccess.js) -- nunca automático.
db.exec(`
  CREATE TABLE IF NOT EXISTS prospectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    pais TEXT NOT NULL,
    etapa TEXT NOT NULL DEFAULT 'nuevo' REFERENCES etapas_prospeccion(codigo),
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,
    valor_estimado REAL,
    responsable_user_id INTEGER REFERENCES users(id),
    proxima_accion_fecha TEXT,
    proxima_accion_nota TEXT,
    creado_por INTEGER REFERENCES users(id),
    convertido_cliente_id INTEGER REFERENCES clientes(id),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
db.exec('CREATE INDEX IF NOT EXISTS idx_prospectos_pais ON prospectos (pais)')

// Prospectos que un Admin/Super Admin le asigna manualmente a un
// usuario_interno -- se SUMA (no reemplaza) a la visibilidad automática por
// país, mismo patrón que `usuario_clientes`.
db.exec(`
  CREATE TABLE IF NOT EXISTS usuario_prospectos (
    user_id INTEGER NOT NULL REFERENCES users(id),
    prospecto_id INTEGER NOT NULL REFERENCES prospectos(id),
    PRIMARY KEY (user_id, prospecto_id)
  );
`)

// Registro manual de actividades por prospecto (llamada/correo/whatsapp/
// reunión/nota) -- mismo patrón que `activity_log`, pero acá `detalle` es la
// nota que carga el usuario_interno, no un texto generado por el sistema.
db.exec(`
  CREATE TABLE IF NOT EXISTS prospecto_actividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospecto_id INTEGER NOT NULL REFERENCES prospectos(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('llamada', 'correo', 'whatsapp', 'reunion', 'nota')),
    detalle TEXT,
    actor_user_id INTEGER REFERENCES users(id),
    actor_nombre TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
db.exec('CREATE INDEX IF NOT EXISTS idx_prospecto_actividades_prospecto ON prospecto_actividades (prospecto_id)')

export default db
