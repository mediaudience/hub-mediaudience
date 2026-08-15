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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'cliente')),
    cliente_id INTEGER REFERENCES clientes(id),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_login TEXT,
    CHECK (
      (rol = 'admin' AND cliente_id IS NULL) OR
      (rol = 'cliente' AND cliente_id IS NOT NULL)
    )
  );

  CREATE TABLE IF NOT EXISTS cliente_anunciantes (
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    anunciante TEXT NOT NULL,
    PRIMARY KEY (cliente_id, anunciante)
  );
`)

// sheet_id se agregó después de la migración inicial de `clientes`; se aplica
// con ALTER en vez de estar en el CREATE TABLE para no romper bases ya creadas.
const clienteColumns = db.prepare("PRAGMA table_info(clientes)").all().map((c) => c.name)
if (!clienteColumns.includes('sheet_id')) {
  db.exec('ALTER TABLE clientes ADD COLUMN sheet_id TEXT')
}

export default db
