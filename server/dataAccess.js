import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Catálogo de servicios/canales -- vive en la tabla `canales` (ver server/db.js)
// para que un Super Admin pueda agregar nuevos sin tocar código. Se consulta
// en vivo en cada llamada (no se cachea en memoria) para que un servicio
// recién creado aparezca sin reiniciar el backend.
function getCanalesActivos() {
  return db.prepare('SELECT slug, dir, nombre FROM canales WHERE activo = 1 ORDER BY rowid').all();
}

// Slug de la URL (kebab-case, como aparece en las rutas de React Router) ->
// nombre del directorio real bajo src/data (heredado en camelCase para los 5
// canales originales; slug = dir para los creados después).
function getCanalesMap() {
  return Object.fromEntries(getCanalesActivos().map((c) => [c.slug, c.dir]));
}

// Lista pública (slug + nombre) de servicios activos, para que el frontend
// arme el Sidebar/rutas dinámicamente en vez de un navConfig.js hardcodeado.
export function getCanalesPublicos() {
  return getCanalesActivos().map((c) => ({ slug: c.slug, nombre: c.nombre }));
}

// Resuelve un slug de URL a su carpeta real, o undefined si no existe / está
// inactivo (server/dataRoutes.js responde 404 en ese caso).
export function getDirDeCanal(slug) {
  return getCanalesMap()[slug];
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function getCampanasServidas() {
  // Se relee en cada llamada (no se cachea en memoria): el cron de sync
  // sobrescribe este archivo cada cierto intervalo y el server Node es un
  // proceso de larga duración, así que cachear indefinidamente serviría datos
  // viejos hasta el próximo restart.
  return (await readJson(path.join(DATA_DIR, 'campanasServidas.json'))) ?? [];
}

function anuncianteDeCampana(campanasServidas, campana) {
  return campanasServidas.find((c) => c.campana === campana)?.anunciante ?? null;
}

function getAnunciantesDeCliente(clienteId) {
  if (!clienteId) return [];
  return db
    .prepare('SELECT anunciante FROM cliente_anunciantes WHERE cliente_id = ?')
    .all(clienteId)
    .map((r) => r.anunciante);
}

// Si un Admin/Super Admin restringió a este usuario a ciertos anunciantes de
// este cliente (tabla usuario_anunciantes), devuelve solo esos. Sin
// restricción explícita para ese (usuario, cliente) = ve todos los
// anunciantes del cliente (default retrocompatible, ver server/db.js).
function getAnunciantesVisibles(userId, clienteId) {
  const restringidos = db
    .prepare('SELECT anunciante FROM usuario_anunciantes WHERE user_id = ? AND cliente_id = ?')
    .all(userId, clienteId)
    .map((r) => r.anunciante);
  return restringidos.length > 0 ? restringidos : getAnunciantesDeCliente(clienteId);
}

function clienteDataDir(clienteId, canalDir) {
  return path.join(DATA_DIR, 'clientes', String(clienteId), canalDir);
}

// super_admin y admin ven todos los anunciantes/campañas sin filtrar. El resto
// (usuario_interno, usuario_externo) queda acotado a un conjunto de clientes:
// uno solo para usuario_externo, los que le haya habilitado un Admin/Super
// Admin para usuario_interno (ninguno asignado todavía = no ve nada).
const VE_TODO_SIN_FILTRO = ['super_admin', 'admin'];

// Union de los canales contratados (fila en `cliente_canales`, con o sin
// sheet_id ya configurado) por los clientes visibles del usuario. Admin/Super
// Admin ven todos los canales sin filtrar -- igual que el resto de la data.
export function getCanalesContratados(user) {
  if (VE_TODO_SIN_FILTRO.includes(user.rol)) return getCanalesActivos().map((c) => c.slug);

  const clienteIds = getClienteIdsVisibles(user);
  if (clienteIds.length === 0) return [];

  const placeholders = clienteIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT DISTINCT canal FROM cliente_canales WHERE cliente_id IN (${placeholders})`)
    .all(...clienteIds)
    .map((r) => r.canal);
}

function getClienteIdsVisibles(user) {
  if (user.rol === 'usuario_externo') return user.clienteId ? [user.clienteId] : [];
  if (user.rol === 'usuario_interno') {
    return db
      .prepare(
        `SELECT uc.cliente_id AS id FROM usuario_clientes uc
         JOIN clientes c ON c.id = uc.cliente_id AND c.activo = 1
         WHERE uc.user_id = ?`
      )
      .all(user.id)
      .map((r) => r.id);
  }
  return [];
}

// De los clientes visibles del usuario, deja solo los que contrataron este
// canal en particular -- un usuario_interno puede tener un cliente con
// CTV-OTT y otro solo con YouTube, y cada canal debe verse por separado.
function getClienteIdsConCanal(clienteIds, canalDir) {
  if (clienteIds.length === 0) return [];
  const slug = getCanalesActivos().find((c) => c.dir === canalDir)?.slug;
  if (!slug) return [];
  const placeholders = clienteIds.map(() => '?').join(',');
  const conCanal = new Set(
    db
      .prepare(`SELECT cliente_id FROM cliente_canales WHERE canal = ? AND cliente_id IN (${placeholders})`)
      .all(slug, ...clienteIds)
      .map((r) => r.cliente_id)
  );
  return clienteIds.filter((id) => conCanal.has(id));
}

// Suma campos numéricos de items con la misma clave (p.ej. mismo mes o misma
// ciudad) para combinar la vista de varios clientes en una sola serie.
function mergeSeriesBy(items, keyField, sumFields) {
  const map = new Map();
  for (const item of items) {
    const key = item[keyField];
    const existing = map.get(key);
    if (existing) {
      for (const f of sumFields) existing[f] = (existing[f] ?? 0) + (item[f] ?? 0);
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()];
}

function mergeKpis(kpisList) {
  const impresionesTotales = kpisList.reduce((s, k) => s + (k?.impresionesTotales ?? 0), 0);
  const visualizaciones = kpisList.reduce((s, k) => s + (k?.visualizaciones ?? 0), 0);
  const vtr = impresionesTotales > 0 ? Math.round((visualizaciones / impresionesTotales) * 100) : 0;
  return { impresionesTotales, visualizaciones, vtr };
}

export async function getResumenGeneral(canalDir, user) {
  const rendimientoDiario = await readJson(path.join(DATA_DIR, canalDir, 'rendimientoDiario.json'));
  const campanasDelCanal = [...new Set((rendimientoDiario?.porCampana ?? []).map((r) => r.campana))];
  const campanasServidas = await getCampanasServidas();

  if (VE_TODO_SIN_FILTRO.includes(user.rol)) {
    const [resumen, ciudades, dispositivos] = await Promise.all([
      readJson(path.join(DATA_DIR, canalDir, 'resumen.json')),
      readJson(path.join(DATA_DIR, canalDir, 'ciudades.json')),
      readJson(path.join(DATA_DIR, canalDir, 'dispositivos.json')),
    ]);
    const anunciantes = [
      ...new Set(campanasDelCanal.map((c) => anuncianteDeCampana(campanasServidas, c)).filter(Boolean)),
    ];
    return {
      kpis: resumen?.kpis ?? { impresionesTotales: 0, visualizaciones: 0, vtr: 0 },
      mensual: resumen?.mensual ?? [],
      ciudades: ciudades ?? [],
      dispositivos: dispositivos ?? [],
      anunciantes,
      campanas: campanasDelCanal,
      sinDatos: false,
    };
  }

  // usuario_externo / usuario_interno: KPIs/Mensual/Ciudades/Dispositivos vienen
  // del Sheet propio de cada cliente visible que haya contratado este canal
  // (ya sincronizados aparte, sin necesidad de filtrar por fila); si hay más
  // de un cliente visible (solo puede pasar con usuario_interno) se combinan
  // sumando los valores.
  const clienteIds = getClienteIdsConCanal(getClienteIdsVisibles(user), canalDir);
  if (clienteIds.length === 0) {
    return {
      kpis: { impresionesTotales: 0, visualizaciones: 0, vtr: 0 },
      mensual: [],
      ciudades: [],
      dispositivos: [],
      anunciantes: [],
      campanas: [],
      sinDatos: true,
    };
  }

  const misAnunciantes = [...new Set(clienteIds.flatMap((id) => getAnunciantesVisibles(user.id, id)))];
  const misCampanas = campanasDelCanal.filter((c) =>
    misAnunciantes.includes(anuncianteDeCampana(campanasServidas, c))
  );

  const porCliente = await Promise.all(
    clienteIds.map(async (id) => {
      const dir = clienteDataDir(id, canalDir);
      const [resumen, ciudades, dispositivos] = await Promise.all([
        readJson(path.join(dir, 'resumen.json')),
        readJson(path.join(dir, 'ciudades.json')),
        readJson(path.join(dir, 'dispositivos.json')),
      ]);
      return { resumen, ciudades, dispositivos };
    })
  );

  const kpis =
    porCliente.length === 1
      ? porCliente[0].resumen?.kpis ?? { impresionesTotales: 0, visualizaciones: 0, vtr: 0 }
      : mergeKpis(porCliente.map((c) => c.resumen?.kpis));

  return {
    kpis,
    mensual: mergeSeriesBy(porCliente.flatMap((c) => c.resumen?.mensual ?? []), 'mes', [
      'visualizaciones',
      'impresionesTotales',
    ]),
    ciudades: mergeSeriesBy(porCliente.flatMap((c) => c.ciudades ?? []), 'ubicacion', ['impresionesTotales']),
    dispositivos: mergeSeriesBy(porCliente.flatMap((c) => c.dispositivos ?? []), 'dispositivo', [
      'impresionesTotales',
    ]),
    anunciantes: misAnunciantes,
    campanas: misCampanas,
    sinDatos: porCliente.every((c) => c.resumen === null && c.ciudades === null && c.dispositivos === null),
  };
}

export async function getRendimientoDiario(canalDir, user) {
  const rendimientoDiario = (await readJson(path.join(DATA_DIR, canalDir, 'rendimientoDiario.json'))) ?? {
    porCampana: [],
    porPublisher: [],
    testigo: [],
  };

  if (VE_TODO_SIN_FILTRO.includes(user.rol)) {
    const campanas = [...new Set(rendimientoDiario.porCampana.map((r) => r.campana))];
    return { ...rendimientoDiario, campanas };
  }

  // usuario_externo / usuario_interno: porCampana/testigo se filtran cruzando
  // `campana` -> `anunciante` contra campanasServidas.json; porPublisher no
  // tiene ese cruce posible (no trae campana por fila), así que sale del Sheet
  // propio de cada cliente visible, igual que ciudades/dispositivos arriba.
  const clienteIds = getClienteIdsConCanal(getClienteIdsVisibles(user), canalDir);
  if (clienteIds.length === 0) {
    return { porCampana: [], porPublisher: [], testigo: [], campanas: [] };
  }

  const campanasServidas = await getCampanasServidas();
  const misAnunciantes = [...new Set(clienteIds.flatMap((id) => getAnunciantesVisibles(user.id, id)))];
  const esDeMisAnunciantes = (campana) => misAnunciantes.includes(anuncianteDeCampana(campanasServidas, campana));

  const porCampana = rendimientoDiario.porCampana.filter((r) => esDeMisAnunciantes(r.campana));
  const testigo = rendimientoDiario.testigo.filter((r) => esDeMisAnunciantes(r.campana));
  const campanas = [...new Set(porCampana.map((r) => r.campana))];

  const porPublisher = (
    await Promise.all(
      clienteIds.map((id) => readJson(path.join(clienteDataDir(id, canalDir), 'porPublisher.json')))
    )
  ).flatMap((rows) => rows ?? []);

  return { porCampana, porPublisher, testigo, campanas };
}
