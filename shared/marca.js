import { perfilPuedeVer } from "./perfilesInterno.js";

// Catálogo fijo de categorías de Admin > Material Comercial. Compartido entre
// server/marcaRoutes.js (validación) y src/pages/marca (agrupado y selector)
// para que nunca queden desincronizados.
export const CATEGORIAS_MARCA = [
  { codigo: "logos", nombre: "Logos e isotipos" },
  { codigo: "manual", nombre: "Manual de marca" },
  { codigo: "presentaciones", nombre: "Presentaciones comerciales" },
  { codigo: "plantillas", nombre: "Plantillas" },
  { codigo: "redes", nombre: "Redes sociales" },
  { codigo: "fondos", nombre: "Fondos de videollamada" },
  { codigo: "media_kit", nombre: "Media kit" },
  { codigo: "otros", nombre: "Otros" },
];

// Material que aplica a todos los países (logos, manual, etc.) -- se muestra
// como una pestaña más, antes de los países del catálogo `paises`.
export const PAIS_GLOBAL = { codigo: "GLOBAL", nombre: "Global" };

export const MARCA_MAX_MB = 60;

// Quién gestiona el registro de firmas (crear, editar y borrar las de otros):
// Admin y Super Admin, y los Manager de país (usuario_interno con perfil
// manager y país asignado; pedido de Jose 2026-10-26).
export function gestionaFirmas(user) {
  if (!user) return false;
  if (user.rol === "super_admin" || user.rol === "admin") return true;
  return paisFirmasManager(user) !== null;
}

// Código del país al que se limita un Manager en el registro de firmas (solo
// ve y gestiona las de su país). null = sin límite (Admin) o no gestiona.
export function paisFirmasManager(user) {
  if (user?.rol !== "usuario_interno" || user.perfil !== "manager") return null;
  return user.pais || null;
}

// Material Comercial por país (pedido de Jose 2026-10-28). Admin y Super Admin
// ven todos los países; un usuario_interno entra solo si su perfil incluye
// "materialComercial" (Manager y Ejecutivo Comercial) y ve Global + su país.
export function accedeMaterial(user) {
  if (user?.rol === "super_admin" || user?.rol === "admin") return true;
  return user?.rol === "usuario_interno" && perfilPuedeVer(user.perfil, "materialComercial");
}

// Países de Material Comercial que ve el usuario. null = todos.
export function paisesMaterial(user) {
  if (user?.rol === "super_admin" || user?.rol === "admin") return null;
  return [PAIS_GLOBAL.codigo, ...(user?.pais ? [user.pais] : [])];
}

export function puedeVerMaterial(user, pais) {
  const permitidos = paisesMaterial(user);
  return !permitidos || permitidos.includes(pais);
}
