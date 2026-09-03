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
          { key: "frecuencia", label: "Frecuencia", align: "right", type: "numero", width: 130 },
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
};

export function getCanalMetricas(canal) {
  return CANAL_METRICAS[canal];
}
