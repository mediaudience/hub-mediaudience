import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { requireUser, requireAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { CATEGORIAS_MARCA, PAIS_GLOBAL, MARCA_MAX_MB } from '../shared/marca.js';
import db from './db.js';

// Admin > Firmas y Admin > Material Comercial. Lo ven Admin/Super Admin y
// también usuario_interno (socios y equipo de cada país); usuario_externo
// (clientes) nunca. Subir/borrar material queda solo para Admin/Super Admin.
//
// Los archivos viven fuera del repo (MARCA_DIR): el cron de las 06:00 hace
// `git add -A` sobre el working tree (deploy.sh) y no queremos PPTs en git.
const MARCA_DIR = process.env.MARCA_DIR || '/var/lib/mediaudience/marca';
const MAX_BYTES = MARCA_MAX_MB * 1024 * 1024;

// Solo estos tipos se sirven inline (miniaturas). SVG queda afuera a
// propósito: inline en el mismo origen podría ejecutar scripts.
const MIME_INLINE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const router = Router();
router.use(requireUser);
router.use((req, res, next) => {
  if (req.user.rol === 'usuario_externo') return res.status(403).json({ error: 'No autorizado' });
  next();
});

function paisesValidos() {
  return [PAIS_GLOBAL, ...db.prepare('SELECT codigo, nombre FROM paises WHERE activo = 1 ORDER BY rowid').all()];
}

router.get('/paises', (req, res) => {
  res.json({ paises: paisesValidos() });
});

// ---- Firmas ----------------------------------------------------------------

function limpiar(v, max = 120) {
  return String(v ?? '').trim().slice(0, max);
}

const SELECT_FIRMA = `
  SELECT f.id, f.user_id, f.nombre, f.cargo, f.telefono, f.email, f.pais, f.created_at, f.updated_at,
         c.nombre AS creado_por_nombre, a.nombre AS actualizado_por_nombre
  FROM firmas f
  LEFT JOIN users c ON c.id = f.creado_por
  LEFT JOIN users a ON a.id = f.actualizado_por`;

function datosFirma(body) {
  const b = body || {};
  return {
    nombre: limpiar(b.nombre),
    cargo: limpiar(b.cargo),
    telefono: limpiar(b.telefono, 40),
    email: limpiar(b.email).toLowerCase(),
    pais: limpiar(b.pais, 60),
  };
}

function validarFirma(d) {
  if (!d.nombre) return 'Falta el nombre';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Falta un correo válido';
  return null;
}

function firmaPorEmail(email) {
  return db.prepare('SELECT * FROM firmas WHERE lower(email) = lower(?)').get(email);
}

function guardarFirma(id, d, actorId) {
  db.prepare(
    `UPDATE firmas SET nombre = ?, cargo = ?, telefono = ?, email = ?, pais = ?,
       actualizado_por = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(d.nombre, d.cargo, d.telefono, d.email, d.pais, actorId, id);
}

function crearFirma(d, { userId = null, actorId }) {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO firmas (user_id, nombre, cargo, telefono, email, pais, creado_por, actualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, d.nombre, d.cargo, d.telefono, d.email, d.pais, actorId, actorId);
  return lastInsertRowid;
}

const CORREO_DUPLICADO = 'Ya hay una firma registrada con ese correo.';

// Mi firma: la que cada usuario genera para sí mismo (socios incluidos).
router.get('/firma', (req, res) => {
  const mia = db.prepare(`${SELECT_FIRMA} WHERE f.user_id = ?`).get(req.user.id);
  if (mia) return res.json({ firma: mia });
  // Primera vez: se prellena con lo que el hub ya sabe del usuario.
  const pais = req.user.pais ? db.prepare('SELECT nombre FROM paises WHERE codigo = ?').get(req.user.pais)?.nombre : '';
  res.json({ firma: { nombre: req.user.nombre || '', cargo: '', telefono: '', email: req.user.email || '', pais: pais || '' } });
});

// Se llama al copiar/descargar o al tocar "Guardar". Si un Admin ya había
// cargado una ficha con ese correo para esta persona (sin dueño), se la
// asigna en vez de duplicarla.
router.put('/firma', (req, res) => {
  const d = datosFirma(req.body);
  const invalido = validarFirma(d);
  if (invalido) return res.status(400).json({ error: invalido });
  const mia = db.prepare('SELECT * FROM firmas WHERE user_id = ?').get(req.user.id);
  const otra = firmaPorEmail(d.email);
  if (otra && otra.id !== mia?.id && (otra.user_id !== null || mia)) {
    return res.status(409).json({ error: CORREO_DUPLICADO });
  }
  let id;
  if (mia) {
    id = mia.id;
    guardarFirma(id, d, req.user.id);
  } else if (otra) {
    id = otra.id;
    guardarFirma(id, d, req.user.id);
    db.prepare('UPDATE firmas SET user_id = ? WHERE id = ?').run(req.user.id, id);
  } else {
    id = crearFirma(d, { userId: req.user.id, actorId: req.user.id });
    registrarActividad(req, { actor: req.user, accion: 'firma_crear', detalle: `${d.nombre} <${d.email}>` });
  }
  res.json({ firma: db.prepare(`${SELECT_FIRMA} WHERE f.id = ?`).get(id) });
});

// Registro completo: solo Admin/Super Admin ven, crean, editan y borran
// firmas de cualquiera (pedido de Jose 2026-10-24).
router.get('/firmas', requireAdmin, (req, res) => {
  res.json({ firmas: db.prepare(`${SELECT_FIRMA} ORDER BY f.nombre COLLATE NOCASE`).all() });
});

router.post('/firmas', requireAdmin, (req, res) => {
  const d = datosFirma(req.body);
  const invalido = validarFirma(d);
  if (invalido) return res.status(400).json({ error: invalido });
  if (firmaPorEmail(d.email)) return res.status(409).json({ error: CORREO_DUPLICADO });
  // Si la persona tiene cuenta en el hub con ese correo, la ficha queda a su
  // nombre: así la ve como "Mi firma" cuando entra.
  const dueno = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(d.email);
  const id = crearFirma(d, { userId: dueno?.id ?? null, actorId: req.user.id });
  registrarActividad(req, { actor: req.user, accion: 'firma_crear', detalle: `${d.nombre} <${d.email}>` });
  res.status(201).json({ firma: db.prepare(`${SELECT_FIRMA} WHERE f.id = ?`).get(id) });
});

router.put('/firmas/:id', requireAdmin, (req, res) => {
  const actual = db.prepare('SELECT * FROM firmas WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Firma no encontrada' });
  const d = datosFirma(req.body);
  const invalido = validarFirma(d);
  if (invalido) return res.status(400).json({ error: invalido });
  const otra = firmaPorEmail(d.email);
  if (otra && otra.id !== actual.id) return res.status(409).json({ error: CORREO_DUPLICADO });
  guardarFirma(actual.id, d, req.user.id);
  registrarActividad(req, { actor: req.user, accion: 'firma_editar', detalle: `${d.nombre} <${d.email}>` });
  res.json({ firma: db.prepare(`${SELECT_FIRMA} WHERE f.id = ?`).get(actual.id) });
});

router.delete('/firmas/:id', requireAdmin, (req, res) => {
  const actual = db.prepare('SELECT * FROM firmas WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Firma no encontrada' });
  db.prepare('DELETE FROM firmas WHERE id = ?').run(actual.id);
  registrarActividad(req, { actor: req.user, accion: 'firma_borrar', detalle: `${actual.nombre} <${actual.email}>` });
  res.json({ ok: true });
});

// ---- Material Comercial ----------------------------------------------------

const SELECT_ARCHIVO = `
  SELECT a.id, a.pais, a.categoria, a.nombre, a.descripcion, a.mime, a.tamano, a.created_at,
         u.nombre AS subido_por_nombre
  FROM marca_archivos a LEFT JOIN users u ON u.id = a.subido_por`;

router.get('/archivos', (req, res) => {
  const archivos = db.prepare(`${SELECT_ARCHIVO} ORDER BY a.created_at DESC, a.id DESC`).all();
  res.json({ archivos: archivos.map((a) => ({ ...a, inline: MIME_INLINE.includes(a.mime) })) });
});

// El cuerpo es el archivo crudo (fetch con body = File), no multipart: evita
// sumar una dependencia y se escribe a disco en streaming, sin cargarlo
// entero en memoria. Nombre original en X-Nombre-Archivo (URI-encoded) y tipo
// real en X-Tipo-Archivo: el Content-Type va siempre como octet-stream para
// que express.json() (index.js) no intente parsear un .json subido.
router.post('/archivos', requireAdmin, async (req, res, next) => {
  const pais = String(req.query.pais || '');
  const categoria = String(req.query.categoria || '');
  const descripcion = limpiar(req.query.descripcion, 300) || null;
  let nombre;
  try {
    nombre = decodeURIComponent(String(req.get('X-Nombre-Archivo') || '')).trim();
  } catch {
    nombre = '';
  }
  nombre = nombre.replace(/[\\/\r\n"]/g, '_').slice(0, 200);

  if (!paisesValidos().some((p) => p.codigo === pais)) return res.status(400).json({ error: 'País inválido' });
  if (!CATEGORIAS_MARCA.some((c) => c.codigo === categoria)) return res.status(400).json({ error: 'Categoría inválida' });
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre del archivo' });
  const largo = Number(req.get('content-length') || 0);
  if (largo > MAX_BYTES) return res.status(413).json({ error: `El archivo supera el máximo de ${MARCA_MAX_MB} MB` });

  const ext = (path.extname(nombre).toLowerCase().match(/^\.[a-z0-9]{1,10}$/) || [''])[0];
  const archivo = crypto.randomUUID() + ext;
  const destino = path.join(MARCA_DIR, archivo);
  const mime = String(req.get('X-Tipo-Archivo') || 'application/octet-stream').split(';')[0].slice(0, 100);

  try {
    await mkdir(MARCA_DIR, { recursive: true });
    const tamano = await new Promise((resolve, reject) => {
      let bytes = 0;
      const out = createWriteStream(destino);
      req.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          req.unpipe(out);
          out.destroy();
          reject(Object.assign(new Error('demasiado grande'), { status: 413 }));
        }
      });
      req.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve(bytes));
      req.pipe(out);
    });
    if (tamano === 0) {
      await rm(destino, { force: true });
      return res.status(400).json({ error: 'El archivo está vacío' });
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO marca_archivos (pais, categoria, nombre, descripcion, archivo, mime, tamano, subido_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(pais, categoria, nombre, descripcion, archivo, mime, tamano, req.user.id);
    registrarActividad(req, { actor: req.user, accion: 'marca_subir', detalle: `${nombre} (${pais}, ${categoria})` });
    const creado = db.prepare(`${SELECT_ARCHIVO} WHERE a.id = ?`).get(lastInsertRowid);
    res.status(201).json({ archivo: { ...creado, inline: MIME_INLINE.includes(creado.mime) } });
  } catch (err) {
    await rm(destino, { force: true });
    if (err.status === 413) return res.status(413).json({ error: `El archivo supera el máximo de ${MARCA_MAX_MB} MB` });
    next(err);
  }
});

function buscarArchivo(id) {
  return db.prepare('SELECT * FROM marca_archivos WHERE id = ?').get(id);
}

router.get('/archivos/:id/descargar', (req, res, next) => {
  const a = buscarArchivo(req.params.id);
  if (!a) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.download(path.join(MARCA_DIR, a.archivo), a.nombre, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

router.get('/archivos/:id/ver', (req, res, next) => {
  const a = buscarArchivo(req.params.id);
  if (!a || !MIME_INLINE.includes(a.mime)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, max-age=86400');
  res.type(a.mime).sendFile(path.join(MARCA_DIR, a.archivo), (err) => {
    if (err && !res.headersSent) next(err);
  });
});

router.delete('/archivos/:id', requireAdmin, async (req, res) => {
  const a = buscarArchivo(req.params.id);
  if (!a) return res.status(404).json({ error: 'Archivo no encontrado' });
  db.prepare('DELETE FROM marca_archivos WHERE id = ?').run(a.id);
  await rm(path.join(MARCA_DIR, a.archivo), { force: true });
  registrarActividad(req, { actor: req.user, accion: 'marca_borrar', detalle: `${a.nombre} (${a.pais}, ${a.categoria})` });
  res.json({ ok: true });
});

export default router;
