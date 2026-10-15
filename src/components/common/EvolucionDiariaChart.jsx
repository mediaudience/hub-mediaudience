import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "./Card";
import { calcularAgregado } from "../../utils/agregaciones";
import { formatNumber } from "../../utils/format";

const PURPLE = "#58B0FF";
const MAGENTA = "#3FDDB0";

// "2026-08-15" (fecha ya normalizada por el sync, ver parseFechaEs en
// scripts/syncSheets.js) -> "15/08", más compacto para el eje X.
function fechaCorta(fecha) {
  const partes = String(fecha ?? "").split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : fecha;
}

function kFormat(v) {
  return v >= 1000 ? `${Math.round(v / 1000)}K` : formatNumber(v);
}

function TooltipEvolucion({ active, payload, tieneClics }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-ink-deep border border-line text-gray-900 text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-semibold text-gray-500 mb-1">{row.fecha}</p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: PURPLE }} />
        Impresiones: <b className="ml-0.5">{formatNumber(row.impresionesTotales)}</b>
      </p>
      {tieneClics && (
        <p className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: MAGENTA }} />
          Clics: <b className="ml-0.5">{formatNumber(row.clicsTotales)}</b>
        </p>
      )}
    </div>
  );
}

// Evolución diaria arriba de la tabla de Detalle Diario (mismo lugar que
// "Evolución de Ingresos" en Adops360 Monetización > Vista General, pedido
// explícito de Jose el 2026-08-31, con los colores de marca de Mediaudience).
//
// Impresiones es la única línea/eje (está en los 4 servicios, ver
// canalMetricas.js) -- Clics NO va en un segundo panel/eje: dos rondas de
// feedback de Jose el mismo día descartaron esa idea porque Impresiones y
// Clics viven en escalas muy distintas (miles vs. decenas) y una segunda
// línea/panel queda aplastada contra el piso. En cambio, Clics se codifica
// como el TAMAÑO del punto sobre la misma línea de Impresiones (punto chico
// = pocos clics ese día, punto grande = muchos) -- un solo eje, sin
// distorsión. CTV-OTT no trae Clics en su Sheet: ahí el punto queda a tamaño
// fijo, sin la variación (mismo criterio "opt-in, se adapta a lo que haya"
// que ya usa GeoResumen.jsx en la pestaña Geo).
export default function EvolucionDiariaChart({ rows, columns }) {
  const impresionesCol = columns.find((c) => c.key === "impresionesTotales");
  const clicsCol = columns.find((c) => c.key === "clicsTotales");

  const porDia = useMemo(() => {
    if (!impresionesCol) return [];
    const grupos = new Map();
    for (const row of rows) {
      const fecha = row.fecha;
      if (!fecha) continue;
      if (!grupos.has(fecha)) grupos.set(fecha, []);
      grupos.get(fecha).push(row);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, filas]) => ({
        fecha: fechaCorta(fecha),
        impresionesTotales: calcularAgregado(impresionesCol, filas),
        ...(clicsCol ? { clicsTotales: calcularAgregado(clicsCol, filas) } : {}),
      }));
  }, [rows, impresionesCol, clicsCol]);

  // Escala del tamaño del punto -- 3px a 10px de radio, sobre el rango real
  // de Clics del período filtrado (no un valor fijo), igual criterio de
  // "magnitud relativa al propio dataset" que ya usa GeoMap.jsx para el
  // color de los países/provincias.
  const radioDe = useMemo(() => {
    if (!clicsCol) return () => 4;
    const valores = porDia.map((d) => d.clicsTotales ?? 0);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    if (max === min) return () => 6;
    return (v) => 3 + ((v - min) / (max - min)) * 7;
  }, [porDia, clicsCol]);

  if (!impresionesCol || porDia.length === 0) return null;

  return (
    <Card hover={false} className="relative overflow-hidden mb-6 p-0">
      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-medium text-gray-900 mb-1">Evolución Diaria</h3>
        <p className="text-xs text-slate-label mb-3">
          {clicsCol ? "Impresiones por día — el tamaño del punto marca los clics de ese día" : "Impresiones por día"}
        </p>

        {clicsCol && (
          <div className="flex items-center gap-6 mb-3 text-xs text-gray-600">
            <span className="flex items-center gap-2">
              <span className="inline-block w-5 h-[2px] rounded" style={{ background: PURPLE }} />
              Impresiones Totales
            </span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: MAGENTA }} />
                <span className="inline-block rounded-full" style={{ width: 14, height: 14, background: MAGENTA }} />
              </span>
              Clics (tamaño del punto)
            </span>
          </div>
        )}

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={porDia} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="evolucionAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PURPLE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#8A93A9" }} axisLine={{ stroke: "rgba(255,255,255,0.12)" }} minTickGap={28} />
            <YAxis tick={{ fontSize: 12, fill: "#8A93A9" }} axisLine={false} tickFormatter={kFormat} width={46} />
            <Tooltip content={<TooltipEvolucion tieneClics={!!clicsCol} />} />
            <Area
              type="monotone"
              dataKey="impresionesTotales"
              stroke={PURPLE}
              strokeWidth={2.2}
              fill="url(#evolucionAreaFill)"
              activeDot={{ r: 6, fill: PURPLE, stroke: "#0A0E17", strokeWidth: 2 }}
              dot={
                !clicsCol
                  ? false
                  : ({ cx, cy, payload, key }) =>
                      cx == null || cy == null ? null : (
                        <circle
                          key={key}
                          cx={cx}
                          cy={cy}
                          r={radioDe(payload.clicsTotales ?? 0)}
                          fill={MAGENTA}
                          stroke="#0A0E17"
                          strokeWidth={1.6}
                        />
                      )
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
