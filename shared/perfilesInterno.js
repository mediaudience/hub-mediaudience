// Perfiles dentro del rol usuario_interno (Manager / Ejecutivo Comercial /
// Operaciones / Administrativo) -- capa adicional que no reemplaza país ni
// clientes asignados (server/db.js), que siguen controlando qué DATOS ve.
// Esto controla qué SECCIONES de Gestión/Campañas puede abrir. Un solo
// archivo compartido entre server/ y src/ para que el nav del frontend y el
// gating del backend nunca queden desincronizados.
//
// perfil = null (usuario_interno creado antes de esto, o sin perfil asignado
// todavía) ve todas las secciones -- mismo criterio retrocompatible que ya
// usa el resto del sistema de permisos (usuario_anunciantes, etc. en
// server/db.js): la restricción es opt-in, nunca le quita acceso a nadie que
// ya tenía.
export const PERFILES_INTERNO = [
  { codigo: "manager", nombre: "Manager" },
  { codigo: "ejecutivo_comercial", nombre: "Ejecutivo Comercial" },
  { codigo: "operaciones", nombre: "Operaciones" },
  { codigo: "administrativo", nombre: "Administrativo" },
];

const SECCIONES_POR_PERFIL = {
  manager: ["campanas", "prospeccion", "campanasServidas", "facturacion", "metasComerciales"],
  ejecutivo_comercial: ["campanas", "prospeccion", "campanasServidas", "facturacion", "metasComerciales"],
  operaciones: ["campanas", "campanasServidas"],
  administrativo: ["campanasServidas", "facturacion"],
};

export function perfilPuedeVer(perfil, seccion) {
  if (!perfil) return true;
  return SECCIONES_POR_PERFIL[perfil]?.includes(seccion) ?? false;
}
