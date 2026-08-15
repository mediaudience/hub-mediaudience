import { Router } from 'express';
import { requireUser } from './middleware.js';
import { CANALES, getResumenGeneral, getRendimientoDiario } from './dataAccess.js';

const router = Router();
router.use(requireUser);

router.param('canal', (req, res, next, canal) => {
  const dir = CANALES[canal];
  if (!dir) return res.status(404).json({ error: 'Canal no encontrado' });
  req.canalDir = dir;
  next();
});

router.get('/:canal/resumen-general', async (req, res, next) => {
  try {
    res.json(await getResumenGeneral(req.canalDir, req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/:canal/rendimiento-diario', async (req, res, next) => {
  try {
    res.json(await getRendimientoDiario(req.canalDir, req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
