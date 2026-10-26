import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { requireUser, requireSuperAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { CAMPOS_PRESENTACION, PRODUCTOS_PRESENTACION, datosIniciales } from '../shared/presentaciones.js';
import db from './db.js';

// Admin > Material Comercial > Gestor de presentaciones (solo Super Admin).
// Cada país guarda qué productos vende (y en qué orden) y sus datos
// editables; "Generar" arma un borrador con el generador Python (fuera del
// repo, en PRESENTACIONES_DIR: imágenes y videos pesan cientos de MB), que se
// revisa en Vista previa y desde ahí se publica en Material Comercial.
const PRESENTACIONES_DIR = process.env.PRESENTACIONES_DIR || '/opt/mediaudience-presentaciones';
const DECK_DIR = path.join(PRESENTACIONES_DIR, 'deck');
const PYTHON = path.join(PRESENTACIONES_DIR, 'venv', 'bin', 'python');
const MARCA_DIR = process.env.MARCA_DIR || '/var/lib/mediaudience/marca';
const MAX_SEGUNDOS = 300;

const router = Router();
router.use(requireUser, requireSuperAdmin);

const CLAVES_PRODUCTO = PRODUCTOS_PRESENTACION.map((p) => p.clave);
const CAMPOS = new Map(CAMPOS_PRESENTACION.map((c) => [c.clave, c]));

// Datos de Perú, la base. Se leen en cada pedido: si se regenera
// datos_base.json (exportar_datos.py) no hace falta reiniciar el backend.
function base() {
  return JSON.parse(readFileSync(path.join(DECK_DIR, 'datos_base.json'), 'utf8'));
}

function paisValido(codigo) {
  return db.prepare('SELECT codigo, nombre FROM paises WHERE codigo = ? AND activo = 1').get(codigo);
}

function configDe(pais) {
  const fila = db
    .prepare(
      `SELECT p.*, u.nombre AS actualizado_por_nombre FROM presentaciones_pais p
       LEFT JOIN users u ON u.id = p.actualizado_por WHERE p.pais = ?`
    )
    .get(pais.codigo);
  const b = base();
  if (!fila) {
    return { productos: pais.codigo === 'PE' ? b.productos : [], datos: datosIniciales(b.datos, pais), guardado: false };
  }
  // Un campo nuevo en el catálogo que este país todavía no tiene arranca
  // con el valor inicial, sin pisar lo que ya editaron.
  const datos = { ...datosIniciales(b.datos, pais), ...JSON.parse(fila.datos) };
  return {
    productos: JSON.parse(fila.productos),
    datos,
    guardado: true,
    updated_at: fila.updated_at,
    actualizado_por_nombre: fila.actualizado_por_nombre,
    archivo_id: fila.archivo_id,
  };
}

const texto = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const listaDe = (v, max = 30) => (Array.isArray(v) ? v : []).slice(0, max);

// Normaliza lo que manda la pantalla al tipo de cada campo; lo que no está en
// el catálogo se descarta (el generador no debe recibir claves inventadas).
function limpiarDatos(entrada) {
  const datos = {};
  for (const [clave, campo] of CAMPOS) {
    const v = entrada?.[clave];
    if (v === undefined) continue;
    if (campo.tipo === 'texto') datos[clave] = texto(v, 200);
    else if (campo.tipo === 'largo') datos[clave] = texto(v, 1200);
    else if (campo.tipo === 'lista') datos[clave] = listaDe(v).map((x) => texto(x)).filter(Boolean);
    else if (campo.tipo === 'kpi') datos[clave] = [texto(v?.[0], 40), texto(v?.[1], 120)];
    else if (campo.tipo === 'kpis')
      datos[clave] = listaDe(v, 8)
        .map((k) => [texto(k?.[0], 40), texto(k?.[1], 120)])
        .filter((k) => k[0]);
    else if (campo.tipo === 'filas')
      datos[clave] = listaDe(v, 8)
        .map((f) => campo.columnas.map((_, i) => texto(f?.[i], 160)))
        .filter((f) => f[0]);
  }
  return datos;
}

router.get('/', (req, res) => {
  const paises = db.prepare('SELECT codigo, nombre FROM paises WHERE activo = 1 ORDER BY rowid').all();
  const filas = db.prepare('SELECT pais, productos, updated_at, archivo_id FROM presentaciones_pais').all();
  const porPais = Object.fromEntries(filas.map((f) => [f.pais, f]));
  res.json({
    paises: paises.map((p) => ({
      ...p,
      guardado: !!porPais[p.codigo],
      productos: porPais[p.codigo] ? JSON.parse(porPais[p.codigo].productos).length : 0,
      updated_at: porPais[p.codigo]?.updated_at ?? null,
      generando: trabajos.get(p.codigo)?.estado === 'generando',
    })),
  });
});

router.get('/:pais', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  res.json({ pais, ...configDe(pais), trabajo: trabajos.get(pais.codigo) ?? null });
});

function guardar(pais, body, user) {
  const productos = listaDe(body?.productos, CLAVES_PRODUCTO.length).filter(
    (p, i, arr) => CLAVES_PRODUCTO.includes(p) && arr.indexOf(p) === i
  );
  const actual = configDe(pais);
  const datos = { ...actual.datos, ...limpiarDatos(body?.datos) };
  db.prepare(
    `INSERT INTO presentaciones_pais (pais, productos, datos, actualizado_por, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(pais) DO UPDATE SET productos = excluded.productos, datos = excluded.datos,
       actualizado_por = excluded.actualizado_por, updated_at = excluded.updated_at`
  ).run(pais.codigo, JSON.stringify(productos), JSON.stringify(datos), user.id);
  return { productos, datos };
}

router.put('/:pais', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  guardar(pais, req.body, req.user);
  registrarActividad(req, { actor: req.user, accion: 'presentacion_guardar', detalle: pais.nombre });
  res.json({ pais, ...configDe(pais) });
});

// ---- Borrador, vista previa y publicación ----------------------------------------
// "Generar" arma un BORRADOR: el .pptx más una imagen por lámina (LibreOffice
// → PDF → JPG), en vistas/<PAÍS>/borrador. Se revisa en la pestaña Vista
// previa y recién "Publicar" lo pasa a Material Comercial, reemplazando la
// presentación vigente del país. Las imágenes de lo publicado quedan en
// vistas/<PAÍS>/publicada para poder verlo igual.
//
// Tarda ~30 s, más que el timeout de nginx: se lanza en segundo plano y la
// pantalla consulta el estado. Los trabajos viven en memoria (si el backend
// se reinicia a mitad, se vuelve a generar).
const VISTAS_DIR = path.join(PRESENTACIONES_DIR, 'vistas');
const LO_PERFIL = `file://${path.join(PRESENTACIONES_DIR, 'lo-perfil')}`;
const trabajos = new Map();

const dirVista = (pais, tipo) => path.join(VISTAS_DIR, pais, tipo);
const nombrePptx = (pais) => `${pais}_Mediaudience_Presentacion-Comercial_Signal_2026.pptx`;

function leerMeta(pais, tipo) {
  try {
    return JSON.parse(readFileSync(path.join(dirVista(pais, tipo), 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

function correr(cmd, args, opciones = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, opciones);
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d).slice(-4000)));
    const t = setTimeout(() => p.kill('SIGKILL'), MAX_SEGUNDOS * 1000);
    p.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(err.trim().split('\n').pop() || `${path.basename(cmd)} terminó con código ${code}`));
    });
  });
}

// LibreOffice no tolera dos conversiones a la vez con el mismo perfil: una
// cola global, aunque se generen dos países seguidos.
let cola = Promise.resolve();
function enCola(fn) {
  const r = cola.then(fn, fn);
  cola = r.catch(() => {});
  return r;
}

async function generar(pais, config, user, req) {
  const id = crypto.randomUUID();
  const tmp = path.join(PRESENTACIONES_DIR, 'tmp', id);
  const fase = (texto) => trabajos.set(pais.codigo, { ...trabajos.get(pais.codigo), fase: texto });
  try {
    await mkdir(tmp, { recursive: true });
    const json = path.join(tmp, 'datos.json');
    const pptx = path.join(tmp, 'presentacion.pptx');
    await writeFile(json, JSON.stringify({ productos: config.productos, datos: config.datos }));
    fase('Armando las láminas');
    await correr(PYTHON, ['generar.py', json, pptx], { cwd: DECK_DIR });
    fase('Dibujando la vista previa');
    await enCola(() =>
      correr('soffice', [`-env:UserInstallation=${LO_PERFIL}`, '--headless', '--convert-to', 'pdf', '--outdir', tmp, pptx], {
        cwd: tmp,
        env: { ...process.env, HOME: tmp },
      })
    );
    await correr('pdftoppm', ['-jpeg', '-jpegopt', 'quality=80', '-scale-to-x', '1600', '-scale-to-y', '-1',
      path.join(tmp, 'presentacion.pdf'), path.join(tmp, 'l')]);
    await rm(path.join(tmp, 'presentacion.pdf'), { force: true });
    await rm(json, { force: true });
    const laminas = (await readdir(tmp)).filter((f) => /^l-\d+\.jpg$/.test(f)).length;
    await writeFile(path.join(tmp, 'meta.json'), JSON.stringify({
      at: new Date().toISOString(), laminas, productos: config.productos, por: user.nombre || user.email,
    }));
    // Reemplaza el borrador anterior de un solo movimiento.
    const destino = dirVista(pais.codigo, 'borrador');
    await mkdir(path.dirname(destino), { recursive: true });
    await rm(destino, { recursive: true, force: true });
    await rename(tmp, destino);
    registrarActividad(req, { actor: user, accion: 'presentacion_borrador', detalle: `${pais.nombre} (${laminas} láminas)` });
    trabajos.set(pais.codigo, { estado: 'listo', fin: new Date().toISOString() });
  } catch (err) {
    console.error('[presentaciones] error al generar', pais.codigo, err);
    trabajos.set(pais.codigo, { estado: 'error', error: 'No se pudo generar la presentación. ' + String(err.message || '').slice(0, 300) });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// Guarda lo que haya en pantalla y genera el borrador con eso.
router.post('/:pais/generar', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  if (trabajos.get(pais.codigo)?.estado === 'generando') {
    return res.status(409).json({ error: 'Ya se está generando la presentación de este país.' });
  }
  const config = guardar(pais, req.body, req.user);
  if (config.productos.length === 0) return res.status(400).json({ error: 'Elige al menos un producto.' });
  trabajos.set(pais.codigo, { estado: 'generando', inicio: new Date().toISOString(), fase: 'Empezando' });
  generar(pais, config, req.user, req);
  res.status(202).json({ trabajo: trabajos.get(pais.codigo) });
});

router.get('/:pais/estado', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  res.json({ trabajo: trabajos.get(pais.codigo) ?? null });
});

// Presentación vigente del país en Material Comercial: la que publicó el
// gestor o, antes de usarlo, la subida a mano con el mismo nombre.
function archivoPublicado(pais) {
  const id = db.prepare('SELECT archivo_id FROM presentaciones_pais WHERE pais = ?').get(pais.codigo)?.archivo_id;
  const sel = 'SELECT id, nombre, tamano, created_at, archivo FROM marca_archivos';
  return (
    (id && db.prepare(`${sel} WHERE id = ?`).get(id)) ||
    db.prepare(`${sel} WHERE pais = ? AND categoria = 'presentaciones' AND nombre = ? ORDER BY id DESC`).get(pais.codigo, nombrePptx(pais.codigo)) ||
    null
  );
}

router.get('/:pais/vista', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  const archivo = archivoPublicado(pais);
  res.json({
    pais,
    trabajo: trabajos.get(pais.codigo) ?? null,
    borrador: leerMeta(pais.codigo, 'borrador'),
    publicada: archivo
      ? { ...leerMeta(pais.codigo, 'publicada'), archivo: { id: archivo.id, nombre: archivo.nombre, tamano: archivo.tamano, created_at: archivo.created_at } }
      : null,
  });
});

router.get('/:pais/vista/:tipo/:n', (req, res, next) => {
  const pais = paisValido(req.params.pais);
  const { tipo } = req.params;
  const n = Number(req.params.n);
  if (!pais || !['borrador', 'publicada'].includes(tipo) || !Number.isInteger(n) || n < 1 || n > 200) {
    return res.status(404).json({ error: 'Lámina no encontrada' });
  }
  const meta = leerMeta(pais.codigo, tipo);
  if (!meta || n > meta.laminas) return res.status(404).json({ error: 'Lámina no encontrada' });
  // pdftoppm rellena con ceros según el total: l-1.jpg, l-01.jpg o l-001.jpg.
  const ancho = String(meta.laminas).length;
  res.set('Cache-Control', 'private, no-cache');
  res.type('image/jpeg').sendFile(path.join(dirVista(pais.codigo, tipo), `l-${String(n).padStart(ancho, '0')}.jpg`), (err) => {
    if (err && !res.headersSent) next(err);
  });
});

router.get('/:pais/borrador/descargar', (req, res, next) => {
  const pais = paisValido(req.params.pais);
  if (!pais || !leerMeta(pais.codigo, 'borrador')) return res.status(404).json({ error: 'No hay borrador' });
  res.download(path.join(dirVista(pais.codigo, 'borrador'), 'presentacion.pptx'), nombrePptx(pais.codigo).replace('.pptx', '_borrador.pptx'), (err) => {
    if (err && !res.headersSent) next(err);
  });
});

// Pasa el borrador a Material Comercial y reemplaza la presentación vigente.
router.post('/:pais/publicar', async (req, res, next) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  const meta = leerMeta(pais.codigo, 'borrador');
  if (!meta) return res.status(400).json({ error: 'No hay un borrador para publicar. Genéralo desde el Gestor.' });
  if (trabajos.get(pais.codigo)?.estado === 'generando') {
    return res.status(409).json({ error: 'Se está generando un borrador nuevo; espera a que termine.' });
  }
  const borrador = dirVista(pais.codigo, 'borrador');
  const archivo = `${crypto.randomUUID()}.pptx`;
  try {
    await mkdir(MARCA_DIR, { recursive: true });
    await copyFile(path.join(borrador, 'presentacion.pptx'), path.join(MARCA_DIR, archivo));
    const { size } = await stat(path.join(MARCA_DIR, archivo));
    const viejo = archivoPublicado(pais);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO marca_archivos (pais, categoria, nombre, descripcion, archivo, mime, tamano, subido_por)
         VALUES (?, 'presentaciones', ?, ?, ?, ?, ?, ?)`
      )
      .run(pais.codigo, nombrePptx(pais.codigo), `${meta.laminas} láminas · Gestor de presentaciones`, archivo,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', size, req.user.id);
    db.prepare(
      `INSERT INTO presentaciones_pais (pais, productos, datos, archivo_id, actualizado_por) VALUES (?, '[]', '{}', ?, ?)
       ON CONFLICT(pais) DO UPDATE SET archivo_id = excluded.archivo_id`
    ).run(pais.codigo, lastInsertRowid, req.user.id);
    if (viejo) {
      db.prepare('DELETE FROM marca_archivos WHERE id = ?').run(viejo.id);
      await rm(path.join(MARCA_DIR, viejo.archivo), { force: true });
    }
    // Las imágenes del borrador pasan a ser las de lo publicado.
    const publicada = dirVista(pais.codigo, 'publicada');
    await rm(publicada, { recursive: true, force: true });
    await rm(path.join(borrador, 'presentacion.pptx'), { force: true });
    await rename(borrador, publicada);
    registrarActividad(req, { actor: req.user, accion: 'presentacion_publicar', detalle: `${pais.nombre} (${meta.laminas} láminas)` });
    res.json({ ok: true, archivo_id: lastInsertRowid });
  } catch (err) {
    await rm(path.join(MARCA_DIR, archivo), { force: true });
    next(err);
  }
});

export default router;
