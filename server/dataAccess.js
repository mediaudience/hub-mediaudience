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

export async function getResumenGeneral(canalDir, user) {
  const rendimientoDiario = await readJson(path.join(DATA_DIR, canalDir, 'rendimientoDiario.json'));
  const campanasDelCanal = [...new Set((rendimientoDiario?.porCampana ?? []).map((r) => r.campana))];
  const campanasServidas = await getCampanasServidas();

  if (user.rol === 'admin') {
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

  // cliente: KPIs/Mensual/Ciudades/Dispositivos vienen del Sheet propio del
  // cliente (ya sincronizados aparte, sin necesidad de filtrar por fila).
  const dir = clienteDataDir(user.clienteId, canalDir);
  const [resumen, ciudades, dispositivos] = await Promise.all([
    readJson(path.join(dir, 'resumen.json')),
    readJson(path.join(dir, 'ciudades.json')),
    readJson(path.join(dir, 'dispositivos.json')),
  ]);

  const misAnunciantes = getMisAnunciantes(user.clienteId);
  const misCampanas = campanasDelCanal.filter((c) =>
    misAnunciantes.includes(anuncianteDeCampana(campanasServidas, c))
  );

  return {
    kpis: resumen?.kpis ?? { impresionesTotales: 0, visualizaciones: 0, vtr: 0 },
    mensual: resumen?.mensual ?? [],
    ciudades: ciudades ?? [],
    dispositivos: dispositivos ?? [],
    anunciantes: misAnunciantes,
    campanas: misCampanas,
    sinDatos: resumen === null && ciudades === null && dispositivos === null,
  };
}

export async function getRendimientoDiario(canalDir, user) {
  const rendimientoDiario = (await readJson(path.join(DATA_DIR, canalDir, 'rendimientoDiario.json'))) ?? {
    porCampana: [],
    porPublisher: [],
    testigo: [],
  };

  if (user.rol === 'admin') {
    const campanas = [...new Set(rendimientoDiario.porCampana.map((r) => r.campana))];
    return { ...rendimientoDiario, campanas };
  }

  // cliente: porCampana/testigo se filtran cruzando `campana` -> `anunciante`
  // contra campanasServidas.json; porPublisher no tiene ese cruce posible (no
  // trae campana por fila), así que sale del Sheet propio del cliente, igual
  // que ciudades/dispositivos en getResumenGeneral.
  const campanasServidas = await getCampanasServidas();
  const misAnunciantes = getMisAnunciantes(user.clienteId);
  const esDeMisAnunciantes = (campana) => misAnunciantes.includes(anuncianteDeCampana(campanasServidas, campana));

  const porCampana = rendimientoDiario.porCampana.filter((r) => esDeMisAnunciantes(r.campana));
  const testigo = rendimientoDiario.testigo.filter((r) => esDeMisAnunciantes(r.campana));
  const campanas = [...new Set(porCampana.map((r) => r.campana))];

  const dir = clienteDataDir(user.clienteId, canalDir);
  const porPublisher = (await readJson(path.join(dir, 'porPublisher.json'))) ?? [];

  return { porCampana, porPublisher, testigo, campanas };
}
