import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { requireUser, requireSuperAdmin } from './middleware.js';
import { registrarActividad } from './activityLog.js';
import { CAMPOS_PRESENTACION, PRODUCTOS_PRESENTACION, datosIniciales } from '../shared/presentaciones.js';
import db from './db.js';

// Admin > Material Comercial > Gestor de presentaciones (solo Super Admin).
// Cada país guarda qué productos vende (y en qué orden) y sus datos
// editables; "Generar" arma el .pptx con el generador Python (fuera del
// repo, en PRESENTACIONES_DIR: imágenes y videos pesan cientos de MB) y lo
// publica en Material Comercial del país, reemplazando la versión anterior.
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

// ---- Generación ----------------------------------------------------------------
// Tarda ~15-30 s (arma láminas y embebe ~20 videos), más que el timeout de
// nginx: se lanza en segundo plano y la pantalla consulta el estado. Un
// trabajo por país; vive en memoria (si el backend se reinicia a mitad, la
// pantalla simplemente deja de verlo "generando" y se vuelve a lanzar).
const trabajos = new Map();

function correrGenerador(json, salida) {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, ['generar.py', json, salida], { cwd: DECK_DIR });
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
      else reject(new Error(err.trim().split('\n').pop() || `El generador terminó con código ${code}`));
    });
  });
}

async function generar(pais, config, user, req) {
  const id = crypto.randomUUID();
  const tmp = path.join(PRESENTACIONES_DIR, 'tmp');
  const json = path.join(tmp, `${id}.json`);
  const archivo = `${id}.pptx`;
  const destino = path.join(MARCA_DIR, archivo);
  try {
    await mkdir(tmp, { recursive: true });
    await mkdir(MARCA_DIR, { recursive: true });
    await writeFile(json, JSON.stringify({ productos: config.productos, datos: config.datos }));
    await correrGenerador(json, destino);
    const { size } = await stat(destino);
    const nombre = `${pais.codigo}_Mediaudience_Presentacion-Comercial_Signal_2026.pptx`;
    const anterior = db.prepare('SELECT archivo_id FROM presentaciones_pais WHERE pais = ?').get(pais.codigo)?.archivo_id;
    // Primera vez: reemplaza la que se subió a mano con el mismo nombre (Perú).
    const viejo = anterior
      ? db.prepare('SELECT * FROM marca_archivos WHERE id = ?').get(anterior)
      : db.prepare("SELECT * FROM marca_archivos WHERE pais = ? AND categoria = 'presentaciones' AND nombre = ?").get(pais.codigo, nombre);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO marca_archivos (pais, categoria, nombre, descripcion, archivo, mime, tamano, subido_por)
         VALUES (?, 'presentaciones', ?, ?, ?, ?, ?, ?)`
      )
      .run(pais.codigo, nombre, 'Generada con el Gestor de presentaciones', archivo,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', size, user.id);
    db.prepare('UPDATE presentaciones_pais SET archivo_id = ? WHERE pais = ?').run(lastInsertRowid, pais.codigo);
    // La versión anterior se reemplaza: así en Material Comercial hay una
    // sola presentación vigente por país.
    if (viejo) {
      db.prepare('DELETE FROM marca_archivos WHERE id = ?').run(viejo.id);
      await rm(path.join(MARCA_DIR, viejo.archivo), { force: true });
    }
    registrarActividad(req, { actor: user, accion: 'presentacion_generar', detalle: `${pais.nombre} (${config.productos.length} productos)` });
    trabajos.set(pais.codigo, { estado: 'listo', archivo_id: lastInsertRowid, fin: new Date().toISOString() });
  } catch (err) {
    await rm(destino, { force: true });
    console.error('[presentaciones] error al generar', pais.codigo, err);
    trabajos.set(pais.codigo, { estado: 'error', error: 'No se pudo generar la presentación. ' + String(err.message || '').slice(0, 300) });
  } finally {
    await rm(json, { force: true });
  }
}

// Guarda lo que haya en pantalla y genera con eso.
router.post('/:pais/generar', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  if (trabajos.get(pais.codigo)?.estado === 'generando') {
    return res.status(409).json({ error: 'Ya se está generando la presentación de este país.' });
  }
  const config = guardar(pais, req.body, req.user);
  if (config.productos.length === 0) return res.status(400).json({ error: 'Elige al menos un producto.' });
  trabajos.set(pais.codigo, { estado: 'generando', inicio: new Date().toISOString() });
  generar(pais, config, req.user, req);
  res.status(202).json({ trabajo: trabajos.get(pais.codigo) });
});

router.get('/:pais/estado', (req, res) => {
  const pais = paisValido(req.params.pais);
  if (!pais) return res.status(404).json({ error: 'País no encontrado' });
  const trabajo = trabajos.get(pais.codigo) ?? null;
  const archivo = trabajo?.archivo_id
    ? db.prepare('SELECT id, nombre, tamano, created_at FROM marca_archivos WHERE id = ?').get(trabajo.archivo_id)
    : null;
  res.json({ trabajo, archivo });
});

export default router;
