import { google } from 'googleapis';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// TODO: crear el Sheet de agencia con una pestaña por cada `tab` listado abajo
// (nombre exacto, sensible a mayúsculas/minúsculas) y compartirlo con el email
// de la service account.
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
  path.join(__dirname, '..', 'secrets', 'google-service-account.json');

// Un bloque por canal: cada `tab` es una pestaña del Sheet, `file`/`key` dicen
// en qué archivo y bajo qué clave de src/data/<canal>/ va el resultado, y
// `shape` dice cómo interpretar las filas (objeto único vs. lista de objetos).
const CANALES = [
  { canal: 'ctvOtt', prefix: 'CTV_OTT' },
  { canal: 'programatico', prefix: 'Programatico' },
  { canal: 'pushNotification', prefix: 'PushNotification' },
  { canal: 'tiktok', prefix: 'TikTok' },
  { canal: 'youtube', prefix: 'YouTube' },
];

function buildTargetsForCanal({ canal, prefix }) {
  return [
    { tab: `${prefix}_KPIs`, file: 'resumen.json', key: 'kpis', shape: 'object' },
    { tab: `${prefix}_Mensual`, file: 'resumen.json', key: 'mensual', shape: 'list' },
    { tab: `${prefix}_PorCampana`, file: 'rendimientoDiario.json', key: 'porCampana', shape: 'list' },
    { tab: `${prefix}_PorPublisher`, file: 'rendimientoDiario.json', key: 'porPublisher', shape: 'list' },
    { tab: `${prefix}_Testigo`, file: 'rendimientoDiario.json', key: 'testigo', shape: 'list' },
    { tab: `${prefix}_Ciudades`, file: 'ciudades.json', key: null, shape: 'list' },
    { tab: `${prefix}_Dispositivos`, file: 'dispositivos.json', key: null, shape: 'list' },
  ].map((t) => ({ ...t, spreadsheetId: SPREADSHEET_ID, outDir: path.join(DATA_DIR, canal) }));
}

// Tab global (no vive dentro de un canal específico).
const GLOBAL_TARGETS = [
  { tab: 'CampanasServidas', file: 'campanasServidas.json', key: null, shape: 'list', spreadsheetId: SPREADSHEET_ID, outDir: DATA_DIR },
];

// Cada cliente (rol Cliente en el panel) tiene su propio Sheet -- mismo
// nombre de pestañas por canal que el Sheet de agencia, pero ya conteniendo
// solo los datos de ese cliente, sin necesidad de una columna `anunciante`.
// KPIs/Mensual/Ciudades/Dispositivos/PorPublisher salen de ahí; PorCampana,
// PorPublisher (rendimiento diario campaña) y Testigo del cliente NO se
// sincronizan aparte -- el backend los deriva filtrando el Sheet de agencia.
function buildTargetsForCliente(cliente, { canal, prefix }) {
  const outDir = path.join(DATA_DIR, 'clientes', String(cliente.id), canal);
  return [
    { tab: `${prefix}_KPIs`, file: 'resumen.json', key: 'kpis', shape: 'object' },
    { tab: `${prefix}_Mensual`, file: 'resumen.json', key: 'mensual', shape: 'list' },
    { tab: `${prefix}_Ciudades`, file: 'ciudades.json', key: null, shape: 'list' },
    { tab: `${prefix}_Dispositivos`, file: 'dispositivos.json', key: null, shape: 'list' },
    { tab: `${prefix}_PorPublisher`, file: 'porPublisher.json', key: null, shape: 'list' },
  ].map((t) => ({ ...t, spreadsheetId: cliente.sheet_id, outDir }));
}

function getClientesConSheet() {
  return db.prepare('SELECT id, nombre, sheet_id FROM clientes WHERE activo = 1 AND sheet_id IS NOT NULL').all();
}

function buildAllTargets() {
  const clientesTargets = getClientesConSheet().flatMap((cliente) =>
    CANALES.flatMap((canal) => buildTargetsForCliente(cliente, canal))
  );
  return [...CANALES.flatMap(buildTargetsForCanal), ...GLOBAL_TARGETS, ...clientesTargets];
}

function coerceValue(raw) {
  if (raw === undefined || raw === null) return '';
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const obj = {};
      headerRow.forEach((header, i) => {
        obj[header.trim()] = coerceValue(row[i]);
      });
      return obj;
    });
}

async function fetchTabRows(sheets, spreadsheetId, tab) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tab });
  return res.data.values || [];
}

// Agrupa los targets por archivo destino para poder mezclar varias claves
// (ej. kpis + mensual -> resumen.json) antes de escribir un solo JSON por archivo.
function groupByOutputFile(results) {
  const byFile = new Map();
  for (const r of results) {
    if (!r.ok) continue;
    const outPath = path.join(r.outDir, r.file);
    if (!byFile.has(outPath)) byFile.set(outPath, {});
    const entry = byFile.get(outPath);
    if (r.key) {
      entry[r.key] = r.shape === 'object' ? (r.data[0] || {}) : r.data;
    } else {
      byFile.set(outPath, r.data); // archivo es un array plano, no un objeto con keys
    }
  }
  return byFile;
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('Falta SHEETS_SPREADSHEET_ID en el entorno. Abortando sin tocar los JSON existentes.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const allTargets = buildAllTargets();
  const results = [];
  for (const target of allTargets) {
    if (!target.spreadsheetId) {
      // Cliente activo sin sheet_id configurado todavía: se salta en silencio,
      // no es un error de sync (falta configuración, no falta de acceso).
      continue;
    }
    try {
      const rows = await fetchTabRows(sheets, target.spreadsheetId, target.tab);
      results.push({ ...target, ok: true, data: rowsToObjects(rows) });
    } catch (err) {
      // Si una pestaña falla (no existe, sin permiso, etc.), se salta y se
      // conserva el JSON actual para ese archivo -- nunca se deja el panel vacío.
      console.error(`[sync] Error leyendo la pestaña "${target.tab}" (${target.spreadsheetId}): ${err.message}`);
      results.push({ ...target, ok: false });
    }
  }

  const byFile = groupByOutputFile(results);
  let written = 0;
  for (const [outPath, data] of byFile.entries()) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    written += 1;
    console.log(`[sync] Actualizado ${path.relative(process.cwd(), outPath)}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`[sync] Listo: ${written} archivo(s) actualizados, ${failed} pestaña(s) con error.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[sync] Error inesperado, no se modificó ningún JSON:', err);
  process.exit(1);
});
