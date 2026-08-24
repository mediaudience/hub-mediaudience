import { Router } from 'express';
import { requireUser } from './middleware.js';
import { getCanalesPublicos, getDirDeCanal, getRendimientoGeneral, getClientesVisibles } from './dataAccess.js';

const router = Router();
router.use(requireUser);

// Catálogo de servicios activos -- alimenta Sidebar/rutas del frontend, que ya
// no traen una lista hardcodeada de canales.
router.get('/', (req, res) => {
  res.json({ canales: getCanalesPublicos() });
});

// Clientes visibles del usuario a nivel de cuenta -- alimenta el selector de
// "Cliente activo" en el menú de la cuenta (Navbar), no depende del canal.
router.get('/clientes-visibles', (req, res) => {
  res.json({ clientes: getClientesVisibles(req.user) });
});

router.param('canal', (req, res, next, canal) => {
  const dir = getDirDeCanal(canal);
  if (!dir) return res.status(404).json({ error: 'Canal no encontrado' });
  req.canalDir = dir;
  next();
});

router.get('/:canal/rendimiento-general', async (req, res, next) => {
  try {
    res.json(await getRendimientoGeneral(req.canalDir, req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
