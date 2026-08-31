import { formatNumber, formatCurrency } from "../../utils/format";
import { calcularAgregado } from "../../utils/agregaciones";
import Card from "./Card";

const FORMATTERS = {
  numero: formatNumber,
  moneda: formatCurrency,
  porcentaje: (v) => `${v ?? 0}%`,
};

// Recorta el prefijo "Provincia de/del " del Sheet solo para esta tabla
// angosta -- puramente cosmético, la coincidencia real contra la geometría
// (GeoMap.jsx / provinciasIndex.js) sigue usando el texto crudo tal cual.
function nombreCorto(ubicacion) {
  return String(ubicacion ?? "").replace(/^provincia\s+(de|del)\s+/i, "");
}

// Tabla resumida por ubicación al lado del mapa de la pestaña Geo (mapa a la
// derecha, esta tabla a la izquierda -- pedido explícito de Jose el
// 2026-08-31): una fila por provincia/país/ciudad con sus métricas, no solo
// los totales generales (que ya se ven arriba en las KPICard). Mismo
// agrupamiento por `ubicacion` y misma agregación (`calcularAgregado`) que ya
// usa GeoMap.jsx para colorear el mapa, para que ambos coincidan siempre.
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
    <Card hover={false} className="p-3 sm:p-4">
      <div className="max-h-[380px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-label">
              <th className="text-left font-medium pb-1.5 pr-2 sticky top-0 bg-white">Ubicación</th>
              {metricCols.map((col) => (
                <th key={col.key} className="text-right font-medium pb-1.5 pl-2 whitespace-nowrap sticky top-0 bg-white">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.ubicacion} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 text-gray-700 truncate max-w-[110px]" title={item.ubicacion}>
                  {nombreCorto(item.ubicacion)}
                </td>
                {item.metricas.map((m) => (
                  <td key={m.key} className="py-1.5 pl-2 text-right font-medium text-gray-900 whitespace-nowrap">
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
