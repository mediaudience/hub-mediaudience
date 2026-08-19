import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import db from './db.js';
import { requireUser, requireAdmin, requireSuperAdmin } from './middleware.js';
import { enviarInvitacion } from './email.js';

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

const ROLES = ['super_admin', 'admin', 'usuario_interno', 'usuario_externo'];
const STAFF_ROLES = ['super_admin', 'admin'];
const ROL_CON_CLIENTE = 'usuario_externo';

function contarSuperAdminsActivos() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE rol = 'super_admin' AND activo = 1").get().n;
}

// ---------- Servicios (canales) ----------

// slugify básico: sin tildes, kebab-case. Para servicios nuevos, dir = slug
// (los 5 canales originales heredan su carpeta camelCase ya sembrada en db.js).
function slugify(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugsCanalesActivos() {
  return db.prepare('SELECT slug FROM canales WHERE activo = 1').all().map((r) => r.slug);
}

// Slugs que chocarían con rutas ya existentes del frontend (src/App.jsx) si
// se usaran como slug de canal -- ver rutas /login y /admin/*.
const SLUGS_RESERVADOS = ['admin', 'login'];

router.get('/canales', (req, res) => {
  res.json({ canales: db.prepare('SELECT slug, dir, nombre, activo FROM canales ORDER BY rowid').all() });
});

router.post('/canales', requireSuperAdmin, (req, res) => {
  const { nombre } = req.body || {};
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  const slug = slugify(nombre);
  if (!slug) {
    return res.status(400).json({ error: 'No se pudo derivar un identificador válido de ese nombre' });
  }
  if (SLUGS_RESERVADOS.includes(slug)) {
    return res.status(400).json({ error: 'Ese nombre choca con una sección existente del panel, elige otro' });
  }
  if (db.prepare('SELECT slug FROM canales WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'Ya existe un servicio con ese nombre' });
  }
  db.prepare('INSERT INTO canales (slug, dir, nombre) VALUES (?, ?, ?)').run(slug, slug, nombre.trim());
  const canal = db.prepare('SELECT slug, dir, nombre, activo FROM canales WHERE slug = ?').get(slug);
  res.status(201).json({ canal });
});

router.put('/canales/:slug', requireSuperAdmin, (req, res) => {
  const canal = db.prepare('SELECT * FROM canales WHERE slug = ?').get(req.params.slug);
  if (!canal) return res.status(404).json({ error: 'Servicio no encontrado' });

  const { nombre, activo } = req.body || {};
  db.prepare('UPDATE canales SET nombre = ?, activo = ? WHERE slug = ?').run(
    nombre?.trim() || canal.nombre,
    activo === undefined ? canal.activo : activo ? 1 : 0,
    canal.slug
  );
  const updated = db.prepare('SELECT slug, dir, nombre, activo FROM canales WHERE slug = ?').get(canal.slug);
  res.json({ canal: updated });
});

// ---------- Clientes ----------

// Países de operación de Mediaudience Latam -- el prefijo de `clientes.nombre`
// (ej. PE_Alicorp) sale de acá para que quien crea un cliente no lo tipee a
// mano. Agregar un país nuevo (ej. cuando abra Colombia) es editar esta
// lista y la gemela en src/pages/admin/Clientes.jsx.
const PAISES = [
  { codigo: 'PE', nombre: 'Perú' },
  { codigo: 'EC', nombre: 'Ecuador' },
  { codigo: 'CL', nombre: 'Chile' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'CO', nombre: 'Colombia' },
];
const PAISES_VALIDOS = PAISES.map((p) => p.codigo);

function paisValidoOError(pais, { requerido }) {
  if (!pais) return requerido ? 'Selecciona el país del cliente' : null;
  if (!PAISES_VALIDOS.includes(pais)) return 'País inválido';
  return null;
}

function toPublicCliente(cliente, anunciantes, canales) {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    pais: cliente.pais ?? null,
    activo: !!cliente.activo,
    canales,
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

// Un cliente puede tener contratado cualquier subconjunto de los servicios del
// catálogo `canales`; cada uno con su propio Sheet de datos brutos. Solo
// existe fila para los contratados.
function getCanalesDeCliente(clienteId) {
  return db
    .prepare('SELECT canal, sheet_id FROM cliente_canales WHERE cliente_id = ? ORDER BY canal')
    .all(clienteId)
    .map((r) => ({ canal: r.canal, sheetId: r.sheet_id }));
}

function setCanalesDeCliente(clienteId, canales) {
  const activos = slugsCanalesActivos();
  const lista = (canales ?? []).filter((c) => activos.includes(c.canal));
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM cliente_canales WHERE cliente_id = ?').run(clienteId);
    const ins = db.prepare('INSERT INTO cliente_canales (cliente_id, canal, sheet_id) VALUES (?, ?, ?)');
    for (const c of items) ins.run(clienteId, c.canal, c.sheetId || null);
  });
  tx(lista);
}

router.get('/clientes', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY nombre').all();
  res.json({
    clientes: clientes.map((c) => toPublicCliente(c, getAnunciantesDeCliente(c.id), getCanalesDeCliente(c.id))),
  });
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
  const { nombre, pais, canales, anunciantes } = req.body || {};
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  const errorPais = paisValidoOError(pais, { requerido: true });
  if (errorPais) return res.status(400).json({ error: errorPais });
  // Defensa en el server, no solo en el form: el nombre siempre debe llevar
  // el prefijo del país (ver PAISES arriba) -- el frontend ya lo compone,
  // esto evita que un cliente quede sin la convención por un bug o un
  // llamado directo a la API.
  if (!nombre.trim().startsWith(`${pais}_`)) {
    return res.status(400).json({ error: `El nombre debe empezar con el prefijo del país (${pais}_)` });
  }

  const info = db.prepare('INSERT INTO clientes (nombre, pais) VALUES (?, ?)').run(nombre.trim(), pais);
  setAnunciantesDeCliente(info.lastInsertRowid, anunciantes);
  setCanalesDeCliente(info.lastInsertRowid, canales);

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({
    cliente: toPublicCliente(cliente, getAnunciantesDeCliente(cliente.id), getCanalesDeCliente(cliente.id)),
  });
});

router.put('/clientes/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { nombre, pais, canales, anunciantes, activo } = req.body || {};
  if (pais !== undefined) {
    const errorPais = paisValidoOError(pais, { requerido: false });
    if (errorPais) return res.status(400).json({ error: errorPais });
  }
  const nuevoPais = pais !== undefined ? pais || null : cliente.pais;
  const nuevoNombre = nombre?.trim() || cliente.nombre;
  // Solo se exige el prefijo si el cliente ya tiene (o se le está asignando)
  // un país -- uno legado sin país todavía puede seguir editándose sin
  // forzar la convención de una.
  if (nuevoPais && !nuevoNombre.startsWith(`${nuevoPais}_`)) {
    return res.status(400).json({ error: `El nombre debe empezar con el prefijo del país (${nuevoPais}_)` });
  }

  db.prepare('UPDATE clientes SET nombre = ?, pais = ?, activo = ? WHERE id = ?').run(
    nuevoNombre,
    nuevoPais,
    activo === undefined ? cliente.activo : activo ? 1 : 0,
    cliente.id
  );
  if (anunciantes !== undefined) setAnunciantesDeCliente(cliente.id, anunciantes);
  if (canales !== undefined) setCanalesDeCliente(cliente.id, canales);

  const updated = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  res.json({
    cliente: toPublicCliente(updated, getAnunciantesDeCliente(updated.id), getCanalesDeCliente(updated.id)),
  });
});

// ---------- Usuarios ----------

const ROL_CON_CLIENTES_ASIGNADOS = 'usuario_interno';

function getClientesDeUsuario(userId) {
  return db
    .prepare(
      `SELECT clientes.id, clientes.nombre FROM usuario_clientes
       JOIN clientes ON clientes.id = usuario_clientes.cliente_id
       WHERE usuario_clientes.user_id = ? ORDER BY clientes.nombre`
    )
    .all(userId);
}

function setClientesDeUsuario(userId, clienteIds) {
  const tx = db.transaction((ids) => {
    db.prepare('DELETE FROM usuario_clientes WHERE user_id = ?').run(userId);
    const ins = db.prepare('INSERT INTO usuario_clientes (user_id, cliente_id) VALUES (?, ?)');
    for (const id of ids) ins.run(userId, id);
  });
  tx(clienteIds ?? []);
}

function clienteIdsValidosOError(clienteIds) {
  if (!Array.isArray(clienteIds)) return 'clienteIds debe ser una lista';
  for (const id of clienteIds) {
    if (!db.prepare('SELECT id FROM clientes WHERE id = ?').get(id)) return `Cliente ${id} no encontrado`;
  }
  return null;
}

// Restringe, dentro de un cliente que ya ve este usuario (usuario_externo o
// usuario_interno), a qué anunciantes de ese cliente puede ver -- ver
// usuario_anunciantes en server/db.js. Ausencia de fila para un
// (usuario, cliente) = ve todos los anunciantes de ese cliente.
function getAnunciantesPorClienteDeUsuario(userId) {
  const filas = db
    .prepare('SELECT cliente_id AS clienteId, anunciante FROM usuario_anunciantes WHERE user_id = ?')
    .all(userId);
  const mapa = {};
  for (const { clienteId, anunciante } of filas) {
    (mapa[clienteId] ??= []).push(anunciante);
  }
  return mapa;
}

// Reemplaza TODA la restricción de anunciantes del usuario por lo que venga en
// `mapa` ({ clienteId: [anunciante, ...] }); un clienteId ausente del mapa
// queda sin restricción (ve todos), incluido el caso de un cliente que ya no
// esté asignado al usuario.
function setAnunciantesPorClienteDeUsuario(userId, mapa) {
  const tx = db.transaction((m) => {
    db.prepare('DELETE FROM usuario_anunciantes WHERE user_id = ?').run(userId);
    const ins = db.prepare('INSERT INTO usuario_anunciantes (user_id, cliente_id, anunciante) VALUES (?, ?, ?)');
    for (const [clienteId, anunciantes] of Object.entries(m ?? {})) {
      for (const a of anunciantes) ins.run(userId, Number(clienteId), a);
    }
  });
  tx(mapa ?? {});
}

// `clienteIdsPermitidos`: los clientes que el usuario puede ver (su único
// cliente para usuario_externo, o los `clienteIds` que se le estén asignando
// para usuario_interno) -- no se puede restringir anunciantes de un cliente
// que el usuario ni siquiera ve.
function anunciantesPorClienteValidosOError(mapa, clienteIdsPermitidos) {
  if (mapa === undefined) return null;
  if (typeof mapa !== 'object' || mapa === null || Array.isArray(mapa)) {
    return 'anunciantesPorCliente debe ser un objeto { clienteId: [anunciante, ...] }';
  }
  for (const [clienteIdStr, anunciantes] of Object.entries(mapa)) {
    const clienteId = Number(clienteIdStr);
    if (!clienteIdsPermitidos.includes(clienteId)) {
      return `El cliente ${clienteId} no está asignado a este usuario`;
    }
    if (!Array.isArray(anunciantes) || anunciantes.length === 0) {
      return 'Selecciona al menos un anunciante por cliente, o déjalos todos marcados';
    }
    const validos = new Set(getAnunciantesDeCliente(clienteId));
    for (const a of anunciantes) {
      if (!validos.has(a)) return `"${a}" no es un anunciante asociado a ese cliente`;
    }
  }
  return null;
}

function toPublicUsuario(u) {
  const clientesAsignados = u.rol === ROL_CON_CLIENTES_ASIGNADOS ? getClientesDeUsuario(u.id) : [];
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    clienteId: u.cliente_id,
    clienteNombre: u.cliente_nombre ?? null,
    clienteIds: clientesAsignados.map((c) => c.id),
    clienteNombres: clientesAsignados.map((c) => c.nombre),
    anunciantesPorCliente: getAnunciantesPorClienteDeUsuario(u.id),
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
  if (!clienteId) return 'Selecciona un cliente para el rol Usuario Externo';
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(clienteId);
  if (!cliente) return 'Cliente no encontrado o inactivo';
  return null;
}

router.post('/usuarios', async (req, res) => {
  const { email, nombre, rol, clienteId, clienteIds, anunciantes, anunciantesPorCliente } = req.body || {};
  if (!email || !nombre || !rol) {
    return res.status(400).json({ error: 'Email, nombre y rol son requeridos' });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (STAFF_ROLES.includes(rol) && req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Solo un Super Admin puede crear una cuenta Admin o Super Admin' });
  }
  if (rol === ROL_CON_CLIENTE) {
    const error = clienteActivoOError(clienteId);
    if (error) return res.status(400).json({ error });
  }
  if (rol === ROL_CON_CLIENTES_ASIGNADOS && clienteIds !== undefined) {
    const error = clienteIdsValidosOError(clienteIds);
    if (error) return res.status(400).json({ error });
  }
  // Restricción de anunciantes: mismo mecanismo para ambos roles, expresado
  // siempre como { clienteId: [anunciante, ...] } -- usuario_externo solo
  // puede acotar dentro de su único cliente.
  let anunciantesMapa;
  if (rol === ROL_CON_CLIENTE) {
    anunciantesMapa = anunciantes !== undefined ? { [clienteId]: anunciantes } : undefined;
    const error = anunciantesPorClienteValidosOError(anunciantesMapa, [Number(clienteId)]);
    if (error) return res.status(400).json({ error });
  } else if (rol === ROL_CON_CLIENTES_ASIGNADOS) {
    anunciantesMapa = anunciantesPorCliente;
    const error = anunciantesPorClienteValidosOError(anunciantesMapa, clienteIds ?? []);
    if (error) return res.status(400).json({ error });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const info = db
    .prepare(
      'INSERT INTO users (email, password_hash, nombre, rol, cliente_id, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, 1)'
    )
    .run(email, passwordHash, nombre, rol, rol === ROL_CON_CLIENTE ? clienteId : null);

  if (rol === ROL_CON_CLIENTES_ASIGNADOS) setClientesDeUsuario(info.lastInsertRowid, clienteIds);
  if (anunciantesMapa !== undefined) setAnunciantesPorClienteDeUsuario(info.lastInsertRowid, anunciantesMapa);

  const invitacion = await enviarInvitacion({ nombre, email, password, rol });

  const usuario = db.prepare(`${SELECT_USUARIOS} WHERE users.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({
    usuario: toPublicUsuario(usuario),
    passwordTemporal: password,
    invitacionEnviada: invitacion.enviado,
    invitacionError: invitacion.motivo,
  });
});

router.put('/usuarios/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { nombre, rol, clienteId, clienteIds, anunciantes, anunciantesPorCliente, activo } = req.body || {};
  const esUnoMismo = user.id === req.user.id;

  if (rol && !ROLES.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  // Solo un Super Admin puede tocar la cuenta de otro Super Admin (evita que un
  // Admin común se auto-promueva o edite/desactive a quien sí tiene ese rol).
  if ((user.rol === 'super_admin' || rol === 'super_admin') && req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'No autorizado a modificar un Super Admin' });
  }
  // Un Admin puede seguir gestionando su propia cuenta, pero no la de otro
  // Admin (desactivar, resetear password, cambiar de rol) ni ascender a
  // alguien más a Admin -- eso queda reservado a Super Admin.
  if ((user.rol === 'admin' || rol === 'admin') && !esUnoMismo && req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Solo un Super Admin puede modificar la cuenta de otro Admin' });
  }
  // Nunca puede quedar el sistema sin ningún Super Admin activo.
  if (user.rol === 'super_admin' && (activo === false || (rol && rol !== 'super_admin'))) {
    if (contarSuperAdminsActivos() <= 1) {
      return res.status(400).json({ error: 'Debe quedar al menos un Super Admin activo' });
    }
  }

  if (esUnoMismo && activo === false) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }
  if (esUnoMismo && rol && rol !== user.rol && STAFF_ROLES.includes(user.rol) && !STAFF_ROLES.includes(rol)) {
    return res.status(400).json({ error: 'No puedes quitarte tu propio rol de administración' });
  }

  const nuevoRol = rol ?? user.rol;
  let nuevoClienteId = null;
  if (nuevoRol === ROL_CON_CLIENTE) {
    nuevoClienteId = clienteId ?? user.cliente_id;
    const error = clienteActivoOError(nuevoClienteId);
    if (error) return res.status(400).json({ error });
  }
  if (nuevoRol === ROL_CON_CLIENTES_ASIGNADOS && clienteIds !== undefined) {
    const error = clienteIdsValidosOError(clienteIds);
    if (error) return res.status(400).json({ error });
  }

  let anunciantesMapa;
  if (nuevoRol === ROL_CON_CLIENTE) {
    anunciantesMapa = anunciantes !== undefined ? { [nuevoClienteId]: anunciantes } : undefined;
    const error = anunciantesPorClienteValidosOError(anunciantesMapa, [Number(nuevoClienteId)]);
    if (error) return res.status(400).json({ error });
  } else if (nuevoRol === ROL_CON_CLIENTES_ASIGNADOS) {
    anunciantesMapa = anunciantesPorCliente;
    const clienteIdsVigentes = clienteIds ?? getClientesDeUsuario(user.id).map((c) => c.id);
    const error = anunciantesPorClienteValidosOError(anunciantesMapa, clienteIdsVigentes);
    if (error) return res.status(400).json({ error });
  }

  db.prepare('UPDATE users SET nombre = ?, rol = ?, cliente_id = ?, activo = ? WHERE id = ?').run(
    nombre?.trim() || user.nombre,
    nuevoRol,
    nuevoClienteId,
    activo === undefined ? user.activo : activo ? 1 : 0,
    user.id
  );

  if (nuevoRol === ROL_CON_CLIENTES_ASIGNADOS) {
    if (clienteIds !== undefined) setClientesDeUsuario(user.id, clienteIds);
  } else if (user.rol === ROL_CON_CLIENTES_ASIGNADOS) {
    // Dejó de ser usuario_interno: limpia asignaciones que ya no aplican.
    setClientesDeUsuario(user.id, []);
  }

  if (nuevoRol === ROL_CON_CLIENTE || nuevoRol === ROL_CON_CLIENTES_ASIGNADOS) {
    if (anunciantesMapa !== undefined) setAnunciantesPorClienteDeUsuario(user.id, anunciantesMapa);
  } else {
    // Dejó de tener clientes visibles: cualquier restricción de anunciantes deja de aplicar.
    setAnunciantesPorClienteDeUsuario(user.id, {});
  }

  const updated = db.prepare(`${SELECT_USUARIOS} WHERE users.id = ?`).get(user.id);
  res.json({ usuario: toPublicUsuario(updated) });
});

router.post('/usuarios/:id/reset-password', async (req, res) => {
  const user = db.prepare('SELECT id, email, nombre, rol FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Mismo criterio que editar/desactivar: solo Super Admin puede resetear la
  // password de otro miembro del staff (Admin o Super Admin); cada quien
  // puede seguir reseteando la suya propia.
  const esUnoMismo = user.id === req.user.id;
  if (STAFF_ROLES.includes(user.rol) && !esUnoMismo && req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Solo un Super Admin puede resetear la contraseña de otro Admin o Super Admin' });
  }

  const { password: passwordManual, enviarPorCorreo } = req.body || {};
  if (passwordManual !== undefined && passwordManual.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const password = passwordManual || generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ?, debe_cambiar_password = 1 WHERE id = ?').run(passwordHash, user.id);

  if (!enviarPorCorreo) {
    return res.json({ passwordTemporal: password, invitacionEnviada: false, invitacionError: null });
  }
  const invitacion = await enviarInvitacion({ nombre: user.nombre, email: user.email, password, rol: user.rol });
  res.json({ passwordTemporal: password, invitacionEnviada: invitacion.enviado, invitacionError: invitacion.motivo });
});

export default router;
