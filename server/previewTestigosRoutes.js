import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { mkdir, rm, writeFile, copyFile, rename } from 'node:fs/promises';
import { requireUser, requireAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { capturarMedio, validarUrlMedio } from './previewTestigosCaptura.js';
import { formatoDeCreatividad, FORMATOS_TESTIGO, TESTIGO_MAX_MB } from '../shared/previewTestigos.js';
import db from './db.js';

// Admin > Preview Testigos (pedido de Jose 2026-11-24, lo usa Raiza): URL del
// medio + creatividades IAB -> imágenes de testigo para los reportes, sin
// Photoshop. El servidor solo captura el medio y guarda archivos; la
// composición (creatividad sobre el espacio, marco, sello, lámina 16:9) se
// dibuja en el navegador (src/utils/testigoRender.js).
//
// Archivos fuera del repo (el cron de las 06:00 hace `git add -A`).
const DIR = process.env.PREVIEW_TESTIGOS_DIR || '/var/lib/mediaudience/preview-testigos';
const MAX_BYTES = TESTIGO_MAX_MB * 1024 * 1024;

const router = Router();
router.use(requireUser, requireAdmin);

const carpeta = (id) => path.join(DIR, String(Number(id)));
const limpiar = (v, max = 160) => String(v ?? '').trim().slice(0, max);

function parse(json, porDefecto) {
  try {
    return json ? JSON.parse(json) : porDefecto;
  } catch {
    return porDefecto;
  }
}

const SELECT = `
  SELECT t.*, c.nombre AS cliente_nombre, u.nombre AS creado_por_nombre,
         (SELECT COUNT(*) FROM preview_testigo_creativos k WHERE k.testigo_id = t.id) AS n_creativos
  FROM preview_testigos t
  LEFT JOIN clientes c ON c.id = t.cliente_id
  LEFT JOIN users u ON u.id = t.creado_por`;

function ficha(t, conDetalle = false) {
  const base = {
    id: t.id,
    nombre: t.nombre,
    cliente_id: t.cliente_id,
    cliente_nombre: t.cliente_nombre,
    url: t.url,
    titulo_pagina: t.titulo_pagina,
    estado: t.estado,
    error: t.error,
    n_creativos: t.n_creativos,
    creado_por_nombre: t.creado_por_nombre,
    created_at: t.created_at,
    updated_at: t.updated_at,
    capturado_at: t.capturado_at,
    posicion_cola: t.estado === 'capturando' ? Math.max(0, cola.indexOf(t.id)) : null,
  };
  if (!conDetalle) return base;
  return {
    ...base,
    desktop: parse(t.desktop_json, null),
    mobile: parse(t.mobile_json, null),
    asignaciones: parse(t.asignaciones_json, {}),
    opciones: parse(t.opciones_json, {}),
    creativos: db
      .prepare('SELECT id, nombre, ancho, alto, ancho_px, alto_px FROM preview_testigo_creativos WHERE testigo_id = ? ORDER BY id')
      .all(t.id),
  };
}

const buscar = (id) => db.prepare(`${SELECT} WHERE t.id = ?`).get(Number(id));

// --- Cola de capturas: de a una (2 CPU / 4 GB en el server) ----------------

const cola = [];
let trabajando = false;

// Asigna a cada espacio sin creatividad la primera del mismo tamaño.
function autoAsignar(testigoId) {
  const t = db.prepare('SELECT desktop_json, mobile_json, asignaciones_json FROM preview_testigos WHERE id = ?').get(testigoId);
  if (!t) return;
  const creativos = db.prepare('SELECT id, ancho, alto FROM preview_testigo_creativos WHERE testigo_id = ? ORDER BY id').all(testigoId);
  const asig = parse(t.asignaciones_json, {});
  for (const meta of [parse(t.desktop_json, null), parse(t.mobile_json, null)]) {
    for (const e of meta?.espacios || []) {
      // null = Raiza eligió dejar el anuncio del medio en ese espacio.
      if (asig[e.id] === null || (asig[e.id] && creativos.some((c) => c.id === asig[e.id]))) continue;
      const c = creativos.find((k) => k.ancho === e.w && k.alto === e.h);
      if (c) asig[e.id] = c.id;
    }
  }
  db.prepare('UPDATE preview_testigos SET asignaciones_json = ? WHERE id = ?').run(JSON.stringify(asig), testigoId);
}

async function procesarCola() {
  if (trabajando) return;
  trabajando = true;
  while (cola.length) {
    const id = cola[0];
    const t = db.prepare('SELECT url FROM preview_testigos WHERE id = ?').get(id);
    if (t) {
      const tmp = path.join(carpeta(id), `captura-${crypto.randomUUID()}`);
      try {
        await mkdir(tmp, { recursive: true });
        const r = await capturarMedio(t.url, tmp);
        for (const dev of ['desktop', 'mobile']) await rename(path.join(tmp, `${dev}.jpg`), path.join(carpeta(id), `${dev}.jpg`));
        db.prepare(
          `UPDATE preview_testigos SET estado = 'listo', error = NULL, desktop_json = ?, mobile_json = ?, titulo_pagina = ?,
             capturado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(JSON.stringify(r.desktop), JSON.stringify(r.mobile), r.titulo || null, id);
        autoAsignar(id);
      } catch (err) {
        console.error(`[preview-testigos] captura ${id} falló:`, err.message);
        const msg = /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_ADDRESS/i.test(err.message)
          ? 'No se pudo abrir el sitio. Revisa la URL o prueba de nuevo en unos minutos.'
          : 'No se pudo capturar el sitio. Prueba de nuevo; si sigue fallando, el medio puede estar bloqueando capturas automáticas.';
        db.prepare("UPDATE preview_testigos SET estado = 'error', error = ?, updated_at = datetime('now') WHERE id = ?").run(msg, id);
      } finally {
        await rm(tmp, { recursive: true, force: true }).catch(() => {});
      }
    }
    cola.shift();
  }
  trabajando = false;
}

function encolar(id) {
  if (!cola.includes(id)) cola.push(id);
  procesarCola();
}

// Capturas que quedaron a medias por un reinicio del backend.
db.prepare(
  "UPDATE preview_testigos SET estado = 'error', error = 'La captura se interrumpió. Vuelve a capturar.' WHERE estado = 'capturando'"
).run();

// --- Rutas -------------------------------------------------------------------

router.get('/', (req, res) => {
  const filas = db.prepare(`${SELECT} ORDER BY t.updated_at DESC, t.id DESC LIMIT 300`).all();
  const clientes = db.prepare('SELECT id, nombre, pais FROM clientes WHERE activo = 1 ORDER BY nombre').all();
  res.json({ testigos: filas.map((t) => ficha(t)), clientes, formatos: FORMATOS_TESTIGO });
});

async function crear(req, { nombre, clienteId, url }) {
  const { lastInsertRowid: id } = db
    .prepare(
      "INSERT INTO preview_testigos (nombre, cliente_id, url, estado, creado_por, opciones_json) VALUES (?, ?, ?, 'capturando', ?, ?)"
    )
    .run(nombre, clienteId, url, req.user.id, JSON.stringify({ marco: true, sello: true, scroll: { desktop: 0, mobile: 0 } }));
  await mkdir(carpeta(id), { recursive: true });
  return Number(id);
}

function datosCreacion(body) {
  const nombre = limpiar(body?.nombre, 160);
  const clienteId = body?.cliente_id ? Number(body.cliente_id) : null;
  if (!nombre) throw Object.assign(new Error('Ponle un nombre (la campaña)'), { status: 400 });
  if (clienteId && !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(clienteId)) {
    throw Object.assign(new Error('Cliente inválido'), { status: 400 });
  }
  return { nombre, clienteId };
}

router.post('/', async (req, res, next) => {
  try {
    const { nombre, clienteId } = datosCreacion(req.body);
    const url = await validarUrlMedio(req.body?.url).catch((e) => {
      throw Object.assign(e, { status: 400 });
    });
    const id = await crear(req, { nombre, clienteId, url });
    registrarActividad(req, { actor: req.user, accion: 'preview_testigo_crear', detalle: `${nombre} · ${url}` });
    encolar(id);
    res.status(201).json({ testigo: ficha(buscar(id), true) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.get('/:id', (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return res.status(404).json({ error: 'Testigo no encontrado' });
  res.json({ testigo: ficha(t, true) });
});

// Usar las mismas creatividades en otra URL: copia el testigo (nombre,
// cliente, creatividades) y captura el medio nuevo.
router.post('/:id/duplicar', async (req, res, next) => {
  const origen = buscar(req.params.id);
  if (!origen) return res.status(404).json({ error: 'Testigo no encontrado' });
  try {
    const url = await validarUrlMedio(req.body?.url).catch((e) => {
      throw Object.assign(e, { status: 400 });
    });
    const id = await crear(req, { nombre: origen.nombre, clienteId: origen.cliente_id, url });
    const opciones = parse(origen.opciones_json, {});
    db.prepare('UPDATE preview_testigos SET opciones_json = ? WHERE id = ?').run(
      JSON.stringify({ ...opciones, scroll: { desktop: 0, mobile: 0 } }),
      id
    );
    const creativos = db.prepare('SELECT * FROM preview_testigo_creativos WHERE testigo_id = ? ORDER BY id').all(origen.id);
    for (const c of creativos) {
      const archivo = crypto.randomUUID() + path.extname(c.archivo);
      await copyFile(path.join(carpeta(origen.id), c.archivo), path.join(carpeta(id), archivo));
      db.prepare(
        'INSERT INTO preview_testigo_creativos (testigo_id, nombre, ancho, alto, ancho_px, alto_px, archivo, mime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, c.nombre, c.ancho, c.alto, c.ancho_px, c.alto_px, archivo, c.mime);
    }
    registrarActividad(req, { actor: req.user, accion: 'preview_testigo_crear', detalle: `${origen.nombre} · ${url} (copia de #${origen.id})` });
    encolar(id);
    res.status(201).json({ testigo: ficha(buscar(id), true) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.post('/:id/capturar', (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return res.status(404).json({ error: 'Testigo no encontrado' });
  if (t.estado !== 'capturando') {
    db.prepare("UPDATE preview_testigos SET estado = 'capturando', error = NULL, updated_at = datetime('now') WHERE id = ?").run(t.id);
  }
  encolar(t.id);
  res.json({ testigo: ficha(buscar(t.id), true) });
});

function espaciosValidos(lista, meta) {
  if (!Array.isArray(lista) || !meta) return null;
  const tamanos = FORMATOS_TESTIGO.map((f) => `${f.ancho}x${f.alto}`);
  const out = [];
  const ids = new Set();
  for (const e of lista.slice(0, 60)) {
    const id = limpiar(e?.id, 20);
    const w = Number(e?.w);
    const h = Number(e?.h);
    if (!/^[a-z0-9_-]+$/i.test(id) || ids.has(id) || !tamanos.includes(`${w}x${h}`)) continue;
    const x = Math.round(Math.min(Math.max(Number(e.x) || 0, 0), Math.max(0, meta.ancho - w)));
    const y = Math.round(Math.min(Math.max(Number(e.y) || 0, 0), Math.max(0, meta.alto - h)));
    ids.add(id);
    out.push({ id, w, h, x, y, origen: e.origen === 'detectado' ? 'detectado' : 'manual' });
  }
  return out;
}

router.patch('/:id', (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return res.status(404).json({ error: 'Testigo no encontrado' });
  const b = req.body || {};
  const cambios = {};
  if (b.nombre !== undefined) {
    const n = limpiar(b.nombre);
    if (!n) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    cambios.nombre = n;
  }
  if (b.cliente_id !== undefined) {
    const c = b.cliente_id ? Number(b.cliente_id) : null;
    if (c && !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(c)) return res.status(400).json({ error: 'Cliente inválido' });
    cambios.cliente_id = c;
  }
  for (const dev of ['desktop', 'mobile']) {
    if (b[`${dev}_espacios`] === undefined) continue;
    const meta = parse(t[`${dev}_json`], null);
    const esp = espaciosValidos(b[`${dev}_espacios`], meta);
    if (esp) cambios[`${dev}_json`] = JSON.stringify({ ...meta, espacios: esp });
  }
  if (b.asignaciones && typeof b.asignaciones === 'object') {
    const validos = new Set(db.prepare('SELECT id FROM preview_testigo_creativos WHERE testigo_id = ?').all(t.id).map((r) => r.id));
    const asig = {};
    for (const [k, v] of Object.entries(b.asignaciones).slice(0, 120)) {
      if (!/^[a-z0-9_-]{1,20}$/i.test(k)) continue;
      if (v === null) asig[k] = null;
      else if (validos.has(Number(v))) asig[k] = Number(v);
    }
    cambios.asignaciones_json = JSON.stringify(asig);
  }
  if (b.opciones && typeof b.opciones === 'object') {
    const o = b.opciones;
    const pos = (v) => Math.min(Math.max(Math.round(Number(v) || 0), 0), 20000);
    cambios.opciones_json = JSON.stringify({
      marco: o.marco !== false,
      sello: o.sello !== false,
      scroll: { desktop: pos(o.scroll?.desktop), mobile: pos(o.scroll?.mobile) },
    });
  }
  const cols = Object.keys(cambios);
  if (cols.length) {
    db.prepare(`UPDATE preview_testigos SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(
      ...cols.map((c) => cambios[c]),
      t.id
    );
  }
  res.json({ testigo: ficha(buscar(t.id), true) });
});

router.delete('/:id', async (req, res) => {
  const t = buscar(req.params.id);
  if (!t) return res.status(404).json({ error: 'Testigo no encontrado' });
  const i = cola.indexOf(t.id);
  if (i > 0) cola.splice(i, 1);
  db.prepare('DELETE FROM preview_testigo_creativos WHERE testigo_id = ?').run(t.id);
  db.prepare('DELETE FROM preview_testigos WHERE id = ?').run(t.id);
  if (i !== 0) await rm(carpeta(t.id), { recursive: true, force: true }).catch(() => {});
  registrarActividad(req, { actor: req.user, accion: 'preview_testigo_borrar', detalle: `${t.nombre} · ${t.url}` });
  res.json({ ok: true });
});

router.get('/:id/captura/:dev', (req, res) => {
  const t = buscar(req.params.id);
  const dev = req.params.dev;
  if (!t || !['desktop', 'mobile'].includes(dev) || !t[`${dev}_json`]) return res.status(404).json({ error: 'Captura no encontrada' });
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=31536000, immutable' });
  res.type('image/jpeg').sendFile(path.join(carpeta(t.id), `${dev}.jpg`));
});

// --- Creatividades -----------------------------------------------------------

// Tamaño en px leyendo la cabecera del archivo (PNG, JPG, GIF, WebP). Sirve
// además como validación de que es una imagen de verdad.
function dimensiones(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { mime: 'image/png', ext: '.png', ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { mime: 'image/gif', ext: '.gif', ancho: buf.readUInt16LE(6), alto: buf.readUInt16LE(8) };
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const tipo = buf.toString('ascii', 12, 16);
    if (tipo === 'VP8X') return { mime: 'image/webp', ext: '.webp', ancho: 1 + buf.readUIntLE(24, 3), alto: 1 + buf.readUIntLE(27, 3) };
    if (tipo === 'VP8 ') return { mime: 'image/webp', ext: '.webp', ancho: buf.readUInt16LE(26) & 0x3fff, alto: buf.readUInt16LE(28) & 0x3fff };
    if (tipo === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { mime: 'image/webp', ext: '.webp', ancho: (b & 0x3fff) + 1, alto: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1];
      const largo = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        return { mime: 'image/jpeg', ext: '.jpg', alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
      }
      i += 2 + largo;
    }
  }
  return null;
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let bytes = 0;
    req.on('data', (c) => {
      bytes += c.length;
      if (bytes > MAX_BYTES) {
        reject(Object.assign(new Error('grande'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

router.post('/:id/creativos', async (req, res, next) => {
  const t = buscar(req.params.id);
  if (!t) return res.status(404).json({ error: 'Testigo no encontrado' });
  let nombre;
  try {
    nombre = decodeURIComponent(String(req.get('X-Nombre-Archivo') || '')).trim();
  } catch {
    nombre = '';
  }
  nombre = nombre.replace(/[\\/\r\n"]/g, '_').slice(0, 160) || 'creatividad';
  if (Number(req.get('content-length') || 0) > MAX_BYTES) {
    return res.status(413).json({ error: `${nombre} supera el máximo de ${TESTIGO_MAX_MB} MB` });
  }
  try {
    const buf = await leerCuerpo(req);
    const d = dimensiones(buf);
    if (!d) return res.status(400).json({ error: `${nombre} no es una imagen JPG, PNG, GIF o WebP` });
    const f = formatoDeCreatividad(d.ancho, d.alto);
    if (!f) {
      const lista = FORMATOS_TESTIGO.map((x) => `${x.ancho}×${x.alto}`).join(', ');
      return res.status(400).json({ error: `${nombre} mide ${d.ancho}×${d.alto}. Los tamaños aceptados son ${lista} (o al doble).` });
    }
    const archivo = crypto.randomUUID() + d.ext;
    await mkdir(carpeta(t.id), { recursive: true });
    await writeFile(path.join(carpeta(t.id), archivo), buf);
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO preview_testigo_creativos (testigo_id, nombre, ancho, alto, ancho_px, alto_px, archivo, mime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(t.id, nombre, f.ancho, f.alto, d.ancho, d.alto, archivo, d.mime);
    db.prepare("UPDATE preview_testigos SET updated_at = datetime('now') WHERE id = ?").run(t.id);
    autoAsignar(t.id);
    res.status(201).json({ creativo_id: Number(lastInsertRowid), testigo: ficha(buscar(t.id), true) });
  } catch (err) {
    if (err.status === 413) return res.status(413).json({ error: `${nombre} supera el máximo de ${TESTIGO_MAX_MB} MB` });
    next(err);
  }
});

router.get('/:id/creativos/:cid', (req, res) => {
  const c = db
    .prepare('SELECT * FROM preview_testigo_creativos WHERE id = ? AND testigo_id = ?')
    .get(Number(req.params.cid), Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Creatividad no encontrada' });
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=31536000, immutable' });
  res.type(c.mime).sendFile(path.join(carpeta(c.testigo_id), c.archivo));
});

router.delete('/:id/creativos/:cid', async (req, res) => {
  const c = db
    .prepare('SELECT * FROM preview_testigo_creativos WHERE id = ? AND testigo_id = ?')
    .get(Number(req.params.cid), Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Creatividad no encontrada' });
  db.prepare('DELETE FROM preview_testigo_creativos WHERE id = ?').run(c.id);
  const t = db.prepare('SELECT asignaciones_json FROM preview_testigos WHERE id = ?').get(c.testigo_id);
  const asig = Object.fromEntries(Object.entries(parse(t.asignaciones_json, {})).filter(([, v]) => v !== c.id));
  db.prepare("UPDATE preview_testigos SET asignaciones_json = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(asig), c.testigo_id);
  autoAsignar(c.testigo_id);
  await rm(path.join(carpeta(c.testigo_id), c.archivo), { force: true }).catch(() => {});
  res.json({ testigo: ficha(buscar(c.testigo_id), true) });
});

export default router;
