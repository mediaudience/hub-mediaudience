import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { requireUser, requireAdmin } from './middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GESTION_DIR = path.join(__dirname, '..', 'src', 'data', 'gestion');

// Data administrativa de Campañas Servidas / Facturación -- sincronizada por
// país desde scripts/syncGestionSheets.js, sin relación a clientes ni
// anunciantes. Mismo criterio de acceso que las páginas del frontend
// (Admin/Super Admin únicamente, ver GESTION_NAV_GROUP en navConfig.js).
const router = Router();
router.use(requireUser, requireAdmin);

async function leerAgregado(nombre) {
  try {
    return JSON.parse(await readFile(path.join(GESTION_DIR, `${nombre}.json`), 'utf-8'));
  } catch {
    return [];
  }
}

router.get('/campanas-servidas', async (req, res) => {
  res.json({ filas: await leerAgregado('campanas-servidas') });
});

router.get('/facturacion', async (req, res) => {
  res.json({ filas: await leerAgregado('facturacion') });
});

export default router;
