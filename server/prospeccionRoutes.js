import { Router } from 'express';
import { requireUser } from './middleware.js';
import {
  getEtapasProspeccion,
  listarProspectos,
  crearProspecto,
  actualizarProspecto,
  listarActividadesProspecto,
  registrarActividadProspecto,
  convertirProspectoACliente,
  getReporteProspeccion,
} from './prospeccionAccess.js';

const router = Router();
router.use(requireUser);

// Prospección es para usuario_interno/admin/super_admin -- usuario_externo
// (cuentas de cliente) nunca debe llegar a esto, bloqueado explícito acá en
// vez de confiar solo en que la visibilidad devuelva vacío.
router.use((req, res, next) => {
  if (req.user.rol === 'usuario_externo') return res.status(403).json({ error: 'No autorizado' });
  next();
});

router.get('/etapas', (req, res) => {
  res.json({ etapas: getEtapasProspeccion() });
});

router.get('/prospectos', (req, res) => {
  res.json({ prospectos: listarProspectos(req.user) });
});

router.post('/prospectos', (req, res) => {
  const resultado = crearProspecto(req, req.body || {});
  if (resultado.error) return res.status(400).json({ error: resultado.error });
  res.status(201).json(resultado);
});

router.put('/prospectos/:id', (req, res) => {
  const resultado = actualizarProspecto(req, req.params.id, req.body || {});
  if (resultado.error) return res.status(resultado.status ?? 400).json({ error: resultado.error });
  res.json(resultado);
});

router.get('/prospectos/:id/actividades', (req, res) => {
  const resultado = listarActividadesProspecto(req, req.params.id);
  if (resultado.error) return res.status(resultado.status ?? 400).json({ error: resultado.error });
  res.json(resultado);
});

router.post('/prospectos/:id/actividades', (req, res) => {
  const resultado = registrarActividadProspecto(req, req.params.id, req.body || {});
  if (resultado.error) return res.status(resultado.status ?? 400).json({ error: resultado.error });
  res.status(201).json(resultado);
});

router.post('/prospectos/:id/convertir', (req, res) => {
  if (req.user.rol !== 'super_admin' && req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un Admin puede confirmar la conversión a cliente' });
  }
  const resultado = convertirProspectoACliente(req, req.params.id);
  if (resultado.error) return res.status(resultado.status ?? 400).json({ error: resultado.error });
  res.status(201).json(resultado);
});

router.get('/reporte', (req, res) => {
  res.json(getReporteProspeccion(req.user));
});

export default router;
