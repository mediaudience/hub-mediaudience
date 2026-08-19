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
`)

// Un cliente puede contratar cualquier subconjunto de los 5 canales, cada uno
// con su propio Sheet de datos brutos (reemplaza al `clientes.sheet_id` único
// que asumía un solo Sheet por cliente para todos los canales).
const clienteColumns = db.prepare("PRAGMA table_info(clientes)").all().map((c) => c.name)
if (clienteColumns.includes('sheet_id')) {
  db.exec('ALTER TABLE clientes DROP COLUMN sheet_id')
}

db.exec(`
  CREATE TABLE IF NOT EXISTS cliente_canales (
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    canal TEXT NOT NULL CHECK (canal IN ('ctv-ott', 'programatico', 'youtube', 'push-notification', 'tiktok')),
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
