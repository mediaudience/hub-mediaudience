import db from './db.js';
import { getCanalesContratados } from './dataAccess.js';

const HORA = 1000 * 60 * 60;

// Usuario Externo son cuentas de clientes fuera de la organización: si alguien
// deja una sesión abierta en un equipo compartido, el margen de exposición debe
// ser menor que para el staff interno.
export const LIMITE_INACTIVIDAD_MS = {
  super_admin: 4 * HORA,
  admin: 4 * HORA,
  usuario_interno: 4 * HORA,
  usuario_externo: 2 * HORA,
};

// Tope absoluto de una sesión aunque el usuario esté activo todo el tiempo:
// obliga a re-autenticar al menos una vez al día.
export const SESION_MAXIMA_MS = 24 * HORA;

export function requireUser(req, res, next) {
  const user = req.session.userId
    ? db.prepare('SELECT * FROM users WHERE id = ? AND activo = 1').get(req.session.userId)
    : null;

  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const ahora = Date.now();
  const limiteInactividad = LIMITE_INACTIVIDAD_MS[user.rol] ?? LIMITE_INACTIVIDAD_MS.usuario_interno;
  const inactivo = ahora - (req.session.ultimaActividad ?? ahora) > limiteInactividad;
  const expiroSesionMaxima = ahora - (req.session.iniciadaEn ?? ahora) > SESION_MAXIMA_MS;

  if (inactivo || expiroSesionMaxima) {
    req.session.userId = null;
    db.prepare('UPDATE users SET requiere_otp = 1 WHERE id = ?').run(user.id);
    return res.status(401).json({
      error: 'Tu sesión expiró por inactividad. Vuelve a ingresar con tu usuario y contraseña.',
      code: 'SESSION_EXPIRED',
    });
  }

  req.session.ultimaActividad = ahora;
  req.user = {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    clienteId: user.cliente_id,
    pais: user.pais,
    perfil: user.perfil,
    debeCambiarPassword: !!user.debe_cambiar_password,
    canalesContratados: getCanalesContratados({ id: user.id, rol: user.rol, clienteId: user.cliente_id }),
  };
  next();
}

// Admin y Super Admin gestionan el panel de Administración; Usuario Interno ve
// datos sin filtrar (dataAccess.js) pero no gestiona usuarios/clientes.
const STAFF_ROLES = ['super_admin', 'admin'];

export function requireAdmin(req, res, next) {
  if (!STAFF_ROLES.includes(req.user.rol)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user.rol !== 'super_admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}
