import { useEffect, useId, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { calcularAgregado } from "../../utils/agregaciones";
import { formatNumber, formatCurrency } from "../../utils/format";
import { coordenadasDe, normalizarUbicacion } from "../../data/geoCoordenadas";
import { indiceProvinciasDe, PAISES_CON_PROVINCIAS } from "../../data/provinciasIndex";
import Card from "./Card";

const FORMATTERS = {
  numero: formatNumber,
  moneda: formatCurrency,
  porcentaje: (v) => `${v ?? 0}%`,
};

const VIEW_W = 420;
const VIEW_H = 340;
const PAD = 32;

// Rampa secuencial (magnitud) en el tono de marca -- un solo hue, más oscuro
// = más impresiones. No es una paleta categórica (no aplica el validador de
// pares CVD de la skill de dataviz, que es para identidad, no magnitud).
const RAMPA_CLARA = [246, 217, 231];
const RAMPA_OSCURA = [122, 20, 69];
function colorPorMagnitud(t) {
  const mezclar = (i) => Math.round(RAMPA_CLARA[i] + (RAMPA_OSCURA[i] - RAMPA_CLARA[i]) * t);
  return `rgb(${mezclar(0)}, ${mezclar(1)}, ${mezclar(2)})`;
}

// Resolución 50m (Natural Earth 1:50,000,000) en vez de la 110m usada al
// principio -- a 110m un país chico como Ecuador se ve notoriamente
// cuadriculado/poligonal (muy pocos vértices en la costa); a 50m el contorno
// ya se ve realista. El archivo pesa ~230KB comprimido (vs ~39KB de 110m),
// así que se carga con `import()` dinámico recién cuando se monta el mapa
// (pestaña Geo abierta) en vez de ir en el bundle inicial de toda la app.
async function cargarTopologiaMundo() {
  const mod = await import("world-atlas/countries-50m.json");
  return mod.default;
}

// Agrupa las filas ya filtradas por ubicación y agrega cada columna numérica
// declarada en canalMetricas.js (mismo criterio que la fila de Total de
// MetricsTable) -- el mapa siempre refleja las métricas reales del servicio
// activo, sin nada hardcodeado por canal.
function agruparPorUbicacion(rows, columns) {
  const metricCols = columns.filter((c) => c.type === "numero" || c.type === "moneda" || c.type === "porcentaje");
  const grupos = new Map();
  for (const row of rows) {
    const clave = row.ubicacion || "Sin ubicación";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(row);
  }
  return [...grupos.entries()].map(([ubicacion, filas]) => ({
    ubicacion,
    metricas: metricCols.map((col) => ({ ...col, valor: calcularAgregado(col, filas) })),
  }));
}

// Un color por métrica (no por ubicación) para diferenciarlas de un vistazo
// dentro del tooltip -- las 3 vienen siempre en el mismo orden (2 conteos +
// 1 porcentaje, ver canalMetricas.js), así que alcanza con un color fijo por
// posición. Las 3 tonalidades salen de la marca (magenta, morado, y un
// magenta más claro para la métrica de porcentaje) en vez de inventar un
// cuarto hue -- el valor en sí sigue en tinta oscura (nunca coloreado),
// el color solo vive en el punto identificador.
const COLOR_POR_METRICA = ["#c4216f", "#57007e", "#e685ac"];

function Tooltip({ x, y, titulo, metricas }) {
  const left = Math.min(Math.max(x - 90, 0), VIEW_W - 180);
  const alto = 34 + metricas.length * 20;
  const top = Math.max(y - alto - 10, 0);
  return (
    // `overflow: visible` es necesario porque un <foreignObject> recorta su
    // contenido al width/height declarados por defecto (a diferencia de un
    // <div> normal) -- sin esto, cualquier fila que no entre justo en la
    // altura calculada (p.ej. la última métrica) se corta en silencio.
    <foreignObject x={left} y={top} width={180} height={alto} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-xs">
        <p className="font-bold text-brand-purple mb-1 truncate">{titulo}</p>
        {metricas.map((m, i) => (
          <p key={m.key} className="flex items-center justify-between gap-3 text-gray-700">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span
                className="inline-block rounded-full shrink-0"
                style={{ width: 7, height: 7, background: COLOR_POR_METRICA[i % COLOR_POR_METRICA.length] }}
              />
              {m.label}
            </span>
            <span className="font-semibold text-gray-900">
              {FORMATTERS[m.type] ? FORMATTERS[m.type](m.valor) : m.valor}
            </span>
          </p>
        ))}
      </div>
    </foreignObject>
  );
}

// Cada grupo de la tabla es un país (coincide con el nombre de un país real)
// o, si no matchea ninguno, una ciudad conocida en geoCoordenadas.js -- en
// ese caso se dibuja el país que la contiene como fondo (para dar contexto)
// y un punto encima en la ciudad exacta. Lo que no matchea ninguna de las dos
// formas se lista aparte, nunca se descarta en silencio. El mapa encuadra y
// dibuja SOLO estos países -- nunca el continente completo -- a pedido
// explícito de Jose el 2026-08-24 ("muestra solo el país, no todo el continente").
function resolverUbicaciones(grupos, featurePorNombre) {
  const paisesConDato = new Map(); // nombre real-earth -> grupo
  const ciudades = [];
  const sinUbicar = [];
  const paisesAMostrar = new Map(); // nombre -> feature (con o sin dato propio)

  for (const g of grupos) {
    const featurePais = featurePorNombre.get(normalizarUbicacion(g.ubicacion));
    if (featurePais) {
      paisesConDato.set(featurePais.properties.name, g);
      paisesAMostrar.set(featurePais.properties.name, featurePais);
      continue;
    }
    const coords = coordenadasDe(g.ubicacion);
    if (coords) {
      const featureContexto = featurePorNombre.get(normalizarUbicacion(coords.pais));
      if (featureContexto && !paisesAMostrar.has(featureContexto.properties.name)) {
        paisesAMostrar.set(featureContexto.properties.name, featureContexto);
      }
      ciudades.push({ ...g, coords });
      continue;
    }
    sinUbicar.push(g);
  }

  return { paisesConDato, ciudades, sinUbicar, paisesAMostrar };
}

const SIN_UBICACIONES = { paisesConDato: new Map(), ciudades: [], sinUbicar: [], paisesAMostrar: new Map() };

export default function GeoMap({ rows, columns }) {
  const [activo, setActivo] = useState(null);
  const [topologia, setTopologia] = useState(null);
  const [provincias, setProvincias] = useState(null);
  const gradId = useId();

  useEffect(() => {
    let cancelado = false;
    cargarTopologiaMundo().then((t) => {
      if (!cancelado) setTopologia(t);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Provincias/estados/departamentos registrados (ver src/data/provinciasIndex.js)
  // -- se cargan en paralelo al topojson mundial, uno por país registrado, y
  // se mezclan en un solo índice antes de fusionarlo con el de países.
  useEffect(() => {
    let cancelado = false;
    Promise.all(PAISES_CON_PROVINCIAS.map((pais) => indiceProvinciasDe(pais))).then((indices) => {
      if (cancelado) return;
      const combinado = new Map();
      for (const indice of indices) {
        if (!indice) continue;
        for (const [clave, feat] of indice) combinado.set(clave, feat);
      }
      setProvincias(combinado);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Países Y provincias comparten el mismo índice por nombre normalizado --
  // resolverUbicaciones no necesita saber la diferencia entre un dato a nivel
  // país o a nivel provincia, matchea igual en ambos casos.
  const featurePorNombre = useMemo(() => {
    if (!topologia || !provincias) return null;
    const mundo = feature(topologia, topologia.objects.countries);
    const mapa = new Map(mundo.features.map((f) => [normalizarUbicacion(f.properties.name), f]));
    for (const [clave, feat] of provincias) mapa.set(clave, feat);
    return mapa;
  }, [topologia, provincias]);

  const grupos = useMemo(() => agruparPorUbicacion(rows, columns), [rows, columns]);
  const sizeCol = columns.find((c) => c.type === "numero") ?? columns.find((c) => c.type === "moneda");

  const { paisesConDato, ciudades, sinUbicar, paisesAMostrar } = useMemo(
    () => (featurePorNombre ? resolverUbicaciones(grupos, featurePorNombre) : SIN_UBICACIONES),
    [grupos, featurePorNombre]
  );

  const { proyeccion, trazador, featuresAMostrar } = useMemo(() => {
    const features = [...paisesAMostrar.values()];
    if (features.length === 0) return { proyeccion: null, trazador: null, featuresAMostrar: features };
    const proy = geoMercator().fitExtent(
      [
        [PAD, PAD],
        [VIEW_W - PAD, VIEW_H - PAD],
      ],
      { type: "FeatureCollection", features }
    );
    return { proyeccion: proy, trazador: geoPath(proy), featuresAMostrar: features };
  }, [paisesAMostrar]);

  // Centro del resplandor de fondo: el promedio de los centroides de los
  // países mostrados, para que el degradado quede "detrás" de la forma en
  // vez de fijo al centro del canvas (que no siempre coincide, sobre todo
  // con un solo país chico encuadrado con harto padding alrededor).
  const centro = useMemo(() => {
    if (!trazador || featuresAMostrar.length === 0) return [VIEW_W / 2, VIEW_H / 2];
    const centros = featuresAMostrar.map((f) => trazador.centroid(f));
    return [
      centros.reduce((s, [x]) => s + x, 0) / centros.length,
      centros.reduce((s, [, y]) => s + y, 0) / centros.length,
    ];
  }, [trazador, featuresAMostrar]);

  const valores = [...paisesConDato.values(), ...ciudades].map(
    (g) => (sizeCol ? g.metricas.find((m) => m.key === sizeCol.key)?.valor ?? 0 : 0)
  );
  const valorMin = valores.length ? Math.min(...valores) : 0;
  const valorMax = valores.length ? Math.max(...valores) : 0;
  const normalizar01 = (valor) => (valorMax <= valorMin ? 0.65 : (valor - valorMin) / (valorMax - valorMin));

  if (!topologia || !provincias) {
    return (
      <Card hover={false} className="p-4 sm:p-5 text-xs text-gray-400">
        Cargando mapa…
      </Card>
    );
  }
  if (!proyeccion) return null;

  return (
    <Card hover={false} className="p-4 sm:p-5">
      <div className="relative w-full mx-auto" style={{ maxWidth: 480, aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full overflow-visible">
          <defs>
            <radialGradient id={gradId} cx={centro[0]} cy={centro[1]} r={Math.max(VIEW_W, VIEW_H) * 0.65} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c4216f" stopOpacity="0.12" />
              <stop offset="55%" stopColor="#57007e" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#57007e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={`url(#${gradId})`} />

          {featuresAMostrar.map((f) => {
            const dato = paisesConDato.get(f.properties.name);
            const valor = dato && sizeCol ? dato.metricas.find((m) => m.key === sizeCol.key)?.valor ?? 0 : null;
            const activoId = `pais-${f.properties.name}`;
            return (
              <path
                key={f.properties.name}
                d={trazador(f)}
                fill={valor !== null ? colorPorMagnitud(normalizar01(valor)) : "#f1f0f4"}
                stroke="white"
                strokeWidth={1.5}
                tabIndex={dato ? 0 : -1}
                role={dato ? "button" : undefined}
                aria-describedby={dato ? activoId : undefined}
                className={`transition-opacity outline-none ${dato ? "cursor-pointer focus-visible:stroke-brand-purple" : ""}`}
                style={{ opacity: activo === null || activo === activoId ? 1 : 0.6 }}
                onMouseEnter={() => dato && setActivo(activoId)}
                onMouseLeave={() => dato && setActivo(null)}
                onFocus={() => dato && setActivo(activoId)}
                onBlur={() => dato && setActivo(null)}
              >
                <title>{f.properties.name}</title>
              </path>
            );
          })}

          {ciudades.map((c) => {
            const [x, y] = proyeccion([c.coords.lon, c.coords.lat]);
            const valor = sizeCol ? c.metricas.find((m) => m.key === sizeCol.key)?.valor ?? 0 : 0;
            const r = 7 + normalizar01(valor) * 7;
            const activoId = `ciudad-${c.ubicacion}`;
            return (
              <g key={c.ubicacion}>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={colorPorMagnitud(normalizar01(valor))}
                  stroke="white"
                  strokeWidth={2}
                  tabIndex={0}
                  role="button"
                  aria-describedby={activoId}
                  className="cursor-pointer outline-none focus-visible:stroke-brand-purple"
                  style={{ opacity: activo === null || activo === activoId ? 1 : 0.6 }}
                  onMouseEnter={() => setActivo(activoId)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(activoId)}
                  onBlur={() => setActivo(null)}
                >
                  <title>{c.ubicacion}</title>
                </circle>
                <text x={x} y={y - r - 5} textAnchor="middle" className="fill-gray-700" style={{ fontSize: 9, fontWeight: 600, pointerEvents: "none" }}>
                  {c.ubicacion}
                </text>
              </g>
            );
          })}

          {[...paisesConDato.entries()].map(([nombre, g]) => {
            if (activo !== `pais-${nombre}`) return null;
            const feat = paisesAMostrar.get(nombre);
            const [x, y] = trazador.centroid(feat);
            return <Tooltip key={nombre} x={x} y={y} titulo={g.ubicacion} metricas={g.metricas} />;
          })}
          {ciudades.map((c) => {
            if (activo !== `ciudad-${c.ubicacion}`) return null;
            const [x, y] = proyeccion([c.coords.lon, c.coords.lat]);
            return <Tooltip key={c.ubicacion} x={x} y={y} titulo={c.ubicacion} metricas={c.metricas} />;
          })}
        </svg>
      </div>

      {sizeCol && valorMax > valorMin && (
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span className="text-gray-400">{sizeCol.label}:</span>
          <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: colorPorMagnitud(0.1) }} />
          {formatNumber(valorMin)}
          <span className="h-px w-8 bg-gray-300" />
          <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: colorPorMagnitud(0.95) }} />
          {formatNumber(valorMax)}
        </div>
      )}

      {sinUbicar.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Sin coordenada para mostrar en el mapa (siguen en la tabla): {sinUbicar.map((g) => g.ubicacion).join(", ")}
        </p>
      )}
    </Card>
  );
}
