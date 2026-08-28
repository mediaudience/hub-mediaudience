import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import db from './db.js';
import { requireUser, requireAdmin, requireSuperAdmin } from './middleware.js';
import { enviarInvitacion } from './email.js';
import { registrarActividad } from './activityLog.js';
import { syncCliente, syncClienteServicio } from '../scripts/syncSheets.js';

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
  registrarActividad(req, { actor: req.user, accion: 'Servicio creado', detalle: `Creó el servicio "${canal.nombre}" (${canal.slug})` });
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
  registrarActividad(req, {
    actor: req.user,
    accion: 'Servicio editado',
    detalle: `Editó el servicio "${canal.slug}" -> nombre "${updated.nombre}", activo=${updated.activo}`,
  });
  res.json({ canal: updated });
});

// ---------- Países ----------

// El prefijo de `clientes.nombre` (ej. PE_Alicorp) sale de este catálogo --
// un Super Admin puede sumar un país nuevo cuando Mediaudience abra una
// operación, sin tocar código ni redeployar (mismo patrón que canales).
function paisesActivos() {
  return db.prepare('SELECT codigo, nombre FROM paises WHERE activo = 1 ORDER BY rowid').all();
}

function paisValidoOError(pais, { requerido }) {
  if (!pais) return requerido ? 'Selecciona el país del cliente' : null;
  if (!paisesActivos().some((p) => p.codigo === pais)) return 'País inválido';
  return null;
}

router.get('/paises', (req, res) => {
  res.json({ paises: db.prepare('SELECT codigo, nombre, activo FROM paises ORDER BY rowid').all() });
});

router.post('/paises', requireSuperAdmin, (req, res) => {
  const { codigo, nombre } = req.body || {};
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  const codigoNorm = (codigo || '').trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(codigoNorm)) {
    return res.status(400).json({ error: 'El código debe tener 2 o 3 letras (ej. PE, CO)' });
  }
  if (db.prepare('SELECT codigo FROM paises WHERE codigo = ?').get(codigoNorm)) {
    return res.status(409).json({ error: 'Ya existe un país con ese código' });
  }
  db.prepare('INSERT INTO paises (codigo, nombre) VALUES (?, ?)').run(codigoNorm, nombre.trim());
  const pais = db.prepare('SELECT codigo, nombre, activo FROM paises WHERE codigo = ?').get(codigoNorm);
  registrarActividad(req, { actor: req.user, accion: 'País creado', detalle: `Creó el país "${pais.nombre}" (${pais.codigo})` });
  res.status(201).json({ pais });
});

router.put('/paises/:codigo', requireSuperAdmin, (req, res) => {
  const pais = db.prepare('SELECT * FROM paises WHERE codigo = ?').get(req.params.codigo);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  const { nombre, activo } = req.body || {};
  db.prepare('UPDATE paises SET nombre = ?, activo = ? WHERE codigo = ?').run(
    nombre?.trim() || pais.nombre,
    activo === undefined ? pais.activo : activo ? 1 : 0,
    pais.codigo
  );
  const updated = db.prepare('SELECT codigo, nombre, activo FROM paises WHERE codigo = ?').get(pais.codigo);
  registrarActividad(req, {
    actor: req.user,
    accion: 'País editado',
    detalle: `Editó el país "${updated.codigo}" -> nombre "${updated.nombre}", activo=${updated.activo}`,
  });
  res.json({ pais: updated });
});

// ---------- Sheets de Gestión (Campañas Servidas / Facturación) ----------

// Config de Sheet ID por sección + país -- data puramente administrativa,
// sin relación a clientes/anunciantes (a diferencia de cliente_canales).
// A propósito SIN requireSuperAdmin: Jose pidió que tanto Admin como Super
// Admin puedan cargar el Sheet ID acá, distinto del criterio de
// Servicios/Países/Etapas (esos sí, solo Super Admin).
const SECCIONES_GESTION = ['campanas_servidas', 'facturacion'];

router.get('/gestion-sheets', (req, res) => {
  res.json({ sheets: db.prepare('SELECT seccion, pais, sheet_id FROM gestion_sheets').all() });
});

router.put('/gestion-sheets/:seccion/:pais', (req, res) => {
  const { seccion, pais } = req.params;
  if (!SECCIONES_GESTION.includes(seccion)) {
    return res.status(400).json({ error: 'Sección inválida' });
  }
  if (!paisesActivos().some((p) => p.codigo === pais)) {
    return res.status(400).json({ error: 'País inválido' });
  }
  const sheetId = (req.body?.sheetId ?? '').trim();
  db.prepare(
    `INSERT INTO gestion_sheets (seccion, pais, sheet_id, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(seccion, pais) DO UPDATE SET sheet_id = excluded.sheet_id, updated_at = excluded.updated_at`
  ).run(seccion, pais, sheetId);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Sheet de Gestión actualizado',
    detalle: `Actualizó el Sheet ID de "${seccion}" para ${pais}`,
  });
  res.json({ ok: true });
});

// ---------- Etapas de Prospección ----------

// Catálogo del pipeline de Gestión > Prospección (server/prospeccionRoutes.js
// lo lee sin filtro de rol -- cualquier usuario_interno/admin/super_admin
// puede VER las etapas, pero solo un Super Admin puede editarlas, mismo
// criterio que Servicios/Países.
router.get('/etapas-prospeccion', (req, res) => {
  res.json({ etapas: db.prepare('SELECT codigo, nombre, orden, tipo, activo FROM etapas_prospeccion ORDER BY orden').all() });
});

router.post('/etapas-prospeccion', requireSuperAdmin, (req, res) => {
  const { codigo, nombre, orden, tipo } = req.body || {};
  const codigoNorm = (codigo || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!codigoNorm) return res.status(400).json({ error: 'El código es requerido' });
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!['abierta', 'ganada', 'perdida'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido (abierta, ganada o perdida)' });
  }
  if (db.prepare('SELECT codigo FROM etapas_prospeccion WHERE codigo = ?').get(codigoNorm)) {
    return res.status(409).json({ error: 'Ya existe una etapa con ese código' });
  }
  const ordenNum = Number.isFinite(Number(orden))
    ? Number(orden)
    : (db.prepare('SELECT COALESCE(MAX(orden), 0) AS max FROM etapas_prospeccion').get().max + 1);
  db.prepare('INSERT INTO etapas_prospeccion (codigo, nombre, orden, tipo) VALUES (?, ?, ?, ?)').run(
    codigoNorm,
    nombre.trim(),
    ordenNum,
    tipo
  );
  const etapa = db.prepare('SELECT codigo, nombre, orden, tipo, activo FROM etapas_prospeccion WHERE codigo = ?').get(codigoNorm);
  registrarActividad(req, { actor: req.user, accion: 'Etapa de prospección creada', detalle: `Creó la etapa "${etapa.nombre}" (${etapa.codigo})` });
  res.status(201).json({ etapa });
});

router.put('/etapas-prospeccion/:codigo', requireSuperAdmin, (req, res) => {
  const etapa = db.prepare('SELECT * FROM etapas_prospeccion WHERE codigo = ?').get(req.params.codigo);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada' });
  const { nombre, orden, tipo, activo } = req.body || {};
  if (tipo !== undefined && !['abierta', 'ganada', 'perdida'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido (abierta, ganada o perdida)' });
  }
  db.prepare('UPDATE etapas_prospeccion SET nombre = ?, orden = ?, tipo = ?, activo = ? WHERE codigo = ?').run(
    nombre?.trim() || etapa.nombre,
    orden !== undefined && Number.isFinite(Number(orden)) ? Number(orden) : etapa.orden,
    tipo || etapa.tipo,
    activo === undefined ? etapa.activo : activo ? 1 : 0,
    etapa.codigo
  );
  const updated = db.prepare('SELECT codigo, nombre, orden, tipo, activo FROM etapas_prospeccion WHERE codigo = ?').get(etapa.codigo);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Etapa de prospección editada',
    detalle: `Editó la etapa "${updated.codigo}" -> nombre "${updated.nombre}", orden=${updated.orden}, tipo=${updated.tipo}, activo=${updated.activo}`,
  });
  res.json({ etapa: updated });
});

// ---------- Clientes ----------

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

// Dispara un sync puntual justo después de guardar canales con Sheet ID --
// así los datos del cliente (nuevo o recién editado) se ven reflejados de
// inmediato en el panel sin esperar al cron diario. Si falla (ej. el Sheet
// todavía no está compartido con la cuenta de servicio), no revienta el
// guardado del cliente -- el error viaja en la respuesta para corregirlo ahí
// mismo (ver [[project_mediaudience_google_sheets_api]]).
async function syncSiHaceFalta(clienteId, canales) {
  if (!canales?.some((c) => c.sheetId)) return null;
  try {
    return await syncCliente(clienteId);
  } catch (err) {
    return { sincronizados: [], omitidos: [], errores: [`Sync falló: ${err.message}`] };
  }
}

router.post('/clientes', async (req, res) => {
  const { nombre, pais, canales, anunciantes } = req.body || {};
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  const errorPais = paisValidoOError(pais, { requerido: true });
  if (errorPais) return res.status(400).json({ error: errorPais });
  // Defensa en el server, no solo en el form: el nombre siempre debe llevar
  // el prefijo del país (catálogo `paises` arriba) -- el frontend ya lo
  // compone, esto evita que un cliente quede sin la convención por un bug o
  // un llamado directo a la API.
  if (!nombre.trim().startsWith(`${pais}_`)) {
    return res.status(400).json({ error: `El nombre debe empezar con el prefijo del país (${pais}_)` });
  }

  const info = db.prepare('INSERT INTO clientes (nombre, pais) VALUES (?, ?)').run(nombre.trim(), pais);
  setAnunciantesDeCliente(info.lastInsertRowid, anunciantes);
  setCanalesDeCliente(info.lastInsertRowid, canales);

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  registrarActividad(req, { actor: req.user, accion: 'Cliente creado', detalle: `Creó el cliente "${cliente.nombre}"` });
  const sync = await syncSiHaceFalta(cliente.id, canales);
  res.status(201).json({
    cliente: toPublicCliente(cliente, getAnunciantesDeCliente(cliente.id), getCanalesDeCliente(cliente.id)),
    sync,
  });
});

router.put('/clientes/:id', async (req, res) => {
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
  registrarActividad(req, {
    actor: req.user,
    accion: 'Cliente editado',
    detalle: `Editó el cliente "${updated.nombre}" (activo=${updated.activo})`,
  });
  const sync = canales !== undefined ? await syncSiHaceFalta(updated.id, canales) : null;
  res.json({
    cliente: toPublicCliente(updated, getAnunciantesDeCliente(updated.id), getCanalesDeCliente(updated.id)),
    sync,
  });
});

// "Sincronizar ahora" manual desde Admin > Clientes -- para cuando ya se
// actualizó el Sheet de un cliente existente y no se quiere esperar al cron
// diario de las 6am (ver [[project_mediaudience_google_sheets_api]]).
router.post('/clientes/:id/sync', async (req, res) => {
  const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  try {
    const sync = await syncCliente(cliente.id);
    res.json({ sync });
  } catch (err) {
    res.status(500).json({ error: `Sync falló: ${err.message}` });
  }
});

// Igual que arriba pero acotado a UN solo servicio -- botón "Sincronizar"
// junto al Sheet ID de ese servicio dentro del formulario, para no tener que
// re-sincronizar los demás servicios del cliente si solo cambió uno.
router.post('/clientes/:id/canales/:canal/sync', async (req, res) => {
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const fila = db
    .prepare('SELECT sheet_id FROM cliente_canales WHERE cliente_id = ? AND canal = ?')
    .get(cliente.id, req.params.canal);
  if (!fila?.sheet_id) {
    return res.status(400).json({ error: 'Este cliente no tiene un Sheet ID guardado para ese servicio todavía' });
  }
  try {
    const sync = await syncClienteServicio(cliente.id, req.params.canal);
    res.json({ sync });
  } catch (err) {
    res.status(500).json({ error: `Sync falló: ${err.message}` });
  }
});

// Renombrar/eliminar un anunciante puntual de un cliente -- acciones aparte
// del guardado general del cliente (no van dentro del array `anunciantes` de
// arriba) porque además de tocar `cliente_anunciantes` tienen que cascadear a
// `usuario_anunciantes` (si algún usuario tenía este anunciante marcado como
// restricción, ver server/dataAccess.js) para no dejar referencias huérfanas
// a un nombre que ya no existe.
router.put('/clientes/:id/anunciantes/:anunciante', (req, res) => {
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const actual = req.params.anunciante;
  if (!db.prepare('SELECT 1 FROM cliente_anunciantes WHERE cliente_id = ? AND anunciante = ?').get(cliente.id, actual)) {
    return res.status(404).json({ error: 'Ese anunciante no existe en este cliente' });
  }

  const nuevo = (req.body?.nombre || '').trim();
  if (!nuevo) return res.status(400).json({ error: 'El nombre es requerido' });
  if (nuevo === actual) return res.json({ anunciante: nuevo });
  if (db.prepare('SELECT 1 FROM cliente_anunciantes WHERE cliente_id = ? AND anunciante = ?').get(cliente.id, nuevo)) {
    return res.status(409).json({ error: 'Este cliente ya tiene un anunciante con ese nombre' });
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE cliente_anunciantes SET anunciante = ? WHERE cliente_id = ? AND anunciante = ?').run(
      nuevo,
      cliente.id,
      actual
    );
    db.prepare('UPDATE usuario_anunciantes SET anunciante = ? WHERE cliente_id = ? AND anunciante = ?').run(
      nuevo,
      cliente.id,
      actual
    );
  });
  tx();
  registrarActividad(req, {
    actor: req.user,
    accion: 'Anunciante renombrado',
    detalle: `Renombró el anunciante "${actual}" -> "${nuevo}" (cliente #${cliente.id})`,
  });
  res.json({ anunciante: nuevo });
});

router.delete('/clientes/:id/anunciantes/:anunciante', (req, res) => {
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const nombre = req.params.anunciante;

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM cliente_anunciantes WHERE cliente_id = ? AND anunciante = ?').run(cliente.id, nombre);
    db.prepare('DELETE FROM usuario_anunciantes WHERE cliente_id = ? AND anunciante = ?').run(cliente.id, nombre);
  });
  tx();
  registrarActividad(req, {
    actor: req.user,
    accion: 'Anunciante eliminado',
    detalle: `Eliminó el anunciante "${nombre}" (cliente #${cliente.id})`,
  });
  res.json({ ok: true });
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
    pais: u.rol === ROL_CON_CLIENTES_ASIGNADOS ? u.pais ?? null : null,
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
  const { email, nombre, rol, clienteId, clienteIds, anunciantes, anunciantesPorCliente, pais } = req.body || {};
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
  // País de un usuario_interno: opcional (se suma al checklist manual de
  // clientes, no lo reemplaza -- ver [[project_mediaudience_pais_interno]]),
  // pero si viene tiene que ser uno del catálogo activo.
  if (rol === ROL_CON_CLIENTES_ASIGNADOS && pais) {
    const error = paisValidoOError(pais, { requerido: false });
    if (error) return res.status(400).json({ error });
  }
  // Restricción de anunciantes: mismo mecanismo para ambos roles, expresado
  // siempre como { clienteId: [anunciante, ...] } -- usuario_externo solo
  // puede acotar dentro de su único cliente.
  let anunciantesMapa;
  if (rol === ROL_CON_CLIENTE) {
    // anunciantes === null significa "sin restricción" (checklist con todos
    // marcados) -- no es lo mismo que un array vacío explícito, que sí debe
    // rechazarse. Antes se envolvía el null tal cual y la validación de abajo
    // lo confundía con un array vacío, rechazando el guardado.
    if (anunciantes !== undefined) {
      anunciantesMapa = anunciantes === null ? {} : { [clienteId]: anunciantes };
      if (anunciantes !== null) {
        const error = anunciantesPorClienteValidosOError(anunciantesMapa, [Number(clienteId)]);
        if (error) return res.status(400).json({ error });
      }
    }
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
      'INSERT INTO users (email, password_hash, nombre, rol, cliente_id, pais, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, ?, 1)'
    )
    .run(
      email,
      passwordHash,
      nombre,
      rol,
      rol === ROL_CON_CLIENTE ? clienteId : null,
      rol === ROL_CON_CLIENTES_ASIGNADOS ? pais || null : null
    );

  if (rol === ROL_CON_CLIENTES_ASIGNADOS) setClientesDeUsuario(info.lastInsertRowid, clienteIds);
  if (anunciantesMapa !== undefined) setAnunciantesPorClienteDeUsuario(info.lastInsertRowid, anunciantesMapa);

  const invitacion = await enviarInvitacion({ nombre, email, password, rol });

  const usuario = db.prepare(`${SELECT_USUARIOS} WHERE users.id = ?`).get(info.lastInsertRowid);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Usuario creado',
    detalle: `Creó a ${email} con rol ${rol}`,
  });
  if (!invitacion.enviado) {
    registrarActividad(req, {
      actor: req.user,
      accion: 'Correo no enviado',
      detalle: `Invitación a ${email}: ${invitacion.motivo}`,
    });
  }
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

  const { nombre, rol, clienteId, clienteIds, anunciantes, anunciantesPorCliente, activo, pais } = req.body || {};
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

  const nuevoPais = nuevoRol === ROL_CON_CLIENTES_ASIGNADOS ? (pais !== undefined ? pais || null : user.pais) : null;
  if (nuevoRol === ROL_CON_CLIENTES_ASIGNADOS && nuevoPais) {
    const error = paisValidoOError(nuevoPais, { requerido: false });
    if (error) return res.status(400).json({ error });
  }

  let anunciantesMapa;
  if (nuevoRol === ROL_CON_CLIENTE) {
    // Ver el mismo comentario en POST /usuarios: null = sin restricción.
    if (anunciantes !== undefined) {
      anunciantesMapa = anunciantes === null ? {} : { [nuevoClienteId]: anunciantes };
      if (anunciantes !== null) {
        const error = anunciantesPorClienteValidosOError(anunciantesMapa, [Number(nuevoClienteId)]);
        if (error) return res.status(400).json({ error });
      }
    }
  } else if (nuevoRol === ROL_CON_CLIENTES_ASIGNADOS) {
    anunciantesMapa = anunciantesPorCliente;
    const clienteIdsVigentes = clienteIds ?? getClientesDeUsuario(user.id).map((c) => c.id);
    const error = anunciantesPorClienteValidosOError(anunciantesMapa, clienteIdsVigentes);
    if (error) return res.status(400).json({ error });
  }

  db.prepare('UPDATE users SET nombre = ?, rol = ?, cliente_id = ?, pais = ?, activo = ? WHERE id = ?').run(
    nombre?.trim() || user.nombre,
    nuevoRol,
    nuevoClienteId,
    nuevoPais,
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

  const cambios = [];
  if (nuevoRol !== user.rol) cambios.push(`rol ${user.rol} -> ${nuevoRol}`);
  if (updated.activo !== user.activo) cambios.push(updated.activo ? 'reactivado' : 'desactivado');
  if (nuevoPais !== user.pais) cambios.push(`país ${user.pais ?? '(ninguno)'} -> ${nuevoPais ?? '(ninguno)'}`);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Usuario editado',
    detalle: `Editó a ${updated.email}${cambios.length ? `: ${cambios.join(', ')}` : ''}`,
  });

  res.json({ usuario: toPublicUsuario(updated) });
});

// Eliminar de verdad (no confundir con desactivar, que es reversible). Mismo
// criterio de jerarquia que editar/desactivar/resetear: solo Super Admin
// puede eliminar a otro miembro del staff.
router.delete('/usuarios/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  if (STAFF_ROLES.includes(user.rol) && req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Solo un Super Admin puede eliminar la cuenta de un Admin o Super Admin' });
  }
  if (user.rol === 'super_admin' && contarSuperAdminsActivos() <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un Super Admin activo' });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM usuario_clientes WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM usuario_anunciantes WHERE user_id = ?').run(user.id);
    // El historial de actividad se conserva -- solo se desvincula del id que
    // va a desaparecer (actor_email ya queda guardado aparte como texto).
    db.prepare('UPDATE activity_log SET actor_user_id = NULL WHERE actor_user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  tx();

  registrarActividad(req, {
    actor: req.user,
    accion: 'Usuario eliminado',
    detalle: `Eliminó a ${user.email} (rol ${user.rol})`,
  });

  res.json({ ok: true });
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
  registrarActividad(req, {
    actor: req.user,
    accion: 'Contraseña reseteada por administrador',
    detalle: esUnoMismo ? 'Reseteó su propia contraseña' : `Reseteó la contraseña de ${user.email}`,
  });

  if (!enviarPorCorreo) {
    return res.json({ passwordTemporal: password, invitacionEnviada: false, invitacionError: null });
  }
  const invitacion = await enviarInvitacion({ nombre: user.nombre, email: user.email, password, rol: user.rol });
  if (!invitacion.enviado) {
    registrarActividad(req, {
      actor: req.user,
      accion: 'Correo no enviado',
      detalle: `Contraseña reseteada a ${user.email}: ${invitacion.motivo}`,
    });
  }
  res.json({ passwordTemporal: password, invitacionEnviada: invitacion.enviado, invitacionError: invitacion.motivo });
});

// ---------- Actividad ----------

// Trazabilidad de qué hizo cada usuario (login/logout, incluidos fallidos, y
// toda acción de gestión -- server/activityLog.js) -- solo Super Admin puede
// verla, ni siquiera un Admin común.
const PAGINA_TAMANO_DEFECTO = 50;

router.get('/actividad', requireSuperAdmin, (req, res) => {
  const { actorEmail, accion, desde, hasta } = req.query;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(req.query.porPagina) || PAGINA_TAMANO_DEFECTO));

  const condiciones = [];
  const params = [];
  if (actorEmail) {
    condiciones.push('activity_log.actor_email = ?');
    params.push(actorEmail);
  }
  if (accion) {
    condiciones.push('activity_log.accion = ?');
    params.push(accion);
  }
  if (desde) {
    condiciones.push('activity_log.created_at >= ?');
    params.push(desde);
  }
  if (hasta) {
    condiciones.push('activity_log.created_at <= ?');
    params.push(hasta);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM activity_log ${where}`).get(...params).n;
  const registros = db
    .prepare(
      `SELECT activity_log.*, users.nombre AS actor_nombre, users.rol AS actor_rol
       FROM activity_log
       LEFT JOIN users ON users.id = activity_log.actor_user_id
       ${where}
       ORDER BY activity_log.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, porPagina, (pagina - 1) * porPagina);

  res.json({
    registros: registros.map((r) => ({
      id: r.id,
      fecha: r.created_at,
      actorEmail: r.actor_email,
      actorNombre: r.actor_nombre,
      actorRol: r.actor_rol,
      accion: r.accion,
      detalle: r.detalle,
      ip: r.ip,
    })),
    total,
    pagina,
    porPagina,
  });
});

router.get('/actividad/acciones', requireSuperAdmin, (req, res) => {
  const acciones = db.prepare('SELECT DISTINCT accion FROM activity_log ORDER BY accion').all().map((r) => r.accion);
  res.json({ acciones });
});

export default router;
