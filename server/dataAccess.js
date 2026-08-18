import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Slug de la URL (kebab-case, como aparece en las rutas de React Router) ->
// nombre del directorio real bajo src/data (camelCase, heredado del proyecto).
export const CANALES = {
  'ctv-ott': 'ctvOtt',
  programatico: 'programatico',
  youtube: 'youtube',
  'push-notification': 'pushNotification',
  tiktok: 'tiktok',
};

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

function getMisAnunciantes(clienteId) {
  if (!clienteId) return [];
  return db
    .prepare('SELECT anunciante FROM cliente_anunciantes WHERE cliente_id = ?')
    .all(clienteId)
    .map((r) => r.anunciante);
}

function clienteDataDir(clienteId, canalDir) {
  return path.join(DATA_DIR, 'clientes', String(clienteId), canalDir);
}

// super_admin y admin ven todos los anunciantes/campañas sin filtrar. El resto
// (usuario_interno, usuario_externo) queda acotado a un conjunto de clientes:
// uno solo para usuario_externo, los que le haya habilitado un Admin/Super
// Admin para usuario_interno (ninguno asignado todavía = no ve nada).
const VE_TODO_SIN_FILTRO = ['super_admin', 'admin'];

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
  // del Sheet propio de cada cliente visible (ya sincronizados aparte, sin
  // necesidad de filtrar por fila); si hay más de un cliente visible (solo
  // puede pasar con usuario_interno) se combinan sumando los valores.
  const clienteIds = getClienteIdsVisibles(user);
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

  const misAnunciantes = [...new Set(clienteIds.flatMap((id) => getMisAnunciantes(id)))];
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
  const clienteIds = getClienteIdsVisibles(user);
  if (clienteIds.length === 0) {
    return { porCampana: [], porPublisher: [], testigo: [], campanas: [] };
  }

  const campanasServidas = await getCampanasServidas();
  const misAnunciantes = [...new Set(clienteIds.flatMap((id) => getMisAnunciantes(id)))];
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
