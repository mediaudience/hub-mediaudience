// Gestor de presentaciones (Admin > Material Comercial, solo Super Admin).
// Compartido entre server/presentacionesRoutes.js (validación) y la pantalla
// del gestor, para que los productos y los datos editables no se desincronicen.
// El generador vive fuera del repo (PRESENTACIONES_DIR) y lee estas mismas
// claves: si se agrega un campo acá, también va en paises/peru.py de allá.

// Mismo orden y claves que CATALOGO en deck/generar.py.
export const PRODUCTOS_PRESENTACION = [
  { clave: "ctv", nombre: "Connected TV", laminas: 4 },
  { clave: "push", nombre: "Mobile Push Premium", laminas: 4 },
  { clave: "sqreem", nombre: "Sqreem IA · curaduría de audiencias", laminas: 3 },
  { clave: "programatica", nombre: "Programática y rich media", laminas: 6 },
  { clave: "roblox", nombre: "Roblox", laminas: 4 },
  { clave: "gaming", nombre: "Blended In-Game", laminas: 3 },
  { clave: "performance", nombre: "Performance Web y App", laminas: 3 },
  { clave: "onsite", nombre: "Performance OnSite", laminas: 3 },
];

// Láminas fijas aparte de los productos: portada, quiénes somos, objetivo,
// full funnel, clientes y cierre.
export const LAMINAS_FIJAS = 6;

// tipo: texto | largo (texto de varias líneas) | lista (un ítem por línea) |
// kpi ([cifra, etiqueta]) | kpis (varios kpi) | filas (columnas separadas por "|").
// pais: true = dato propio de cada país; en un país nuevo arranca vacío (y su
// bloque no sale) en vez de copiar la cifra de Perú.
export const CAMPOS_PRESENTACION = [
  { clave: "PAIS", seccion: "general", etiqueta: "Nombre del país", tipo: "texto", pais: true },
  { clave: "ETIQUETA", seccion: "general", etiqueta: "Pie de cada lámina", tipo: "texto", pais: true },
  // La portada es solo el logo grande y el slogan (pedido de Jose 2026-10-26).
  { clave: "PORTADA_FRASE", seccion: "portada", etiqueta: "Frase debajo del logo (las palabras entre *asteriscos* van en celeste)", tipo: "texto" },
  { clave: "PORTADA_SLOGAN", seccion: "portada", etiqueta: "Slogan (al pie)", tipo: "texto" },
  { clave: "QUIENES_TITULO", seccion: "general", etiqueta: "Quiénes somos · título", tipo: "texto" },
  { clave: "QUIENES_PUNTOS", seccion: "general", etiqueta: "Quiénes somos · puntos", tipo: "lista" },
  { clave: "QUIENES_KPIS", seccion: "general", etiqueta: "Quiénes somos · cifras", tipo: "kpis" },
  { clave: "PRESENCIA", seccion: "general", etiqueta: "Países con presencia", tipo: "lista" },
  { clave: "FUNNEL", seccion: "general", etiqueta: "Full funnel", tipo: "filas", columnas: ["Etapa", "Soluciones", "Para qué"] },
  { clave: "CONTACTO", seccion: "general", etiqueta: "Contacto en el cierre", tipo: "lista", pais: true },

  { clave: "CTV_OPORTUNIDADES", seccion: "ctv", etiqueta: "Impresiones del país", tipo: "kpi", pais: true },
  { clave: "CTV_SSPS", seccion: "ctv", etiqueta: "Cantidad de SSPs", tipo: "texto" },
  { clave: "CTV_VENTAJAS", seccion: "ctv", etiqueta: "Ventajas de la tecnología SSP", tipo: "lista", pais: true },
  { clave: "CTV_SELLERS", seccion: "ctv", etiqueta: "Publishers (sellers)", tipo: "lista" },
  { clave: "CTV_PAGO", seccion: "ctv", etiqueta: "Plataformas de pago", tipo: "lista" },
  { clave: "CTV_FAST", seccion: "ctv", etiqueta: "Plataformas gratuitas (FAST)", tipo: "lista" },
  { clave: "CTV_VTR", seccion: "ctv", etiqueta: "VTR", tipo: "texto" },
  { clave: "CTV_VIEWABILITY", seccion: "ctv", etiqueta: "Viewability", tipo: "texto" },
  { clave: "CTV_COMPRA", seccion: "ctv", etiqueta: "Tipo de compra", tipo: "texto" },

  { clave: "TELCOS", seccion: "push", etiqueta: "Telcos integradas", tipo: "lista", pais: true },
  { clave: "PUSH_DISPOSITIVOS", seccion: "push", etiqueta: "Dispositivos del país", tipo: "kpi", pais: true },
  { clave: "PUSH_VENTAJAS", seccion: "push", etiqueta: "Ventajas Push Premium", tipo: "lista", pais: true },
  { clave: "PUSH_CARACTERISTICAS", seccion: "push", etiqueta: "Características del formato", tipo: "lista" },
  { clave: "PUSH_DISPLAY_CTR", seccion: "push", etiqueta: "CTR Display Notification", tipo: "texto" },
  { clave: "PUSH_VIDEO_CTR", seccion: "push", etiqueta: "CTR Video Push", tipo: "texto" },
  { clave: "PUSH_LATAM", seccion: "push", etiqueta: "Alcance Latam", tipo: "kpi" },
  { clave: "PUSH_DEMO_CTR", seccion: "push", etiqueta: "CTR del demo Push Premium", tipo: "texto" },
  { clave: "PUSH_COMPRA", seccion: "push", etiqueta: "Tipo de compra", tipo: "texto" },

  { clave: "SQREEM_KPIS", seccion: "sqreem", etiqueta: "Cifras de Sqreem", tipo: "kpis" },
  { clave: "SQREEM_COMPRA", seccion: "sqreem", etiqueta: "Tipo de compra", tipo: "texto" },

  { clave: "PROG_DSPS", seccion: "programatica", etiqueta: "Cantidad de DSPs", tipo: "texto" },
  { clave: "PROG_AUDIENCIAS", seccion: "programatica", etiqueta: "Audiencias exclusivas", tipo: "lista" },
  { clave: "PROG_COMPRA", seccion: "programatica", etiqueta: "Tipo de compra", tipo: "texto" },

  { clave: "ROBLOX_KPIS", seccion: "roblox", etiqueta: "Cifras de Roblox", tipo: "kpis", pais: true },
  { clave: "ROBLOX_CASO_TITULO", seccion: "roblox", etiqueta: "Caso de éxito · marca (vacío = sin lámina de caso)", tipo: "texto" },
  { clave: "ROBLOX_CASO_KPIS", seccion: "roblox", etiqueta: "Caso de éxito · cifras", tipo: "kpis" },
  { clave: "ROBLOX_CASO_TEXTO", seccion: "roblox", etiqueta: "Caso de éxito · texto", tipo: "largo" },

  { clave: "PERF_NO_PERFILES", seccion: "performance", etiqueta: "Límite de «no perfiles»", tipo: "texto" },
  { clave: "PERF_SMS_APERTURA", seccion: "performance", etiqueta: "Tasa de apertura SMS", tipo: "texto" },
  { clave: "PERF_COMPRA", seccion: "performance", etiqueta: "Tipo de compra", tipo: "texto" },
];

export const SECCIONES_PRESENTACION = [
  { clave: "portada", nombre: "Portada" },
  { clave: "general", nombre: "Datos generales" },
  ...PRODUCTOS_PRESENTACION,
];

// Datos de un país que todavía no se configuró: los de Perú (la base), con
// los datos propios del país vacíos. En las listas se reemplaza "Perú" por
// el país para no arrancar con frases como "cualquier ciudad del Perú".
export function datosIniciales(base, pais) {
  const datos = structuredClone(base);
  if (pais.codigo === "PE") return datos;
  const cambiar = (t) =>
    String(t)
      .replace(/\b(del|el) Perú/g, (_, art) => (art === "del" ? `de ${pais.nombre}` : pais.nombre))
      .replace(/Perú/g, pais.nombre);
  for (const c of CAMPOS_PRESENTACION) {
    if (!c.pais) continue;
    // Un ítem con cifra de Perú ("más de 24 millones ... en todo el Perú") no se
    // traslada: sería un dato falso para el otro país.
    if (c.tipo === "lista")
      datos[c.clave] = (datos[c.clave] || []).filter((t) => !(/Perú/.test(t) && /\d/.test(t))).map(cambiar);
    else if (c.tipo === "kpi") datos[c.clave] = ["", ""];
    else if (c.tipo === "kpis") datos[c.clave] = [];
    else datos[c.clave] = "";
  }
  datos.PAIS = pais.nombre;
  datos.ETIQUETA = pais.nombre.toUpperCase();
  datos.CONTACTO = [];
  datos.TELCOS = [];
  return datos;
}
