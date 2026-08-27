import db from '../server/db.js';

const DIAS_RETENCION = 90;

const resultado = db
  .prepare("DELETE FROM activity_log WHERE created_at < datetime('now', ?)")
  .run(`-${DIAS_RETENCION} days`);

console.log(`Actividad: ${resultado.changes} registro(s) de más de ${DIAS_RETENCION} días eliminados.`);
