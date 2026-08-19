import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const CREDENTIALS_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'secrets', 'google-service-account.json');

// Cada Sheet (uno por cliente + canal contratado) tiene estas 5 pestañas fijas.
// Ojo: "PUBLISHER." lleva un punto al final en la plantilla real -- si no
// coincide el nombre exacto, Sheets devuelve en silencio la primera pestaña
// en vez de un error, así que hay que ser exacto acá.
const TABS = { diario: 'DIARIO', publisher: 'PUBLISHER.', device: 'DEVICE', testigo: 'TESTIGO', geo: 'GEO' };

const MESES_ORDEN = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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

// -------- Parseo de números/fechas en formato es-PE que usan los Sheets --------

function parseNumeroEs(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  let s = String(raw).trim().replace('%', '');
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseInt(s.replace(/\./g, ''), 10) || 0;
}

function parseFechaEs(raw) {
  const [d, m, y] = String(raw).trim().split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// -------- Transformación de cada pestaña a la forma que espera el panel --------

function transformDiario(rows) {
  return rowsToObjects(rows).map((r) => ({
    fecha: parseFechaEs(r['Fecha']),
    mes: r['Mes'],
    campana: r['Campaña'],
    motivo: r['Motivo'],
    anunciante: r['Anunciante'],
    impresionesTotales: parseNumeroEs(r['Impresiones Totales']),
    visualizaciones: parseNumeroEs(r['Visualizaciones']),
    quartil25: parseNumeroEs(r['Quartil 25%']),
    quartil50: parseNumeroEs(r['Quartil 50%']),
    quartil75: parseNumeroEs(r['Quartil 75%']),
    quartil100: parseNumeroEs(r['Quartil 100%']),
    vtr: Math.round(parseNumeroEs(r['VTR'])),
  }));
}

function transformPublisher(rows) {
  return rowsToObjects(rows).map((r) => ({
    mes: r['Mes'],
    publisher: r['Publisher'],
    motivo: r['Motivo'],
    impresionesTotales: parseNumeroEs(r['Impresiones Totales']),
    visualizaciones: parseNumeroEs(r['Vistas Totales']),
  }));
}

function transformDevice(rows) {
  return rowsToObjects(rows).map((r) => ({
    dispositivo: r['Dispositivos'],
    impresionesTotales: parseNumeroEs(r['Impresiones Totales']),
  }));
}

function transformGeo(rows) {
  return rowsToObjects(rows).map((r) => ({
    ubicacion: r['Ubicación'],
    impresionesTotales: parseNumeroEs(r['Impresiones Totales']),
  }));
}

function transformTestigo(rows) {
  return rowsToObjects(rows).map((r) => ({
    mes: r['Mes'],
    campana: r['Campaña'],
    motivo: r['Motivo'],
    formato: r['Formato'],
    estado: r['Link'] ? 'Verificado' : 'Pendiente',
    testigoUrl: r['Link'] || '',
  }));
}

function sumarPorClave(items, keyField, sumFields) {
  const map = new Map();
  for (const item of items) {
    const key = item[keyField];
    const acc = map.get(key) ?? { [keyField]: key, ...Object.fromEntries(sumFields.map((f) => [f, 0])) };
    for (const f of sumFields) acc[f] += item[f] ?? 0;
    map.set(key, acc);
  }
  return [...map.values()];
}

function calcularResumen(diario) {
  const impresionesTotales = diario.reduce((s, r) => s + r.impresionesTotales, 0);
  const visualizaciones = diario.reduce((s, r) => s + r.visualizaciones, 0);
  const vtr = impresionesTotales > 0 ? Math.round((visualizaciones / impresionesTotales) * 100) : 0;
  const mensual = sumarPorClave(diario, 'mes', ['impresionesTotales', 'visualizaciones'])
    .sort((a, b) => MESES_ORDEN.indexOf(a.mes) - MESES_ORDEN.indexOf(b.mes));
  return { kpis: { impresionesTotales, visualizaciones, vtr }, mensual };
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
// este script.
const CANAL_DIR = Object.fromEntries(
  db.prepare('SELECT slug, dir FROM canales').all().map((r) => [r.slug, r.dir])
);

async function syncClienteCanal({ clienteId, clienteNombre, canal, sheetId }) {
  const canalDir = CANAL_DIR[canal];
  console.log(`Sincronizando ${clienteNombre} / ${canal} (${sheetId})...`);

  const [diarioRows, publisherRows, deviceRows, geoRows, testigoRows] = await Promise.all([
    fetchTabRows(sheetId, TABS.diario),
    fetchTabRows(sheetId, TABS.publisher),
    fetchTabRows(sheetId, TABS.device),
    fetchTabRows(sheetId, TABS.geo),
    fetchTabRows(sheetId, TABS.testigo),
  ]);

  const diario = transformDiario(diarioRows);
  const publisher = transformPublisher(publisherRows);
  const dispositivos = sumarPorClave(transformDevice(deviceRows), 'dispositivo', ['impresionesTotales']);
  const ciudades = sumarPorClave(transformGeo(geoRows), 'ubicacion', ['impresionesTotales']);
  const testigo = transformTestigo(testigoRows);
  const resumen = calcularResumen(diario);

  const clienteDir = path.join(DATA_DIR, 'clientes', String(clienteId), canalDir);
  await Promise.all([
    writeJson(path.join(clienteDir, 'resumen.json'), resumen),
    writeJson(path.join(clienteDir, 'ciudades.json'), ciudades),
    writeJson(path.join(clienteDir, 'dispositivos.json'), dispositivos),
    writeJson(path.join(clienteDir, 'porPublisher.json'), publisher),
  ]);

  return { canalDir, diario, ciudades, dispositivos, testigo };
}

async function main() {
  const clientesConCanales = getClientesConCanales();
  if (clientesConCanales.length === 0) {
    console.log('Ningún cliente tiene un canal contratado con Sheet ID configurado todavía. Nada que sincronizar.');
    return;
  }

  const porCanal = new Map(); // canalDir -> { diario: [], ciudades: [], dispositivos: [], testigo: [] }
  const campanasServidas = new Map(); // campana -> anunciante

  for (const item of clientesConCanales) {
    let resultado;
    try {
      resultado = await syncClienteCanal(item);
    } catch (err) {
      console.error(`Falló ${item.clienteNombre} / ${item.canal}: ${err.message}`);
      continue; // no tocar lo ya sincronizado de este cliente/canal en un intento anterior
    }

    const acc = porCanal.get(resultado.canalDir) ?? { diario: [], ciudades: [], dispositivos: [], testigo: [] };
    acc.diario.push(...resultado.diario);
    acc.ciudades.push(...resultado.ciudades);
    acc.dispositivos.push(...resultado.dispositivos);
    acc.testigo.push(...resultado.testigo);
    porCanal.set(resultado.canalDir, acc);

    for (const r of resultado.diario) {
      if (r.campana && r.anunciante) campanasServidas.set(r.campana, r.anunciante);
    }
  }

  for (const [canalDir, acc] of porCanal) {
    const canalOutDir = path.join(DATA_DIR, canalDir);
    const resumen = calcularResumen(acc.diario);
    const ciudades = sumarPorClave(acc.ciudades, 'ubicacion', ['impresionesTotales']);
    const dispositivos = sumarPorClave(acc.dispositivos, 'dispositivo', ['impresionesTotales']);
    const porCampana = acc.diario.map((r) => ({
      fecha: r.fecha, campana: r.campana, motivo: r.motivo,
      impresionesTotales: r.impresionesTotales, visualizaciones: r.visualizaciones,
      quartil25: r.quartil25, quartil50: r.quartil50, quartil75: r.quartil75, quartil100: r.quartil100,
      vtr: r.vtr,
    }));

    await Promise.all([
      writeJson(path.join(canalOutDir, 'resumen.json'), resumen),
      writeJson(path.join(canalOutDir, 'ciudades.json'), ciudades),
      writeJson(path.join(canalOutDir, 'dispositivos.json'), dispositivos),
      writeJson(path.join(canalOutDir, 'rendimientoDiario.json'), { porCampana, porPublisher: [], testigo: acc.testigo }),
    ]);
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
