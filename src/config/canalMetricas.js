// Fuente única de verdad de qué trae el Sheet de cada servicio y cómo se
// muestra en el panel. La usan tanto scripts/syncSheets.js (para saber qué
// pestañas leer del Sheet y qué campos parsear) como el frontend (para armar
// las pestañas de Rendimiento General, sus columnas y sus KPIs) -- así, sumar
// un servicio nuevo o ajustar sus columnas no requiere tocar el motor de sync
// ni los componentes de tabla, solo esta config.
//
// sheetTabs: pestañas reales del Sheet de este canal, con el nombre literal
// exacto (case-sensitive -- Sheets devuelve en silencio la primera pestaña si
// no coincide) y los campos a parsear por fila:
//   { header: <encabezado exacto en el Sheet>, key: <nombre en camelCase>, type }
//   type: "texto" | "numero" | "moneda" | "porcentaje" | "fecha" | "link"
//
// uiTabs: pestañas que ve el usuario en Rendimiento General. Cada una lee de
// un dataset (`source`, uno de los sheetTabs) y define:
//   columns: columnas de la tabla, en orden (key + label a mostrar)
//   kpis: tarjetas KPI arriba de la tabla, con `formula`:
//     - "suma": suma el campo `key` de todas las filas
//     - "ratio": numeradorKey / denominadorKey * 100, redondeado (para VTR%/CTR%)
//     - "cociente": numeradorKey / denominadorKey sin *100 (ej. CPA = Inversión / Conversiones)
//     - "promedio": promedio simple del campo `key` (fallback cuando no hay
//       numerador/denominador crudo en el dataset para calcular el ratio real)

// Clave = slug de canal (como aparece en la URL /:canal y en cliente_canales.canal),
// no el `dir` de carpeta bajo src/data -- así el frontend (que solo conoce el
// slug vía useParams) puede leer esta config directo, sin necesidad de una
// vuelta extra al catálogo de canales solo para resolver dir.
export const CANAL_METRICAS = {
  "ctv-ott": {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Vistas Totales", key: "vistasTotales", type: "numero" },
          { header: "Quartil 25%", key: "quartil25", type: "numero" },
          { header: "Quartil 50%", key: "quartil50", type: "numero" },
          { header: "Quartil 75%", key: "quartil75", type: "numero" },
          { header: "Quartil 100%", key: "quartil100", type: "numero" },
          { header: "VTR%", key: "vtr", type: "porcentaje" },
          { header: "Inversión", key: "inversion", type: "moneda" },
        ],
      },
      geo: {
        nombre: "Geo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Ubicación", key: "ubicacion", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Quartil 100%", key: "quartil100", type: "numero" },
          { header: "VTR%", key: "vtr", type: "porcentaje" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "detalle-diario",
        label: "Detalle Diario",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "inversion", label: "Inversión", align: "right", type: "moneda" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Inversión", key: "inversion", formula: "suma", type: "moneda" },
        ],
      },
      {
        key: "detalle-vistas",
        label: "Detalle Vistas",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "quartil25", label: "Quartil 25%", align: "right", type: "numero" },
          { key: "quartil50", label: "Quartil 50%", align: "right", type: "numero" },
          { key: "quartil75", label: "Quartil 75%", align: "right", type: "numero" },
          { key: "quartil100", label: "Quartil 100%", align: "right", type: "numero" },
          {
            key: "vtr",
            label: "VTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "vistasTotales",
            denominadorKey: "impresionesTotales",
          },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Quartil 100%", key: "quartil100", formula: "suma", type: "numero" },
          { label: "VTR%", formula: "ratio", numeradorKey: "vistasTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "geo",
        label: "Geo",
        source: "geo",
        totales: true,
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "quartil100", label: "Quartil 100%", align: "right", type: "numero" },
          { key: "vtr", label: "VTR%", align: "right", type: "porcentaje" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Quartil 100%", key: "quartil100", formula: "suma", type: "numero" },
          { label: "VTR%", key: "vtr", formula: "promedio", type: "porcentaje" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },

  "push-notification": {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
          { header: "Inversión", key: "inversion", type: "moneda" },
          { header: "Quartil 25%", key: "quartil25", type: "numero" },
          { header: "Quartil 50%", key: "quartil50", type: "numero" },
          { header: "Quartil 75%", key: "quartil75", type: "numero" },
          { header: "Quartil 100%", key: "quartil100", type: "numero" },
          { header: "VTR%", key: "vtr", type: "porcentaje" },
          { header: "Frecuencia", key: "frecuencia", type: "numero" },
          { header: "Alcance", key: "alcance", type: "numero" },
        ],
      },
      geo: {
        nombre: "Geo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Ubicación", key: "ubicacion", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "detalle-diario",
        label: "Detalle Diario",
        source: "diario",
        totales: true,
        // Únicas columnas del panel con `width` explícito: es la pestaña con
        // más columnas de todas (10) y con layout automático el texto largo
        // de Campaña le robaba espacio a Inversión (quedaba cortada) --
        // ver MetricsTable.jsx. El resto de las pestañas NO lleva `width` a
        // propósito, para no cambiarles el layout (pedido de Jose el 2026-08-24).
        columns: [
          { key: "fecha", label: "Fecha", width: 120 },
          { key: "campana", label: "Campaña", width: 210 },
          { key: "anunciante", label: "Anunciante", width: 170 },
          { key: "formato", label: "Formato", width: 110 },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero", width: 210 },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero", width: 150 },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
            width: 90,
          },
          {
            key: "frecuencia",
            label: "Frecuencia",
            align: "right",
            type: "decimal",
            numeradorKey: "impresionesTotales",
            denominadorKey: "alcance",
            width: 130,
          },
          { key: "alcance", label: "Alcance", align: "right", type: "numero", width: 130 },
          { key: "inversion", label: "Inversión", align: "right", type: "moneda", width: 120 },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "detalle-vistas",
        label: "Detalle Vistas",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "quartil25", label: "Quartil 25%", align: "right", type: "numero" },
          { key: "quartil50", label: "Quartil 50%", align: "right", type: "numero" },
          { key: "quartil75", label: "Quartil 75%", align: "right", type: "numero" },
          { key: "quartil100", label: "Quartil 100%", align: "right", type: "numero" },
          { key: "vtr", label: "VTR%", align: "right", type: "porcentaje" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "geo",
        label: "Geo",
        source: "geo",
        totales: true,
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },

  programatico: {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
          { header: "Vistas Totales", key: "vistasTotales", type: "numero" },
          { header: "Quartil 25%", key: "quartil25", type: "numero" },
          { header: "Quartil 50%", key: "quartil50", type: "numero" },
          { header: "Quartil 75%", key: "quartil75", type: "numero" },
          { header: "VTR%", key: "vtr", type: "porcentaje" },
        ],
      },
      geo: {
        nombre: "Geo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Ubicación", key: "ubicacion", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "detalle-diario",
        label: "Detalle Diario",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "detalle-vistas",
        label: "Detalle Vistas",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "vistasTotales", label: "Vistas Totales", align: "right", type: "numero" },
          { key: "quartil25", label: "Quartil 25%", align: "right", type: "numero" },
          { key: "quartil50", label: "Quartil 50%", align: "right", type: "numero" },
          { key: "quartil75", label: "Quartil 75%", align: "right", type: "numero" },
          {
            key: "vtr",
            label: "VTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "vistasTotales",
            denominadorKey: "impresionesTotales",
          },
        ],
        kpis: [
          { label: "Vistas Totales", key: "vistasTotales", formula: "suma", type: "numero" },
          { label: "VTR%", formula: "ratio", numeradorKey: "vistasTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "geo",
        label: "Geo",
        source: "geo",
        totales: true,
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },

  youtube: {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
          { header: "Vistas Totales", key: "vistasTotales", type: "numero" },
          { header: "Quartil 25%", key: "quartil25", type: "numero" },
          { header: "Quartil 50%", key: "quartil50", type: "numero" },
          { header: "Quartil 75%", key: "quartil75", type: "numero" },
          { header: "Quartil 100%", key: "quartil100", type: "numero" },
          { header: "Inversión", key: "inversion", type: "moneda" },
        ],
      },
      geo: {
        nombre: "Geo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Ubicación", key: "ubicacion", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "Vistas Totales", key: "vistasTotales", type: "numero" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "detalle-diario",
        label: "Detalle Diario",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
          { key: "inversion", label: "Inversión", align: "right", type: "moneda" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
          { label: "Inversión", key: "inversion", formula: "suma", type: "moneda" },
        ],
      },
      {
        key: "detalle-vistas",
        label: "Detalle Vistas",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "vistasTotales", label: "Vistas Totales", align: "right", type: "numero" },
          { key: "quartil25", label: "Quartil 25%", align: "right", type: "numero" },
          { key: "quartil50", label: "Quartil 50%", align: "right", type: "numero" },
          { key: "quartil75", label: "Quartil 75%", align: "right", type: "numero" },
          {
            key: "quartil100",
            label: "Quartil 100%",
            align: "right",
            type: "numero",
          },
        ],
        kpis: [
          { label: "Vistas Totales", key: "vistasTotales", formula: "suma", type: "numero" },
          { label: "Quartil 100%", key: "quartil100", formula: "suma", type: "numero" },
          { label: "VTR%", formula: "ratio", numeradorKey: "vistasTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "geo",
        label: "Geo",
        source: "geo",
        totales: true,
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          { key: "vistasTotales", label: "Vistas Totales", align: "right", type: "numero" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "Vistas Totales", key: "vistasTotales", formula: "suma", type: "numero" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },

  // Único canal con métricas de interacción (Me gusta/Seguidores/Comentarios/
  // Compartidos/Visitas al perfil) -- exclusivas de TikTok, pedido explícito
  // de Jose 2026-09-09 de no sumarlas a los otros canales. Por eso "diario"
  // acá alimenta 3 uiTabs (Alcance/Vistas/Interacciones) en vez de 2 como el
  // resto -- mismo patrón de 1 sheetTab -> N uiTabs que ya usan los demás,
  // solo que con un split más.
  tiktok: {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
          { header: "Alcance", key: "alcance", type: "numero" },
          { header: "Frecuencia", key: "frecuencia", type: "numero" },
          { header: "Vistas Totales", key: "vistasTotales", type: "numero" },
          { header: "Vistas 6 seg.", key: "vistas6seg", type: "numero" },
          { header: "Quartil 25%", key: "quartil25", type: "numero" },
          { header: "Quartil 50%", key: "quartil50", type: "numero" },
          { header: "Quartil 75%", key: "quartil75", type: "numero" },
          { header: "Quartil 100%", key: "quartil100", type: "numero" },
          { header: "Me gusta", key: "meGusta", type: "numero" },
          { header: "Seguidores", key: "seguidores", type: "numero" },
          { header: "Comentarios", key: "comentarios", type: "numero" },
          { header: "Compartidos", key: "compartidos", type: "numero" },
          { header: "Visitas al perfil", key: "visitasPerfil", type: "numero" },
          { header: "Inversión", key: "inversion", type: "moneda" },
        ],
      },
      geo: {
        nombre: "Geo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Ubicación", key: "ubicacion", type: "texto" },
          { header: "Impresiones Totales", key: "impresionesTotales", type: "numero" },
          { header: "Clics Totales", key: "clicsTotales", type: "numero" },
          { header: "CTR%", key: "ctr", type: "porcentaje" },
          { header: "Vistas 6 seg.", key: "vistas6seg", type: "numero" },
          { header: "Seguidores", key: "seguidores", type: "numero" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "detalle-alcance",
        label: "Detalle Alcance",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
          { key: "alcance", label: "Alcance", align: "right", type: "numero" },
          {
            key: "frecuencia",
            label: "Frecuencia",
            align: "right",
            type: "decimal",
            numeradorKey: "impresionesTotales",
            denominadorKey: "alcance",
          },
          { key: "inversion", label: "Inversión", align: "right", type: "moneda" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "detalle-vistas",
        label: "Detalle Vistas",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "vistasTotales", label: "Vistas Totales", align: "right", type: "numero" },
          { key: "vistas6seg", label: "Vistas 6 seg.", align: "right", type: "numero" },
          { key: "quartil25", label: "Quartil 25%", align: "right", type: "numero" },
          { key: "quartil50", label: "Quartil 50%", align: "right", type: "numero" },
          { key: "quartil75", label: "Quartil 75%", align: "right", type: "numero" },
          { key: "quartil100", label: "Quartil 100%", align: "right", type: "numero" },
        ],
        kpis: [
          { label: "Vistas Totales", key: "vistasTotales", formula: "suma", type: "numero" },
          { label: "Quartil 100%", key: "quartil100", formula: "suma", type: "numero" },
          { label: "% Vistas 6 seg.", formula: "ratio", numeradorKey: "vistas6seg", denominadorKey: "vistasTotales", type: "porcentaje" },
        ],
      },
      {
        key: "detalle-interacciones",
        label: "Detalle Interacciones",
        source: "diario",
        totales: true,
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "meGusta", label: "Me gusta", align: "right", type: "numero" },
          { key: "comentarios", label: "Comentarios", align: "right", type: "numero" },
          { key: "compartidos", label: "Compartidos", align: "right", type: "numero" },
          { key: "seguidores", label: "Seguidores", align: "right", type: "numero" },
          { key: "visitasPerfil", label: "Visitas al perfil", align: "right", type: "numero" },
        ],
        kpis: [
          { label: "Me gusta", key: "meGusta", formula: "suma", type: "numero" },
          { label: "Comentarios", key: "comentarios", formula: "suma", type: "numero" },
          { label: "Compartidos", key: "compartidos", formula: "suma", type: "numero" },
        ],
      },
      {
        key: "geo",
        label: "Geo",
        source: "geo",
        totales: true,
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "formato", label: "Formato" },
          { key: "ubicacion", label: "Ubicación" },
          { key: "impresionesTotales", label: "Impresiones Totales", align: "right", type: "numero" },
          { key: "clicsTotales", label: "Clics Totales", align: "right", type: "numero" },
          {
            key: "ctr",
            label: "CTR%",
            align: "right",
            type: "porcentaje",
            numeradorKey: "clicsTotales",
            denominadorKey: "impresionesTotales",
          },
          { key: "vistas6seg", label: "Vistas 6 seg.", align: "right", type: "numero" },
          { key: "seguidores", label: "Seguidores", align: "right", type: "numero" },
        ],
        kpis: [
          { label: "Impresiones Totales", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics Totales", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },
  // Performance (compra de leads / CPA) -- agregado 2026-11-24. A diferencia
  // de los servicios de medios, lo que se paga es una conversión (registro,
  // lead, venta), así que el reporte gira alrededor de Conversiones, CPA e
  // Inversión contra el budget/meta de cada campaña (pestaña "Campañas").
  // Plantilla base: tropicalización del reporte semanal del partner (Affise)
  // al formato MA. Impresiones vienen ESTIMADAS por el partner (CTR supuesto),
  // por eso la etiqueta "(est.)" en el panel.
  performance: {
    sheetTabs: {
      diario: {
        nombre: "Diario",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Fecha", key: "fecha", type: "fecha" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Fuente de tráfico", key: "fuente", type: "texto" },
          { header: "Impresiones (estimadas)", key: "impresionesTotales", type: "numero" },
          { header: "Clics", key: "clicsTotales", type: "numero" },
          { header: "Conversiones aprobadas", key: "convAprobadas", type: "numero" },
          { header: "Conversiones en revisión", key: "convRevision", type: "numero" },
          { header: "Conversiones rechazadas", key: "convRechazadas", type: "numero" },
          { header: "Inversión", key: "inversion", type: "moneda" },
          { header: "Notas", key: "notas", type: "texto" },
        ],
        // Calculados por el sync en cada fila (no se escriben en el Sheet):
        // valor = numerador / denominador * factor, 0 si el denominador es 0.
        derivados: [
          { key: "ctr", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", factor: 100 },
          { key: "cr", numeradorKey: "convAprobadas", denominadorKey: "clicsTotales", factor: 100 },
          { key: "cpa", numeradorKey: "inversion", denominadorKey: "convAprobadas", factor: 1 },
        ],
      },
      metas: {
        nombre: "Campañas",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Evento pagable", key: "eventoPagable", type: "texto" },
          { header: "CPA objetivo", key: "cpaObjetivo", type: "moneda" },
          { header: "Budget", key: "budget", type: "moneda" },
          { header: "Meta de conversiones", key: "metaConversiones", type: "numero" },
          { header: "Inicio", key: "inicio", type: "fecha" },
          { header: "Fin", key: "fin", type: "fecha" },
        ],
      },
      testigo: {
        nombre: "Testigo",
        campos: [
          { header: "Campaña", key: "campana", type: "texto" },
          { header: "Anunciante", key: "anunciante", type: "texto" },
          { header: "Motivo", key: "motivo", type: "texto" },
          { header: "Mes", key: "mes", type: "texto" },
          { header: "Formato", key: "formato", type: "texto" },
          { header: "Link", key: "link", type: "link" },
        ],
      },
    },
    uiTabs: [
      {
        key: "resumen",
        label: "Resumen",
        source: "diario",
        vista: "performance-resumen",
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "clicsTotales", label: "Clics", type: "numero" },
          { key: "convAprobadas", label: "Conversiones aprobadas", type: "numero" },
          { key: "inversion", label: "Inversión", type: "moneda" },
        ],
        kpis: [
          { label: "Inversión", key: "inversion", formula: "suma", type: "moneda" },
          { label: "Conversiones aprobadas", key: "convAprobadas", formula: "suma", type: "numero" },
          { label: "CPA real", formula: "cociente", numeradorKey: "inversion", denominadorKey: "convAprobadas", type: "moneda" },
          { label: "Clics", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "Tasa de conversión", formula: "ratio", numeradorKey: "convAprobadas", denominadorKey: "clicsTotales", type: "porcentaje" },
        ],
      },
      {
        key: "detalle-diario",
        label: "Detalle Diario",
        source: "diario",
        totales: true,
        // Anchos fijos: las Notas del partner son largas y sin ancho estiraban
        // cada fila; con ancho fijo se recortan y se leen completas al pasar el mouse.
        // Sin CPA por día: los días sin conversiones mostraban $0,00 (engañoso);
        // el CPA real vive en las KPI de Resumen.
        columns: [
          { key: "fecha", label: "Fecha", width: 120 },
          { key: "campana", label: "Campaña", width: 240 },
          { key: "fuente", label: "Fuente", width: 150 },
          { key: "impresionesTotales", label: "Impresiones (est.)", align: "right", type: "numero", width: 160 },
          { key: "clicsTotales", label: "Clics", align: "right", type: "numero", width: 90 },
          { key: "ctr", label: "CTR%", align: "right", type: "porcentaje", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", width: 80 },
          { key: "convAprobadas", label: "Aprobadas", align: "right", type: "numero", width: 120 },
          { key: "convRevision", label: "En revisión", align: "right", type: "numero", width: 125 },
          { key: "convRechazadas", label: "Rechazadas", align: "right", type: "numero", width: 125 },
          { key: "cr", label: "CR%", align: "right", type: "porcentaje", numeradorKey: "convAprobadas", denominadorKey: "clicsTotales", width: 80 },
          { key: "inversion", label: "Inversión", align: "right", type: "moneda", width: 110 },
          { key: "notas", label: "Notas", width: 340 },
        ],
        kpis: [
          { label: "Impresiones (est.)", key: "impresionesTotales", formula: "suma", type: "numero" },
          { label: "Clics", key: "clicsTotales", formula: "suma", type: "numero" },
          { label: "CTR%", formula: "ratio", numeradorKey: "clicsTotales", denominadorKey: "impresionesTotales", type: "porcentaje" },
        ],
      },
      {
        key: "testigo",
        label: "Testigo",
        source: "testigo",
        columns: [
          { key: "campana", label: "Campaña" },
          { key: "anunciante", label: "Anunciante" },
          { key: "motivo", label: "Motivo" },
          { key: "formato", label: "Formato" },
          { key: "mes", label: "Mes" },
          { key: "link", label: "Testigo", type: "link" },
        ],
        kpis: [],
      },
    ],
  },
};

export function getCanalMetricas(canal) {
  return CANAL_METRICAS[canal];
}
