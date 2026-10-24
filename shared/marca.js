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
