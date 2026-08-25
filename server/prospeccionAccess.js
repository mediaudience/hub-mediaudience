import db from './db.js';
import { registrarActividad } from './activityLog.js';

const VE_TODO_SIN_FILTRO = ['super_admin', 'admin'];

// Calco exacto de getClienteIdsVisibles (server/dataAccess.js) aplicado a
// prospectos: un usuario_interno ve la unión de lo que un Admin le asignó a
// mano (usuario_prospectos) MÁS todos los prospectos activos de su país --
// usuario_externo nunca llega acá (bloqueado antes, en prospeccionRoutes.js).
function getProspectoIdsVisibles(user) {
  if (VE_TODO_SIN_FILTRO.includes(user.rol)) return null; // null = sin filtro
  if (user.rol !== 'usuario_interno') return [];

  const porAsignacionManual = db
    .prepare(
      `SELECT up.prospecto_id AS id FROM usuario_prospectos up
       JOIN prospectos p ON p.id = up.prospecto_id AND p.activo = 1
       WHERE up.user_id = ?`
    )
    .all(user.id)
    .map((r) => r.id);

  const porPais = user.pais
    ? db.prepare('SELECT id FROM prospectos WHERE activo = 1 AND pais = ?').all(user.pais).map((r) => r.id)
    : [];

  return [...new Set([...porAsignacionManual, ...porPais])];
}

function paisesActivos() {
  return db.prepare('SELECT codigo, nombre FROM paises WHERE activo = 1 ORDER BY rowid').all();
}

export function paisValidoOError(pais) {
  if (!pais) return 'Selecciona el país del prospecto';
  if (!paisesActivos().some((p) => p.codigo === pais)) return 'País inválido';
  return null;
}

function toPublicProspecto(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    pais: p.pais,
    etapa: p.etapa,
    contactoNombre: p.contacto_nombre,
    contactoEmail: p.contacto_email,
    contactoTelefono: p.contacto_telefono,
    valorEstimado: p.valor_estimado,
    responsableUserId: p.responsable_user_id,
    responsableNombre: p.responsable_nombre ?? null,
    proximaAccionFecha: p.proxima_accion_fecha,
    proximaAccionNota: p.proxima_accion_nota,
    convertidoClienteId: p.convertido_cliente_id,
    activo: !!p.activo,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// `responsable_nombre` viaja siempre por LEFT JOIN (en vez de que el
// frontend tenga que resolverlo aparte contra /api/admin/usuarios, endpoint
// que un usuario_interno no puede llamar).
function fetchProspectoConResponsable(id) {
  return db
    .prepare(
      `SELECT prospectos.*, users.nombre AS responsable_nombre
       FROM prospectos LEFT JOIN users ON users.id = prospectos.responsable_user_id
       WHERE prospectos.id = ?`
    )
    .get(id);
}

export function getEtapasProspeccion({ soloActivas = true } = {}) {
  const filtro = soloActivas ? 'WHERE activo = 1' : '';
  return db.prepare(`SELECT codigo, nombre, orden, tipo, activo FROM etapas_prospeccion ${filtro} ORDER BY orden`).all();
}

export function listarProspectos(user) {
  const ids = getProspectoIdsVisibles(user);
  if (ids !== null && ids.length === 0) return [];
  const filtroIds = ids === null ? '' : `AND prospectos.id IN (${ids.map(() => '?').join(',')})`;
  const rows = db
    .prepare(
      `SELECT prospectos.*, users.nombre AS responsable_nombre
       FROM prospectos LEFT JOIN users ON users.id = prospectos.responsable_user_id
       WHERE prospectos.activo = 1 ${filtroIds}
       ORDER BY prospectos.updated_at DESC`
    )
    .all(...(ids ?? []));
  return rows.map(toPublicProspecto);
}

function puedeVerProspecto(user, prospecto) {
  if (VE_TODO_SIN_FILTRO.includes(user.rol)) return true;
  const ids = getProspectoIdsVisibles(user);
  return ids !== null && ids.includes(prospecto.id);
}

export function crearProspecto(req, { nombre, pais, contactoNombre, contactoEmail, contactoTelefono, valorEstimado, proximaAccionFecha, proximaAccionNota, responsableUserId }) {
  if (!nombre || !nombre.trim()) return { error: 'El nombre es requerido' };
  const errorPais = paisValidoOError(pais);
  if (errorPais) return { error: errorPais };
  if (!nombre.trim().startsWith(`${pais}_`)) {
    return { error: `El nombre debe empezar con el prefijo del país (${pais}_)` };
  }

  const responsable = responsableUserId || req.user.id;
  const info = db
    .prepare(
      `INSERT INTO prospectos
        (nombre, pais, contacto_nombre, contacto_email, contacto_telefono, valor_estimado, proxima_accion_fecha, proxima_accion_nota, responsable_user_id, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nombre.trim(),
      pais,
      contactoNombre ?? null,
      contactoEmail ?? null,
      contactoTelefono ?? null,
      valorEstimado ?? null,
      proximaAccionFecha ?? null,
      proximaAccionNota ?? null,
      responsable,
      req.user.id
    );

  const prospecto = fetchProspectoConResponsable(info.lastInsertRowid);
  registrarActividad(req, { actor: req.user, accion: 'Prospecto creado', detalle: `Creó el prospecto "${prospecto.nombre}"` });
  return { prospecto: toPublicProspecto(prospecto) };
}

export function actualizarProspecto(req, id, cambios) {
  const prospecto = db.prepare('SELECT * FROM prospectos WHERE id = ? AND activo = 1').get(id);
  if (!prospecto) return { status: 404, error: 'Prospecto no encontrado' };
  if (!puedeVerProspecto(req.user, prospecto)) return { status: 403, error: 'No autorizado' };

  if (cambios.etapa !== undefined) {
    const etapaValida = getEtapasProspeccion({ soloActivas: false }).some((e) => e.codigo === cambios.etapa);
    if (!etapaValida) return { status: 400, error: 'Etapa inválida' };
  }
  if (cambios.pais !== undefined) {
    const errorPais = paisValidoOError(cambios.pais);
    if (errorPais) return { status: 400, error: errorPais };
  }
  const nuevoPais = cambios.pais ?? prospecto.pais;
  const nuevoNombre = cambios.nombre?.trim() || prospecto.nombre;
  if (!nuevoNombre.startsWith(`${nuevoPais}_`)) {
    return { status: 400, error: `El nombre debe empezar con el prefijo del país (${nuevoPais}_)` };
  }

  db.prepare(
    `UPDATE prospectos SET
       nombre = ?, pais = ?, etapa = ?,
       contacto_nombre = ?, contacto_email = ?, contacto_telefono = ?,
       valor_estimado = ?, proxima_accion_fecha = ?, proxima_accion_nota = ?,
       responsable_user_id = ?, activo = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    nuevoNombre,
    nuevoPais,
    cambios.etapa ?? prospecto.etapa,
    cambios.contactoNombre !== undefined ? cambios.contactoNombre : prospecto.contacto_nombre,
    cambios.contactoEmail !== undefined ? cambios.contactoEmail : prospecto.contacto_email,
    cambios.contactoTelefono !== undefined ? cambios.contactoTelefono : prospecto.contacto_telefono,
    cambios.valorEstimado !== undefined ? cambios.valorEstimado : prospecto.valor_estimado,
    cambios.proximaAccionFecha !== undefined ? cambios.proximaAccionFecha : prospecto.proxima_accion_fecha,
    cambios.proximaAccionNota !== undefined ? cambios.proximaAccionNota : prospecto.proxima_accion_nota,
    cambios.responsableUserId ?? prospecto.responsable_user_id,
    cambios.activo === undefined ? prospecto.activo : cambios.activo ? 1 : 0,
    prospecto.id
  );

  const updated = fetchProspectoConResponsable(prospecto.id);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Prospecto editado',
    detalle: `Editó el prospecto "${updated.nombre}" (etapa=${updated.etapa})`,
  });
  return { prospecto: toPublicProspecto(updated) };
}

export function listarActividadesProspecto(req, prospectoId) {
  const prospecto = db.prepare('SELECT * FROM prospectos WHERE id = ?').get(prospectoId);
  if (!prospecto) return { status: 404, error: 'Prospecto no encontrado' };
  if (!puedeVerProspecto(req.user, prospecto)) return { status: 403, error: 'No autorizado' };

  const actividades = db
    .prepare('SELECT * FROM prospecto_actividades WHERE prospecto_id = ? ORDER BY created_at DESC')
    .all(prospectoId)
    .map((a) => ({
      id: a.id,
      tipo: a.tipo,
      detalle: a.detalle,
      actorNombre: a.actor_nombre,
      createdAt: a.created_at,
    }));
  return { actividades };
}

const TIPOS_ACTIVIDAD = ['llamada', 'correo', 'whatsapp', 'reunion', 'nota'];

export function registrarActividadProspecto(req, prospectoId, { tipo, detalle }) {
  const prospecto = db.prepare('SELECT * FROM prospectos WHERE id = ?').get(prospectoId);
  if (!prospecto) return { status: 404, error: 'Prospecto no encontrado' };
  if (!puedeVerProspecto(req.user, prospecto)) return { status: 403, error: 'No autorizado' };
  if (!TIPOS_ACTIVIDAD.includes(tipo)) return { status: 400, error: 'Tipo de actividad inválido' };

  db.prepare(
    'INSERT INTO prospecto_actividades (prospecto_id, tipo, detalle, actor_user_id, actor_nombre) VALUES (?, ?, ?, ?, ?)'
  ).run(prospectoId, tipo, detalle ?? null, req.user.id, req.user.nombre);

  db.prepare("UPDATE prospectos SET updated_at = datetime('now') WHERE id = ?").run(prospectoId);
  return { ok: true };
}

// Solo admin/super_admin (chequeado en prospeccionRoutes.js) -- crea el
// Cliente real precargado con el nombre/país del prospecto, usando la misma
// tabla `clientes` que Admin > Clientes. Deliberadamente NO borra ni desactiva
// el prospecto: queda como registro histórico, enlazado vía
// `convertido_cliente_id` para no volver a convertirlo por error.
export function convertirProspectoACliente(req, prospectoId) {
  const prospecto = db.prepare('SELECT * FROM prospectos WHERE id = ? AND activo = 1').get(prospectoId);
  if (!prospecto) return { status: 404, error: 'Prospecto no encontrado' };
  if (prospecto.convertido_cliente_id) return { status: 409, error: 'Este prospecto ya fue convertido a cliente' };

  const etapa = db.prepare('SELECT tipo FROM etapas_prospeccion WHERE codigo = ?').get(prospecto.etapa);
  if (etapa?.tipo !== 'ganada') {
    return { status: 400, error: 'Solo se puede convertir un prospecto marcado como Ganado' };
  }

  const info = db.prepare('INSERT INTO clientes (nombre, pais) VALUES (?, ?)').run(prospecto.nombre, prospecto.pais);
  db.prepare('UPDATE prospectos SET convertido_cliente_id = ? WHERE id = ?').run(info.lastInsertRowid, prospecto.id);

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  registrarActividad(req, {
    actor: req.user,
    accion: 'Prospecto convertido a cliente',
    detalle: `Convirtió el prospecto "${prospecto.nombre}" en el cliente #${cliente.id}`,
  });
  return { cliente: { id: cliente.id, nombre: cliente.nombre, pais: cliente.pais, activo: !!cliente.activo } };
}

// Reporte agregado: conteo + valor por etapa (embudo), tasa de conversión
// (ganados / (ganados + perdidos), ambos ya cerrados) y ganado por mes de los
// últimos 6 meses -- todo respetando la misma visibilidad que listarProspectos.
export function getReporteProspeccion(user) {
  const ids = getProspectoIdsVisibles(user);
  if (ids !== null && ids.length === 0) {
    return { porEtapa: [], tasaConversion: 0, ganadoPorMes: [] };
  }
  const filtroIds = ids === null ? '' : `AND id IN (${ids.map(() => '?').join(',')})`;
  const params = ids ?? [];

  const etapas = getEtapasProspeccion();
  const porEtapa = etapas.map((etapa) => {
    const fila = db
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(valor_estimado), 0) AS valor FROM prospectos WHERE activo = 1 AND etapa = ? ${filtroIds}`)
      .get(etapa.codigo, ...params);
    return { etapa: etapa.codigo, nombre: etapa.nombre, tipo: etapa.tipo, cantidad: fila.n, valor: fila.valor };
  });

  const ganados = porEtapa.find((e) => e.tipo === 'ganada')?.cantidad ?? 0;
  const perdidos = porEtapa.find((e) => e.tipo === 'perdida')?.cantidad ?? 0;
  const tasaConversion = ganados + perdidos > 0 ? Math.round((ganados / (ganados + perdidos)) * 100) : 0;

  const ganadoPorMes = db
    .prepare(
      `SELECT strftime('%Y-%m', updated_at) AS mes, COUNT(*) AS n, COALESCE(SUM(valor_estimado), 0) AS valor
       FROM prospectos
       WHERE activo = 1 AND etapa IN (SELECT codigo FROM etapas_prospeccion WHERE tipo = 'ganada') ${filtroIds}
         AND updated_at >= datetime('now', '-6 months')
       GROUP BY mes ORDER BY mes`
    )
    .all(...params);

  return { porEtapa, tasaConversion, ganadoPorMes };
}
