import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import db from './db.js';
import { requireUser, requireAdmin } from './middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const router = Router();
router.use(requireUser, requireAdmin);

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil de dictar
// o transcribir al compartir la contraseña temporal manualmente.
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(length = 10) {
  return Array.from(crypto.randomBytes(length), (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

// ---------- Clientes ----------

function toPublicCliente(cliente, anunciantes) {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    activo: !!cliente.activo,
    sheetId: cliente.sheet_id,
    anunciantes,
    createdAt: cliente.created_at,
  };
}

function getAnunciantesDeCliente(clienteId) {
  return db
    .prepare('SELECT anunciante FROM cliente_anunciantes WHERE cliente_id = ? ORDER BY anunciante')
    .all(clienteId)
    .map((r) => r.anunciante);
}

function setAnunciantesDeCliente(clienteId, anunciantes) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM cliente_anunciantes WHERE cliente_id = ?').run(clienteId);
    const ins = db.prepare('INSERT INTO cliente_anunciantes (cliente_id, anunciante) VALUES (?, ?)');
    for (const a of lista) ins.run(clienteId, a);
  });
  tx(anunciantes ?? []);
}

router.get('/clientes', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY nombre').all();
  res.json({ clientes: clientes.map((c) => toPublicCliente(c, getAnunciantesDeCliente(c.id))) });
});

router.get('/anunciantes-disponibles', async (req, res) => {
  try {
    const campanas = JSON.parse(await readFile(path.join(DATA_DIR, 'campanasServidas.json'), 'utf-8'));
    res.json({ anunciantes: [...new Set(campanas.map((c) => c.anunciante))].sort() });
  } catch {
    res.json({ anunciantes: [] });
  }
});

router.post('/clientes', (req, res) => {
  const { nombre, sheetId, anunciantes } = req.body || {};
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const info = db.prepare('INSERT INTO clientes (nombre, sheet_id) VALUES (?, ?)').run(nombre.trim(), sheetId || null);
  setAnunciantesDeCliente(info.lastInsertRowid, anunciantes);

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ cliente: toPublicCliente(cliente, getAnunciantesDeCliente(cliente.id)) });
});

router.put('/clientes/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { nombre, sheetId, anunciantes, activo } = req.body || {};
  db.prepare('UPDATE clientes SET nombre = ?, sheet_id = ?, activo = ? WHERE id = ?').run(
    nombre?.trim() || cliente.nombre,
    sheetId === undefined ? cliente.sheet_id : sheetId || null,
    activo === undefined ? cliente.activo : activo ? 1 : 0,
    cliente.id
  );
  if (anunciantes !== undefined) setAnunciantesDeCliente(cliente.id, anunciantes);

  const updated = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  res.json({ cliente: toPublicCliente(updated, getAnunciantesDeCliente(cliente.id)) });
});

// ---------- Usuarios ----------

function toPublicUsuario(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    clienteId: u.cliente_id,
    clienteNombre: u.cliente_nombre ?? null,
    activo: !!u.activo,
    createdAt: u.created_at,
    ultimoLogin: u.ultimo_login,
  };
}

const SELECT_USUARIOS = `
  SELECT users.*, clientes.nombre AS cliente_nombre
  FROM users LEFT JOIN clientes ON clientes.id = users.cliente_id
`;

router.get('/usuarios', (req, res) => {
  const rows = db.prepare(`${SELECT_USUARIOS} ORDER BY users.nombre`).all();
  res.json({ usuarios: rows.map(toPublicUsuario) });
});

function clienteActivoOError(clienteId) {
  if (!clienteId) return 'Selecciona un cliente para el rol Cliente';
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(clienteId);
  if (!cliente) return 'Cliente no encontrado o inactivo';
  return null;
}

router.post('/usuarios', async (req, res) => {
  const { email, nombre, rol, clienteId } = req.body || {};
  if (!email || !nombre || !rol) {
    return res.status(400).json({ error: 'Email, nombre y rol son requeridos' });
  }
  if (!['admin', 'cliente'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (rol === 'cliente') {
    const error = clienteActivoOError(clienteId);
    if (error) return res.status(400).json({ error });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, nombre, rol, cliente_id) VALUES (?, ?, ?, ?, ?)')
    .run(email, passwordHash, nombre, rol, rol === 'cliente' ? clienteId : null);

  const usuario = db.prepare(`${SELECT_USUARIOS} WHERE users.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ usuario: toPublicUsuario(usuario), passwordTemporal: password });
});

router.put('/usuarios/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { nombre, rol, clienteId, activo } = req.body || {};
  const esUnoMismo = user.id === req.user.id;

  if (esUnoMismo && activo === false) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }
  if (esUnoMismo && rol && rol !== 'admin' && user.rol === 'admin') {
    return res.status(400).json({ error: 'No puedes quitarte el rol de admin a ti mismo' });
  }

  const nuevoRol = rol ?? user.rol;
  let nuevoClienteId = null;
  if (nuevoRol === 'cliente') {
    nuevoClienteId = clienteId ?? user.cliente_id;
    const error = clienteActivoOError(nuevoClienteId);
    if (error) return res.status(400).json({ error });
  }

  db.prepare('UPDATE users SET nombre = ?, rol = ?, cliente_id = ?, activo = ? WHERE id = ?').run(
    nombre?.trim() || user.nombre,
    nuevoRol,
    nuevoClienteId,
    activo === undefined ? user.activo : activo ? 1 : 0,
    user.id
  );

  const updated = db.prepare(`${SELECT_USUARIOS} WHERE users.id = ?`).get(user.id);
  res.json({ usuario: toPublicUsuario(updated) });
});

router.post('/usuarios/:id/reset-password', async (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
  res.json({ passwordTemporal: password });
});

export default router;
