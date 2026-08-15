import db from './db.js';

export function requireUser(req, res, next) {
  const user = req.session.userId
    ? db.prepare('SELECT * FROM users WHERE id = ? AND activo = 1').get(req.session.userId)
    : null;

  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    clienteId: user.cliente_id,
  };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}
