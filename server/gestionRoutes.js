import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { requireUser } from './middleware.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GESTION_DIR = path.join(__dirname, '..', 'src', 'data', 'gestion');

// Data administrativa de Campañas Servidas / Facturación -- sincronizada por
// país desde scripts/syncGestionSheets.js, sin relación a clientes ni
// anunciantes. Admin/Super Admin ven todos los países; usuario_interno ve
// solo el suyo (filasVisibles) -- usuario_externo nunca ve esta sección,
// bloqueado explícito acá en vez de confiar solo en que la visibilidad
// devuelva vacío (mismo patrón que prospeccionRoutes.js).
const router = Router();
router.use(requireUser);

router.use((req, res, next) => {
  if (req.user.rol === 'usuario_externo') return res.status(403).json({ error: 'No autorizado' });
  next();
});

async function leerAgregado(nombre) {
  try {
    return JSON.parse(await readFile(path.join(GESTION_DIR, `${nombre}.json`), 'utf-8'));
  } catch {
    return [];
  }
}

// usuario_interno tiene un código de país (Admin > Usuarios, ej. "PE") pero
// las filas sincronizadas traen el nombre completo (ej. "Perú", ver
// scripts/syncGestionSheets.js) -- hay que resolver el nombre antes de
// comparar. Sin país asignado, no ve nada (mismo criterio que
// getClienteIdsVisibles en dataAccess.js).
function filasVisibles(user, filas) {
  if (user.rol === 'super_admin' || user.rol === 'admin') return filas;
  if (!user.pais) return [];
  const paisRow = db.prepare('SELECT nombre FROM paises WHERE codigo = ?').get(user.pais);
  if (!paisRow) return [];
  return filas.filter((f) => f.pais === paisRow.nombre);
}

router.get('/campanas-servidas', async (req, res) => {
  res.json({ filas: filasVisibles(req.user, await leerAgregado('campanas-servidas')) });
});

router.get('/facturacion', async (req, res) => {
  res.json({ filas: filasVisibles(req.user, await leerAgregado('facturacion')) });
});

export default router;
