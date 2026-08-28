import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../server/db.js';
import { fetchTabRows, parseValor, writeJson, leerJsonSiExiste } from './syncSheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const GESTION_DIR = path.join(DATA_DIR, 'gestion');

// Un Sheet por país, con 2 pestañas fijas adentro -- no depende de
// clientes/anunciantes (ver [[project_mediaudience_gestion_sheets]] en
// memoria). Los headers reales del Sheet vienen con saltos de línea/espacios
// inconsistentes ("Objetivo de la \nCampaña"), así que se normalizan antes de
// matchear contra el `header` declarado acá, en vez de reusar
// rowsToObjects/parseFilas de syncSheets.js (esos asumen headers ya limpios).
function normalizarHeader(h) {
  return String(h ?? '').replace(/\s+/g, ' ').trim();
}

function filasDesdeSheet(rows, campos) {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  const headerNorm = header.map(normalizarHeader);
  return data
    .filter((r) => r.some((v) => String(v ?? '').trim() !== ''))
    .map((r) =>
      Object.fromEntries(
        campos.map((c) => {
          const idx = headerNorm.indexOf(normalizarHeader(c.header));
          return [c.key, idx === -1 ? parseValor(undefined, c.type) : parseValor(r[idx], c.type)];
        })
      )
    );
}

// Headers relevados 2026-08-29 contra el Sheet real de Ecuador (ver imágenes
// que mandó Jose, EC_Campañas Servidas.png / EC_Facturación.png) -- solo se
// mapean las columnas que se muestran en esas 2 vistas, no todas las
// columnas crudas que trae el Sheet (ej. Inversión/Venta Costo Cliente/MAX
// Gasto Plataforma en Campañas Servidas no se usan todavía).
const CAMPOS_CAMPANAS_SERVIDAS = [
  { key: 'anunciante', header: 'Anunciante', type: 'texto' },
  { key: 'campana', header: 'Campañas', type: 'texto' },
  { key: 'ejecutivo', header: 'Ejecutivo', type: 'texto' },
  { key: 'formato', header: 'Formato', type: 'texto' },
  { key: 'tipoVenta', header: 'Tipo de Venta', type: 'texto' },
  { key: 'fechaInicio', header: 'Fecha de Inicio', type: 'fecha' },
  { key: 'fechaFin', header: 'Fecha de Fin', type: 'fecha' },
  { key: 'objetivo', header: 'Objetivo de la Campaña', type: 'numero' },
  { key: 'consumo', header: 'Consumo de la campaña', type: 'numero' },
  { key: 'porcentajeConsumo', header: 'Porcentaje de consumo', type: 'porcentaje' },
  { key: 'reporte', header: 'Reporte', type: 'texto' },
];

const CAMPOS_FACTURACION = [
  { key: 'mes', header: 'MES', type: 'texto' },
  { key: 'agencia', header: 'AGENCIA', type: 'texto' },
  { key: 'cliente', header: 'CLIENTE', type: 'texto' },
  { key: 'producto', header: 'PRODUCTO', type: 'texto' },
  { key: 'estadoFactura', header: 'ESTADO FACTURA', type: 'texto' },
  { key: 'ordenAgencia', header: 'Orden Agencia', type: 'texto' },
  { key: 'pdfOrden', header: 'PDF ORDEN', type: 'link' },
  { key: 'pdfFactura', header: 'PDF FACTURA', type: 'link' },
  { key: 'consumoNeto', header: 'CONSUMO NETO VENTA', type: 'moneda' },
  { key: 'montoFacturado', header: 'MONTO FACTURADO', type: 'moneda' },
  { key: 'montoPendiente', header: 'MONTO PENDIENTE', type: 'moneda' },
];

function paisesConSheet() {
  return db
    .prepare(
      `SELECT gs.pais AS pais, p.nombre AS paisNombre, gs.sheet_id AS sheetId
       FROM gestion_sheets gs
       JOIN paises p ON p.codigo = gs.pais
       WHERE gs.sheet_id != ''`
    )
    .all();
}

async function syncGestionPaisInterno({ pais, paisNombre, sheetId }) {
  console.log(`Sincronizando Sheet de Gestión de ${paisNombre} (${sheetId})...`);
  const [rowsCampanas, rowsFacturacion] = await Promise.all([
    fetchTabRows(sheetId, 'Campañas Servidas'),
    fetchTabRows(sheetId, 'Facturación'),
  ]);
  const campanasServidas = filasDesdeSheet(rowsCampanas, CAMPOS_CAMPANAS_SERVIDAS).map((r) => ({ ...r, pais: paisNombre }));
  const facturacion = filasDesdeSheet(rowsFacturacion, CAMPOS_FACTURACION).map((r) => ({ ...r, pais: paisNombre }));

  const dir = path.join(GESTION_DIR, pais);
  await writeJson(path.join(dir, 'campanas-servidas.json'), campanasServidas);
  await writeJson(path.join(dir, 'facturacion.json'), facturacion);
  return { campanasServidas, facturacion };
}

// Reconstruye el agregado de TODOS los países (para la vista de Admin/Super
// Admin) leyendo del disco lo que cada país ya tenga sincronizado -- mismo
// patrón que reconstruirAgregadoCanal en syncSheets.js.
async function reconstruirAgregadosGestion() {
  const paises = paisesConSheet();
  const campanasServidas = [];
  const facturacion = [];
  for (const { pais } of paises) {
    const dir = path.join(GESTION_DIR, pais);
    campanasServidas.push(...(await leerJsonSiExiste(path.join(dir, 'campanas-servidas.json'))));
    facturacion.push(...(await leerJsonSiExiste(path.join(dir, 'facturacion.json'))));
  }
  await writeJson(path.join(GESTION_DIR, 'campanas-servidas.json'), campanasServidas);
  await writeJson(path.join(GESTION_DIR, 'facturacion.json'), facturacion);
}

// Sync puntual de UN país -- botón "Sincronizar ahora" y auto-sync al guardar
// el Sheet ID (server/adminRoutes.js).
export async function syncGestionPais(pais) {
  const fila = paisesConSheet().find((p) => p.pais === pais);
  if (!fila) return { sincronizado: false, motivo: 'Sin Sheet ID configurado para este país' };
  const { campanasServidas, facturacion } = await syncGestionPaisInterno(fila);
  await reconstruirAgregadosGestion();
  return { sincronizado: true, campanasServidas: campanasServidas.length, facturacion: facturacion.length };
}

// Sync completo de todos los países con Sheet ID -- para un futuro cron, si
// hace falta (hoy se dispara solo manual/al guardar).
export async function syncGestionTodo() {
  const paises = paisesConSheet();
  for (const fila of paises) {
    await syncGestionPaisInterno(fila);
  }
  await reconstruirAgregadosGestion();
  return { paises: paises.map((p) => p.pais) };
}
