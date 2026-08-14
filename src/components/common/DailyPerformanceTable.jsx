import { useMemo, useState } from "react";
import { formatNumber } from "../../utils/format";
import Card from "./Card";

export default function DailyPerformanceTable({ rows, entityKey = "campana", entityLabel = "Campaña" }) {
  const [dir, setDir] = useState("desc");

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        dir === "asc" ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)
      ),
    [rows, dir]
  );

  return (
    <Card hover={false} className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="bg-brand-purple text-white text-left">
            <th className="px-4 py-3 font-semibold">
              <button
                type="button"
                onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="flex items-center gap-1"
              >
                Fecha
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={dir === "asc" ? "" : "rotate-180"}>
                  <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </th>
            <th className="px-4 py-3 font-semibold">{entityLabel}</th>
            <th className="px-4 py-3 font-semibold">Motivo</th>
            <th className="px-4 py-3 font-semibold text-right">Impresiones Totales</th>
            <th className="px-4 py-3 font-semibold text-right">Visualizaciones</th>
            <th className="px-4 py-3 font-semibold text-right">Quartil 25%</th>
            <th className="px-4 py-3 font-semibold text-right">Quartil 50%</th>
            <th className="px-4 py-3 font-semibold text-right">Quartil 75%</th>
            <th className="px-4 py-3 font-semibold text-right">Quartil 100%</th>
            <th className="px-4 py-3 font-semibold text-right">VTR</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={i}
              className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
            >
              <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">{r.fecha}</td>
              <td className="px-4 py-2.5 text-gray-800">{r[entityKey]}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.motivo}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.impresionesTotales)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.visualizaciones)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.quartil25)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.quartil50)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.quartil75)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.quartil100)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{r.vtr}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
