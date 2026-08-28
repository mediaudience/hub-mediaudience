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

// usuario_interno ve la unión de dos fuentes, nunca solo una: los clientes que
// un Admin le marcó uno por uno en `usuario_clientes` (como siempre) MÁS,
// si tiene un país asignado (Admin > Usuarios, ver [[project_mediaudience_pais_interno]]),
// TODOS los clientes activos de ese país -- incluidos los que se creen
// después, sin tener que volver a tocar los permisos de este usuario.
function getClienteIdsVisibles(user) {
  if (user.rol === 'usuario_externo') return user.clienteId ? [user.clienteId] : [];
  if (user.rol === 'usuario_interno') {
    const porAsignacionManual = db
      .prepare(
        `SELECT uc.cliente_id AS id FROM usuario_clientes uc
         JOIN clientes c ON c.id = uc.cliente_id AND c.activo = 1
         WHERE uc.user_id = ?`
      )
      .all(user.id)
      .map((r) => r.id);

    const porPais = user.pais
      ? db
          .prepare('SELECT id FROM clientes WHERE activo = 1 AND pais = ?')
          .all(user.pais)
          .map((r) => r.id)
      : [];

    return [...new Set([...porAsignacionManual, ...porPais])];
  }
  return [];
}

// Lista de clientes visibles del usuario a nivel de cuenta (no por canal) --
// alimenta el selector de "Cliente activo" del menú de la cuenta (Navbar),
// que reemplaza al filtro "Cliente" que antes vivía dentro de cada canal.
// Cada cliente trae además sus `canales` contratados, para que al elegir uno
// el Sidebar pueda mostrar solo los servicios que ese cliente tiene (en vez
// de los 5 servicios activos del catálogo, muchos sin datos para él).
export function getClientesVisibles(user) {
  const SELECT_CON_PAIS = `
    SELECT c.id, c.nombre, c.pais, p.nombre AS paisNombre
    FROM clientes c
    LEFT JOIN paises p ON p.codigo = c.pais
  `;
  const clientes = VE_TODO_SIN_FILTRO.includes(user.rol)
    ? db.prepare(`${SELECT_CON_PAIS} WHERE c.activo = 1 ORDER BY COALESCE(p.nombre, c.pais, ''), c.nombre`).all()
    : (() => {
        const clienteIds = getClienteIdsVisibles(user);
        if (clienteIds.length === 0) return [];
        const placeholders = clienteIds.map(() => '?').join(',');
        return db
          .prepare(
            `${SELECT_CON_PAIS} WHERE c.id IN (${placeholders}) AND c.activo = 1 ORDER BY COALESCE(p.nombre, c.pais, ''), c.nombre`
          )
          .all(...clienteIds);
      })();
  if (clientes.length === 0) return [];

  const ids = clientes.map((c) => c.id);
  const placeholders = ids.map(() => '?').join(',');
  const canalesPorCliente = new Map();
  for (const fila of db
    .prepare(`SELECT cliente_id, canal FROM cliente_canales WHERE cliente_id IN (${placeholders})`)
    .all(...ids)) {
    if (!canalesPorCliente.has(fila.cliente_id)) canalesPorCliente.set(fila.cliente_id, []);
    canalesPorCliente.get(fila.cliente_id).push(fila.canal);
  }
  return clientes.map((c) => ({ ...c, canales: canalesPorCliente.get(c.id) ?? [] }));
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

// Datasets que trae el Sheet de cada canal desde la reestructuración de
// 2026-08-24 (ver src/config/canalMetricas.js). Cuando se sume TikTok esta
// lista pasa a depender del canal (sin 'testigo', con 'interacciones') --
// hoy los 2 canales ya migrados (ctvOtt, pushNotification) comparten el
// mismo set de 3, así que se deja fijo por simplicidad hasta ese momento.
const RENDIMIENTO_TAB_KEYS = ['diario', 'geo', 'testigo'];

async function leerDatasets(dir) {
  const valores = await Promise.all(
    RENDIMIENTO_TAB_KEYS.map((key) => readJson(path.join(dir, `${key}.json`)))
  );
  return Object.fromEntries(RENDIMIENTO_TAB_KEYS.map((key, i) => [key, valores[i]]));
}

// Cada fila de diario/geo/testigo ya trae su propio `anunciante` (columna del
// Sheet, ver canalMetricas.js) -- ya no hace falta cruzar contra
// campanasServidas.json como antes de esta reestructuración.
export async function getRendimientoGeneral(canalDir, user) {
  if (VE_TODO_SIN_FILTRO.includes(user.rol)) {
    const { diario, geo, testigo } = await leerDatasets(path.join(DATA_DIR, canalDir));
    const diarioRows = diario ?? [];
    const campanas = [...new Set(diarioRows.map((r) => r.campana))];
    const anunciantes = [...new Set(diarioRows.map((r) => r.anunciante).filter(Boolean))];
    const clientes = [...new Set(diarioRows.map((r) => r.cliente).filter(Boolean))];
    return { diario: diarioRows, geo: geo ?? [], testigo: testigo ?? [], campanas, anunciantes, clientes, sinDatos: false };
  }

  // usuario_externo / usuario_interno: cada cliente visible que haya
  // contratado este canal aporta sus propias filas (ya sincronizadas aparte),
  // filtradas por los anunciantes que este usuario puede ver DENTRO de ESE
  // cliente -- filtrar el agregado del canal completo por nombre de
  // anunciante sería incorrecto si dos clientes distintos comparten el mismo
  // nombre de marca, así que se lee y filtra por cliente antes de combinar.
  const clienteIds = getClienteIdsConCanal(getClienteIdsVisibles(user), canalDir);
  if (clienteIds.length === 0) {
    return { diario: [], geo: [], testigo: [], campanas: [], anunciantes: [], clientes: [], sinDatos: true };
  }

  const porCliente = await Promise.all(
    clienteIds.map(async (id) => {
      const misAnunciantes = getAnunciantesVisibles(user.id, id);
      const datasets = await leerDatasets(clienteDataDir(id, canalDir));
      const filtrar = (rows) => (rows ?? []).filter((r) => misAnunciantes.includes(r.anunciante));
      return {
        diario: filtrar(datasets.diario),
        geo: filtrar(datasets.geo),
        testigo: filtrar(datasets.testigo),
        sinDatos: RENDIMIENTO_TAB_KEYS.every((key) => datasets[key] === null),
      };
    })
  );

  const diario = porCliente.flatMap((c) => c.diario);
  const geo = porCliente.flatMap((c) => c.geo);
  const testigo = porCliente.flatMap((c) => c.testigo);
  const campanas = [...new Set(diario.map((r) => r.campana))];
  const anunciantes = [...new Set(diario.map((r) => r.anunciante).filter(Boolean))];
  const clientes = [...new Set(diario.map((r) => r.cliente).filter(Boolean))];

  return { diario, geo, testigo, campanas, anunciantes, clientes, sinDatos: porCliente.every((c) => c.sinDatos) };
}
