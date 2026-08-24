import db from './db.js';

// nginx corre delante de Express y ya manda X-Real-IP (ver /etc/nginx/sites-available/mediaudience-panel)
// -- sin esto, toda request quedaría con la IP local del proxy (127.0.0.1).
function ipDeRequest(req) {
  return req?.headers?.['x-real-ip'] || req?.ip || null;
}

// `actor` es el usuario que hizo la acción (para login/logout, el mismo que
// se autentica; para una acción de gestión, quien la ejecuta -- ej. el Admin
// que edita a otro usuario). Puede venir de `req.user` (ya autenticado) o de
// un registro de `users` leído a mano (login recién resuelto, antes de que
// exista sesión). `actor` puede ser null (ej. login fallido con un email que
// no existe en el sistema) -- en ese caso solo se guarda el email intentado.
export function registrarActividad(req, { actor, actorEmail, accion, detalle }) {
  db.prepare(
    'INSERT INTO activity_log (actor_user_id, actor_email, accion, detalle, ip) VALUES (?, ?, ?, ?, ?)'
  ).run(actor?.id ?? null, actorEmail ?? actor?.email ?? null, accion, detalle ?? null, ipDeRequest(req));
}
