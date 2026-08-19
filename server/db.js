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

export default db
