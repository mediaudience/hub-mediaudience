import { formatNumber } from "../../utils/format";
import Card from "./Card";

export default function PublisherPerformanceTable({ rows }) {
  return (
    <Card hover={false} className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-brand-purple text-white text-left">
            <th className="px-4 py-3 font-semibold">Mes</th>
            <th className="px-4 py-3 font-semibold">Publisher</th>
            <th className="px-4 py-3 font-semibold">Motivo</th>
            <th className="px-4 py-3 font-semibold text-right">Impresiones Totales</th>
            <th className="px-4 py-3 font-semibold text-right">Visualizaciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
            >
              <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">{r.mes}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.publisher}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.motivo}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.impresionesTotales)}</td>
              <td className="px-4 py-2.5 text-right text-gray-800">{formatNumber(r.visualizaciones)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
