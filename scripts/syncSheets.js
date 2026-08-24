import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../server/db.js';
import { CANAL_METRICAS } from '../src/config/canalMetricas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const CREDENTIALS_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'secrets', 'google-service-account.json');

// -------- Lectura de pestañas: cuenta de servicio si existe, si no CSV público --------

let sheetsClient = null;
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// Parser CSV mínimo (soporta comillas y comas dentro de campos, que es lo que
// exporta Sheets cuando un valor como "61,17%" trae coma).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some((v) => v !== '')) rows.push(row); }
  return rows;
}

async function fetchTabRowsPublicCsv(spreadsheetId, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer la pestaña "${tab}" (HTTP ${res.status}). ¿El Sheet está compartido como "Cualquiera con el enlace"?`);
  return parseCsv(await res.text());
}

async function fetchTabRowsServiceAccount(spreadsheetId, tab) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tab });
  return res.data.values || [];
}

async function fetchTabRows(spreadsheetId, tab) {
  if (existsSync(CREDENTIALS_PATH)) return fetchTabRowsServiceAccount(spreadsheetId, tab);
  return fetchTabRowsPublicCsv(spreadsheetId, tab);
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  return data
    .filter((r) => r.some((v) => String(v ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// -------- Parseo de valores en formato es-PE que usan los Sheets, dirigido
// por el `type` declarado en src/config/canalMetricas.js --------

function parseNumeroEs(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  let s = String(raw).trim().replace('%', '');
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseInt(s.replace(/\./g, ''), 10) || 0;
}

// Distintos Sheets de cliente separan la fecha con "/" (ej. CTV-OTT/YouTube,
// "2/06/2026") o con "-" (ej. Programático, "05-01-2026") -- ambos DD/MM/YYYY,
// solo cambia el separador, así que se acepta cualquiera de los dos.
function parseFechaEs(raw) {
  const [d, m, y] = String(raw).trim().split(/[/-]/);
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseValor(raw, type) {
  switch (type) {
    case 'numero':
      return parseNumeroEs(raw);
    case 'moneda':
      return parseNumeroEs(String(raw ?? '').replace(/[^0-9.,-]/g, ''));
    case 'porcentaje':
      return Math.round(parseNumeroEs(raw));
    case 'fecha':
      return parseFechaEs(raw);
    case 'link':
      return raw || '';
    case 'texto':
    default:
      return String(raw ?? '').trim();
  }
}

// Convierte las filas crudas de una pestaña (ya con Object.fromEntries por
// encabezado) a la forma declarada en `campos` -- reemplaza los
// transformDiario/Publisher/Device/Geo/Testigo hardcodeados de antes: ahora
// cada canal declara sus propios campos en src/config/canalMetricas.js y este
// parser es el único que hace falta para los 5 servicios.
function parseFilas(rows, campos) {
  return rowsToObjects(rows).map((r) =>
    Object.fromEntries(campos.map((c) => [c.key, parseValor(r[c.header], c.type)]))
  );
}

// -------- Escritura de archivos --------

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

function getClientesConCanales() {
  return db
    .prepare(
      `SELECT cliente_canales.cliente_id AS clienteId, clientes.nombre AS clienteNombre,
              cliente_canales.canal AS canal, cliente_canales.sheet_id AS sheetId
       FROM cliente_canales
       JOIN clientes ON clientes.id = cliente_canales.cliente_id
       WHERE clientes.activo = 1 AND cliente_canales.sheet_id IS NOT NULL`
    )
    .all();
}

// slug de canal (como en cliente_canales) -> carpeta real bajo src/data.
// Viene de la tabla `canales` (ver server/db.js), no de una lista fija, para
// que un servicio nuevo creado por un Super Admin se sincronice sin tocar
// este script (siempre que también se le agregue su entrada en canalMetricas.js).
const CANAL_DIR = Object.fromEntries(
  db.prepare('SELECT slug, dir FROM canales').all().map((r) => [r.slug, r.dir])
);

async function syncClienteCanal({ clienteId, clienteNombre, canal, sheetId }) {
  const canalDir = CANAL_DIR[canal];
  const metricas = CANAL_METRICAS[canal];
  if (!metricas) {
    console.log(`Sin config en canalMetricas.js todavía para "${canal}" -- se omite ${clienteNombre}.`);
    return null;
  }

  console.log(`Sincronizando ${clienteNombre} / ${canal} (${sheetId})...`);

  const tabKeys = Object.keys(metricas.sheetTabs);
  const rowsPorTab = await Promise.all(
    tabKeys.map((key) => fetchTabRows(sheetId, metricas.sheetTabs[key].nombre))
  );

  // `cliente` se agrega a cada fila (no viene del Sheet) para que, en la
  // vista agregada de Admin/Super Admin -- que combina todos los clientes de
  // un canal en un solo dataset --, se pueda filtrar por cliente además de
  // por anunciante/campaña. Necesario porque anunciante no siempre equivale
  // a cliente (un cliente puede agrupar varias marcas, ver
  // [[project_mediaudience_permisos_finos]]).
  const datasets = {};
  tabKeys.forEach((key, i) => {
    datasets[key] = parseFilas(rowsPorTab[i], metricas.sheetTabs[key].campos).map((r) => ({
      ...r,
      cliente: clienteNombre,
    }));
  });

  const clienteDir = path.join(DATA_DIR, 'clientes', String(clienteId), canalDir);
  await Promise.all(tabKeys.map((key) => writeJson(path.join(clienteDir, `${key}.json`), datasets[key])));

  return { canalDir, tabKeys, datasets };
}

async function main() {
  const clientesConCanales = getClientesConCanales();
  if (clientesConCanales.length === 0) {
    console.log('Ningún cliente tiene un canal contratado con Sheet ID configurado todavía. Nada que sincronizar.');
    return;
  }

  const porCanal = new Map(); // canalDir -> { tabKeys, datasets: { [tabKey]: [] } }
  const campanasServidas = new Map(); // campana -> anunciante

  for (const item of clientesConCanales) {
    let resultado;
    try {
      resultado = await syncClienteCanal(item);
    } catch (err) {
      console.error(`Falló ${item.clienteNombre} / ${item.canal}: ${err.message}`);
      continue; // no tocar lo ya sincronizado de este cliente/canal en un intento anterior
    }
    if (!resultado) continue; // canal sin config en canalMetricas.js todavía

    const { canalDir, tabKeys, datasets } = resultado;
    const acc = porCanal.get(canalDir) ?? { tabKeys, datasets: Object.fromEntries(tabKeys.map((k) => [k, []])) };
    for (const key of tabKeys) acc.datasets[key].push(...datasets[key]);
    porCanal.set(canalDir, acc);

    for (const r of datasets.diario ?? []) {
      if (r.campana && r.anunciante) campanasServidas.set(r.campana, r.anunciante);
    }
  }

  for (const [canalDir, acc] of porCanal) {
    const canalOutDir = path.join(DATA_DIR, canalDir);
    await Promise.all(
      acc.tabKeys.map((key) => writeJson(path.join(canalOutDir, `${key}.json`), acc.datasets[key]))
    );
  }

  await writeJson(
    path.join(DATA_DIR, 'campanasServidas.json'),
    [...campanasServidas.entries()].map(([campana, anunciante]) => ({ campana, anunciante }))
  );

  console.log('Sync completo.');
}

main().catch((err) => {
  console.error('Sync abortado:', err);
  process.exit(1);
});
