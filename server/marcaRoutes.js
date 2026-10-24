import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { requireUser, requireAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { CATEGORIAS_MARCA, PAIS_GLOBAL, MARCA_MAX_MB } from '../shared/marca.js';
import { FIRMA_TEMAS } from '../shared/firma.js';
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

router.get('/firma', (req, res) => {
  const guardada = db.prepare('SELECT nombre, cargo, telefono, email, pais, tema FROM usuario_firma WHERE user_id = ?').get(req.user.id);
  if (guardada) return res.json({ firma: guardada });
  // Primera vez: se prellena con lo que el hub ya sabe del usuario.
  const pais = req.user.pais ? db.prepare('SELECT nombre FROM paises WHERE codigo = ?').get(req.user.pais)?.nombre : '';
  res.json({
    firma: { nombre: req.user.nombre || '', cargo: '', telefono: '', email: req.user.email || '', pais: pais || '', tema: 'oscuro' },
  });
});

router.put('/firma', (req, res) => {
  const b = req.body || {};
  const tema = FIRMA_TEMAS.includes(b.tema) ? b.tema : 'oscuro';
  db.prepare(
    `INSERT INTO usuario_firma (user_id, nombre, cargo, telefono, email, pais, tema, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET nombre = excluded.nombre, cargo = excluded.cargo,
       telefono = excluded.telefono, email = excluded.email, pais = excluded.pais,
       tema = excluded.tema, updated_at = excluded.updated_at`
  ).run(req.user.id, limpiar(b.nombre), limpiar(b.cargo), limpiar(b.telefono, 40), limpiar(b.email), limpiar(b.pais, 60), tema);
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
