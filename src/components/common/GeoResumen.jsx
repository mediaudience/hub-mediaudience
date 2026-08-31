import { formatNumber, formatCurrency } from "../../utils/format";
import { calcularAgregado } from "../../utils/agregaciones";
import Card from "./Card";

const FORMATTERS = {
  numero: formatNumber,
  moneda: formatCurrency,
  porcentaje: (v) => `${(v ?? 0).toFixed(2)}%`,
};

// Recorta el prefijo "Provincia de/del " del Sheet solo para esta tabla --
// puramente cosmético, la coincidencia real contra la geometría (GeoMap.jsx /
// provinciasIndex.js) sigue usando el texto crudo tal cual.
function nombreCorto(ubicacion) {
  return String(ubicacion ?? "").replace(/^provincia\s+(de|del)\s+/i, "");
}

// "Impresiones Totales" -> "Impresiones", "Clics Totales" -> "Clics" -- pedido
// explícito de Jose el 2026-08-31 solo para esta tabla (el label completo de
// canalMetricas.js lo siguen usando las KPICard de arriba y MetricsTable).
function etiquetaCorta(label) {
  return label.replace(/\s*totales\s*$/i, "").trim();
}

// Ancho de columna de ubicación y de cada columna de métrica -- fijos los
// dos (no solo las métricas) para que la tabla no quede con un hueco
// asimétrico entre "Ubicación" y los datos cuando el nombre de la provincia
// es corto (antes esa columna se estiraba para ocupar todo el ancho sobrante
// del layout table-fixed). 108px le da aire de sobra a "Impresiones", el
// label más largo tras acortar (ver etiquetaCorta).
const ANCHO_UBICACION = 176;
const ANCHO_METRICA = 108;

// Tabla resumida por ubicación al lado del mapa de la pestaña Geo (mapa y
// tabla a mitad de ancho cada uno): una fila por provincia/país/ciudad con
// TODAS sus métricas. Columnas a ancho fijo simétrico -- solo scroll
// vertical si hay muchas filas (23 provincias, por ejemplo), nunca
// horizontal. Mismo agrupamiento por `ubicacion` y misma agregación
// (`calcularAgregado`) que ya usa GeoMap.jsx para colorear el mapa, para que
// ambos coincidan siempre.
export default function GeoResumen({ rows, columns }) {
  const metricCols = columns.filter((c) => c.type === "numero" || c.type === "moneda" || c.type === "porcentaje");

  const grupos = new Map();
  for (const row of rows) {
    const clave = row.ubicacion || "Sin ubicación";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(row);
  }

  const items = [...grupos.entries()]
    .map(([ubicacion, filas]) => ({
      ubicacion,
      metricas: metricCols.map((col) => ({ ...col, valor: calcularAgregado(col, filas) })),
    }))
    .sort((a, b) => (b.metricas[0]?.valor ?? 0) - (a.metricas[0]?.valor ?? 0));

  if (items.length === 0) return null;

  return (
    <Card hover={false} className="overflow-hidden">
      <div className="max-h-[420px] overflow-y-auto">
        <table className="text-sm table-fixed mx-auto">
          <colgroup>
            <col style={{ width: ANCHO_UBICACION }} />
            {metricCols.map((col) => (
              <col key={col.key} style={{ width: ANCHO_METRICA }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-brand-purple text-white text-left">
              <th className="px-4 py-3 font-semibold sticky top-0 bg-brand-purple">Ubicación</th>
              {metricCols.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-semibold text-right sticky top-0 bg-brand-purple whitespace-nowrap"
                >
                  {etiquetaCorta(col.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.ubicacion}
                className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
              >
                <td className="px-4 py-3 text-gray-800 truncate" title={item.ubicacion}>
                  {nombreCorto(item.ubicacion)}
                </td>
                {item.metricas.map((m) => (
                  <td key={m.key} className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                    {FORMATTERS[m.type] ? FORMATTERS[m.type](m.valor) : m.valor}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
