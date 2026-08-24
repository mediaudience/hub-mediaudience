import { useMemo, useState } from "react";
import { formatNumber, formatCurrency } from "../../utils/format";
import { calcularAgregado } from "../../utils/agregaciones";
import Card from "./Card";

const FORMATTERS = {
  numero: formatNumber,
  moneda: formatCurrency,
  porcentaje: (v) => `${v ?? 0}%`,
};

// Tabla genérica de métricas: las columnas las define canalMetricas.js por
// servicio y por pestaña (Detalle Diario/Detalle Vistas/Geo difieren en qué
// columnas traen), en vez de tener un set de columnas fijo por componente
// como antes de la reestructuración de 2026-08-24.
//
// El ancho por columna es opt-in: solo si canalMetricas.js declara `width` en
// AL MENOS una columna de la pestaña se arma la tabla con `table-layout:
// fixed` + esos anchos -- necesario en Push Notification/Detalle Diario,
// donde el texto largo de Campaña le robaba espacio a Inversión (última
// columna) con el layout automático del navegador. El resto de las pestañas
// no declara `width` y sigue exactamente como estaba antes (layout
// automático) -- Jose pidió explícitamente no tocarlas.
export default function MetricsTable({ rows, columns, sortKey = "fecha", showTotals = false }) {
  const [dir, setDir] = useState("desc");
  const ordenable = columns.some((c) => c.key === sortKey);

  const sorted = useMemo(() => {
    if (!ordenable) return rows;
    return [...rows].sort((a, b) =>
      dir === "asc"
        ? String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""))
        : String(b[sortKey] ?? "").localeCompare(String(a[sortKey] ?? ""))
    );
  }, [rows, dir, ordenable, sortKey]);

  const anchoFijo = columns.some((c) => c.width);
  const anchoTotal = useMemo(
    () => (anchoFijo ? columns.reduce((s, c) => s + (c.width ?? 120), 0) : null),
    [columns, anchoFijo]
  );

  return (
    <Card hover={false} className="overflow-x-auto">
      <table
        className={anchoFijo ? "text-sm" : "w-full text-sm min-w-[900px]"}
        style={anchoFijo ? { tableLayout: "fixed", width: anchoTotal } : undefined}
      >
        {anchoFijo && (
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: col.width ?? 120 }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="bg-brand-purple text-white text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold ${anchoFijo ? "truncate" : ""} ${
                  col.align === "right" ? "text-right" : ""
                }`}
              >
                {col.key === sortKey && ordenable ? (
                  <button
                    type="button"
                    onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="flex items-center gap-1"
                  >
                    {col.label}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={dir === "asc" ? "" : "rotate-180"}>
                      <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={i}
              className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
            >
              {columns.map((col) => {
                const esNumerico = col.type === "numero" || col.type === "moneda" || col.type === "porcentaje";
                const valor = FORMATTERS[col.type] ? FORMATTERS[col.type](r[col.key]) : r[col.key];
                return (
                  <td
                    key={col.key}
                    title={anchoFijo && !esNumerico ? String(r[col.key] ?? "") : undefined}
                    className={`px-4 py-2.5 text-gray-800 ${col.align === "right" ? "text-right" : ""} ${
                      anchoFijo ? "whitespace-nowrap overflow-hidden text-ellipsis" : col.key === "fecha" ? "whitespace-nowrap" : ""
                    }`}
                  >
                    {valor}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {showTotals && (
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              {columns.map((col, i) => {
                const total = calcularAgregado(col, rows);
                return (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-gray-900 ${anchoFijo ? "whitespace-nowrap overflow-hidden text-ellipsis" : ""} ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {total !== null ? (FORMATTERS[col.type] ? FORMATTERS[col.type](total) : total) : i === 0 ? "Total" : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}
