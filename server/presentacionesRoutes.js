import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { requireUser, requireSuperAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { CAMPOS_PRESENTACION, PRODUCTOS_PRESENTACION, datosIniciales } from '../shared/presentaciones.js';
import { accedeMaterial, puedeVerMaterial } from '../shared/marca.js';
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
router.use(requireUser);

// Presentar (pedido de Jose 2026-10-28): quien abre Material Comercial puede
// ver, presentar y bajar la presentación PUBLICADA de los países que le tocan
// (Admin todos; Manager y Ejecutivo Comercial solo el suyo). Gestor,
// borradores y Publicar siguen siendo solo de Super Admin.
const LECTURA = /^\/(?:([^/]+)\/vista(?:\/publicada(?:-compacta)?\/(?:[^/]+|video\/[^/]+))?)?\/?$/;
router.use((req, res, next) => {
  if (req.user.rol === 'super_admin') return next();
  const m = req.method === 'GET' ? req.path.match(LECTURA) : null;
  if (!m || !accedeMaterial(req.user) || (m[1] && !puedeVerMaterial(req.user, m[1]))) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  req.soloPublicada = true;
  next();
});

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
    return { productos: pais.codigo === 'PE' ? b.productos : [], datos: datosIniciales(b.datos, pais), compacta: [], guardado: false };
  }
  // Un campo nuevo en el catálogo que este país todavía no tiene arranca
  // con el valor inicial, sin pisar lo que ya editaron.
  const datos = { ...datosIniciales(b.datos, pais), ...JSON.parse(fila.datos) };
  return {
    productos: JSON.parse(fila.productos),
    datos,
    compacta: fila.compacta ? JSON.parse(fila.compacta) : [],
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
    paises: paises.filter((p) => !req.soloPublicada || puedeVerMaterial(req.user, p.codigo)).map((p) => ({
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

// Versión compacta (pedido de Jose 2026-10-27): él elige qué láminas de la
// completa van, por su clave en laminas.json ("intro-1", "push-2"...). Si la
// pantalla no la manda, queda la que estaba.
function limpiarCompacta(v) {
  return listaDe(v, 200)
    .map((c) => texto(c, 40))
    .filter((c, i, arr) => /^[a-z]+-\d+$/.test(c) && arr.indexOf(c) === i);
}

function guardar(pais, body, user) {
  const productos = listaDe(body?.productos, CLAVES_PRODUCTO.length).filter(
    (p, i, arr) => CLAVES_PRODUCTO.includes(p) && arr.indexOf(p) === i
  );
  const actual = configDe(pais);
  const datos = { ...actual.datos, ...limpiarDatos(body?.datos) };
  const compacta = Array.isArray(body?.compacta) ? limpiarCompacta(body.compacta) : actual.compacta;
  db.prepare(
    `INSERT INTO presentaciones_pais (pais, productos, datos, compacta, actualizado_por, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(pais) DO UPDATE SET productos = excluded.productos, datos = excluded.datos, compacta = excluded.compacta,
       actualizado_por = excluded.actualizado_por, updated_at = excluded.updated_at`
  ).run(pais.codigo, JSON.stringify(productos), JSON.stringify(datos), JSON.stringify(compacta), user.id);
  return { productos, datos, compacta };
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

// La compacta tiene sus propias carpetas (borrador-compacta, publicada-compacta).
const TIPOS = ['borrador', 'publicada', 'borrador-compacta', 'publicada-compacta'];
const dirVista = (pais, tipo) => path.join(VISTAS_DIR, pais, tipo);
const nombrePptx = (pais, compacta = false) =>
  `${pais}_Mediaudience_Presentacion-Comercial_Signal_2026${compacta ? '_Compacta' : ''}.pptx`;

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

// Videos, imágenes de vista previa, paquete sin internet y meta.json de una
// versión (completa o compacta) ya generada en `dir`/presentacion.pptx.
async function prepararVista(dir, titulo, meta) {
  const pptx = path.join(dir, 'presentacion.pptx');
  // Videos aparte (con su posición en la lámina) para el modo Presentar.
  await correr(PYTHON, ['extraer_videos.py', pptx, dir], { cwd: DECK_DIR });
  await enCola(() =>
    correr('soffice', [`-env:UserInstallation=${LO_PERFIL}`, '--headless', '--convert-to', 'pdf', '--outdir', dir, pptx], {
      cwd: dir,
      env: { ...process.env, HOME: dir },
    })
  );
  // 2560 px y calidad alta: en el modo Presentar se ven a pantalla completa, también en pantallas retina.
  await correr('pdftoppm', ['-jpeg', '-jpegopt', 'quality=90', '-scale-to-x', '2560', '-scale-to-y', '-1',
    path.join(dir, 'presentacion.pdf'), path.join(dir, 'l')]);
  await rm(path.join(dir, 'presentacion.pdf'), { force: true });
  // Paquete para presentar sin internet (ZIP con un reproductor HTML, las láminas y los videos).
  await correr(PYTHON, ['paquete_offline.py', dir, titulo], { cwd: DECK_DIR });
  const laminas = (await readdir(dir)).filter((f) => /^l-\d+\.jpg$/.test(f)).length;
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ at: new Date().toISOString(), laminas, ...meta }));
  return laminas;
}

async function existe(ruta) {
  return stat(ruta).then(() => true, () => false);
}

async function generar(pais, config, user, req) {
  const id = crypto.randomUUID();
  const tmp = path.join(PRESENTACIONES_DIR, 'tmp', id);
  const tmpCompacta = `${tmp}-compacta`;
  const fase = (texto) => trabajos.set(pais.codigo, { ...trabajos.get(pais.codigo), fase: texto });
  try {
    await mkdir(tmp, { recursive: true });
    await mkdir(tmpCompacta, { recursive: true });
    const json = path.join(tmp, 'datos.json');
    await writeFile(json, JSON.stringify({ productos: config.productos, datos: config.datos, compacta: config.compacta }));
    fase('Armando las láminas');
    await correr(PYTHON, ['generar.py', json, path.join(tmp, 'presentacion.pptx'), path.join(tmpCompacta, 'presentacion.pptx')],
      { cwd: DECK_DIR });
    await rm(json, { force: true });
    const por = user.nombre || user.email;
    fase('Dibujando la vista previa');
    const laminas = await prepararVista(tmp, `Mediaudience ${pais.nombre}`, { productos: config.productos, por });
    // Sin láminas elegidas el generador no arma la compacta.
    const hayCompacta = await existe(path.join(tmpCompacta, 'presentacion.pptx'));
    if (hayCompacta) {
      fase('Dibujando la versión compacta');
      await prepararVista(tmpCompacta, `Mediaudience ${pais.nombre} · Compacta`, { productos: config.productos, por, compacta: true });
    }
    // Reemplaza el borrador anterior (y su compacta) de un solo movimiento.
    const destino = dirVista(pais.codigo, 'borrador');
    const destinoCompacta = dirVista(pais.codigo, 'borrador-compacta');
    await mkdir(path.dirname(destino), { recursive: true });
    await rm(destino, { recursive: true, force: true });
    await rm(destinoCompacta, { recursive: true, force: true });
    await rename(tmp, destino);
    if (hayCompacta) await rename(tmpCompacta, destinoCompacta);
    registrarActividad(req, { actor: user, accion: 'presentacion_borrador', detalle: `${pais.nombre} (${laminas} láminas)` });
    trabajos.set(pais.codigo, { estado: 'listo', fin: new Date().toISOString() });
  } catch (err) {
    console.error('[presentaciones] error al generar', pais.codigo, err);
    trabajos.set(pais.codigo, { estado: 'error', error: 'No se pudo generar la presentación. ' + String(err.message || '').slice(0, 300) });
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(tmpCompacta, { recursive: true, force: true });
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
function archivoPublicado(pais, compacta = false) {
  const fila = db.prepare('SELECT archivo_id, archivo_compacta_id FROM presentaciones_pais WHERE pais = ?').get(pais.codigo);
  const id = compacta ? fila?.archivo_compacta_id : fila?.archivo_id;
  const sel = 'SELECT id, nombre, tamano, created_at, archivo FROM marca_archivos';
  return (
    (id && db.prepare(`${sel} WHERE id = ?`).get(id)) ||
    db.prepare(`${sel} WHERE pais = ? AND categoria = 'presentaciones' AND nombre = ? ORDER BY id DESC`)
      .get(pais.codigo, nombrePptx(pais.codigo, compacta)) ||
    null
  );
}

const conArchivo = (meta, a) =>
  a ? { ...meta, archivo: { id: a.id, nombre: a.nombre, tamano: a.tamano, created_at: a.created_at } } : null;

router.get('/:pais/vista', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  if (req.soloPublicada) {
    return res.json({
      pais,
      publicada: conArchivo(leerMeta(pais.codigo, 'publicada'), archivoPublicado(pais)),
      'publicada-compacta': conArchivo(leerMeta(pais.codigo, 'publicada-compacta'), archivoPublicado(pais, true)),
    });
  }
  res.json({
    pais,
    trabajo: trabajos.get(pais.codigo) ?? null,
    borrador: leerMeta(pais.codigo, 'borrador'),
    publicada: conArchivo(leerMeta(pais.codigo, 'publicada'), archivoPublicado(pais)),
    'borrador-compacta': leerMeta(pais.codigo, 'borrador-compacta'),
    'publicada-compacta': conArchivo(leerMeta(pais.codigo, 'publicada-compacta'), archivoPublicado(pais, true)),
  });
});

router.get('/:pais/vista/:tipo/:n', (req, res, next) => {
  // "videos.json" también cae en este patrón: que siga a su propia ruta.
  if (!/^\d+$/.test(req.params.n)) return next();
  const pais = paisValido(req.params.pais);
  const { tipo } = req.params;
  const n = Number(req.params.n);
  if (!pais || !TIPOS.includes(tipo) || !Number.isInteger(n) || n < 1 || n > 200) {
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

// Índice de láminas (clave, producto, título) para elegir la compacta.
router.get('/:pais/vista/:tipo/laminas.json', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais || !TIPOS.includes(req.params.tipo)) return res.status(404).json({ error: 'No encontrado' });
  try {
    res.json(JSON.parse(readFileSync(path.join(dirVista(pais.codigo, req.params.tipo), 'laminas.json'), 'utf8')));
  } catch {
    res.json([]);
  }
});

// Modo Presentar: posiciones de los videos por lámina y los videos en sí.
router.get('/:pais/vista/:tipo/videos.json', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais || !TIPOS.includes(req.params.tipo)) return res.status(404).json({ error: 'No encontrado' });
  try {
    res.json(JSON.parse(readFileSync(path.join(dirVista(pais.codigo, req.params.tipo), 'videos.json'), 'utf8')));
  } catch {
    res.json({});
  }
});

router.get('/:pais/vista/:tipo/video/:archivo', (req, res, next) => {
  const pais = paisValido(req.params.pais);
  const { tipo, archivo } = req.params;
  if (!pais || !TIPOS.includes(tipo) || !/^v_[0-9a-f]{8}\.mp4$/.test(archivo)) {
    return res.status(404).json({ error: 'Video no encontrado' });
  }
  res.set('Cache-Control', 'private, max-age=3600');
  res.type('video/mp4').sendFile(path.join(dirVista(pais.codigo, tipo), 'videos', archivo), (err) => {
    if (err && !res.headersSent) next(err);
  });
});

router.get('/:pais/vista/:tipo/offline', (req, res, next) => {
  const pais = paisValido(req.params.pais);
  if (!pais || !TIPOS.includes(req.params.tipo)) return res.status(404).json({ error: 'No encontrado' });
  res.download(path.join(dirVista(pais.codigo, req.params.tipo), 'offline.zip'),
    `Mediaudience_${pais.codigo}${req.params.tipo.endsWith('-compacta') ? '_compacta' : ''}_presentar_sin_internet.zip`, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Todavía no hay paquete sin internet: vuelve a generar la presentación.' });
    });
});

// ?compacta=1 baja el borrador de la versión compacta.
router.get('/:pais/borrador/descargar', (req, res, next) => {
  const pais = paisValido(req.params.pais);
  const compacta = req.query.compacta === '1';
  const tipo = compacta ? 'borrador-compacta' : 'borrador';
  if (!pais || !leerMeta(pais.codigo, tipo)) return res.status(404).json({ error: 'No hay borrador' });
  res.download(path.join(dirVista(pais.codigo, tipo), 'presentacion.pptx'), nombrePptx(pais.codigo, compacta).replace('.pptx', '_borrador.pptx'), (err) => {
    if (err && !res.headersSent) next(err);
  });
});

// Pasa un borrador (completa o compacta) a Material Comercial, reemplazando la
// versión vigente del país, y mueve sus imágenes a la vista publicada.
async function publicarVersion(pais, compacta, user) {
  const sufijo = compacta ? '-compacta' : '';
  const meta = leerMeta(pais.codigo, `borrador${sufijo}`);
  const viejo = archivoPublicado(pais, compacta);
  const columna = compacta ? 'archivo_compacta_id' : 'archivo_id';
  const publicada = dirVista(pais.codigo, `publicada${sufijo}`);
  if (!meta) {
    // La completa sin borrador no se publica. Una compacta sin borrador es que
    // se quitaron todas sus láminas: se retira la que estaba publicada.
    if (compacta && viejo) {
      db.prepare('DELETE FROM marca_archivos WHERE id = ?').run(viejo.id);
      db.prepare('UPDATE presentaciones_pais SET archivo_compacta_id = NULL WHERE pais = ?').run(pais.codigo);
      await rm(path.join(MARCA_DIR, viejo.archivo), { force: true });
      await rm(publicada, { recursive: true, force: true });
    }
    return null;
  }
  const borrador = dirVista(pais.codigo, `borrador${sufijo}`);
  const archivo = `${crypto.randomUUID()}.pptx`;
  try {
    await mkdir(MARCA_DIR, { recursive: true });
    await copyFile(path.join(borrador, 'presentacion.pptx'), path.join(MARCA_DIR, archivo));
    const { size } = await stat(path.join(MARCA_DIR, archivo));
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO marca_archivos (pais, categoria, nombre, descripcion, archivo, mime, tamano, subido_por)
         VALUES (?, 'presentaciones', ?, ?, ?, ?, ?, ?)`
      )
      .run(pais.codigo, nombrePptx(pais.codigo, compacta),
        `${compacta ? 'Versión compacta · ' : ''}${meta.laminas} láminas · Gestor de presentaciones`, archivo,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', size, user.id);
    db.prepare(
      `INSERT INTO presentaciones_pais (pais, productos, datos, ${columna}, actualizado_por) VALUES (?, '[]', '{}', ?, ?)
       ON CONFLICT(pais) DO UPDATE SET ${columna} = excluded.${columna}`
    ).run(pais.codigo, lastInsertRowid, user.id);
    if (viejo) {
      db.prepare('DELETE FROM marca_archivos WHERE id = ?').run(viejo.id);
      await rm(path.join(MARCA_DIR, viejo.archivo), { force: true });
    }
    await rm(publicada, { recursive: true, force: true });
    await rm(path.join(borrador, 'presentacion.pptx'), { force: true });
    await rename(borrador, publicada);
    return { id: lastInsertRowid, laminas: meta.laminas };
  } catch (err) {
    await rm(path.join(MARCA_DIR, archivo), { force: true });
    throw err;
  }
}

// Publica la completa y, si la hay, la compacta.
router.post('/:pais/publicar', async (req, res, next) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  if (!leerMeta(pais.codigo, 'borrador')) {
    return res.status(400).json({ error: 'No hay un borrador para publicar. Genéralo desde el Gestor.' });
  }
  if (trabajos.get(pais.codigo)?.estado === 'generando') {
    return res.status(409).json({ error: 'Se está generando un borrador nuevo; espera a que termine.' });
  }
  try {
    const completa = await publicarVersion(pais, false, req.user);
    const compacta = await publicarVersion(pais, true, req.user);
    registrarActividad(req, {
      actor: req.user,
      accion: 'presentacion_publicar',
      detalle: `${pais.nombre} (${completa.laminas} láminas${compacta ? ` + compacta de ${compacta.laminas}` : ''})`,
    });
    res.json({ ok: true, archivo_id: completa.id, archivo_compacta_id: compacta?.id ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;
