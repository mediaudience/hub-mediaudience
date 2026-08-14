import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "../../utils/format";
import Card from "./Card";

const SHADES = ["#57007E", "#7A1AA6", "#9B3FC0", "#B85FD1", "#D096E0", "#E8C6EF"];

export default function DonutWithTable({ title, data, labelHeader, valueHeader = "Impresiones Totales" }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card className="p-5">
      {title && <h3 className="text-brand-purple font-bold text-sm mb-4">{title}</h3>}
      <div className="flex flex-wrap items-center gap-4 sm:gap-8">
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SHADES[i % SHADES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${((value / total) * 100).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
          {data.length === 1 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-brand-purple">100%</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-sm text-gray-700">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: SHADES[i % SHADES.length] }}
              />
              {d.label}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-[220px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-label text-left">
                <th className="font-semibold pb-2">{labelHeader}</th>
                <th className="font-semibold pb-2 text-right">{valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-slate-100">
                  <td className="py-1.5 text-gray-700">{d.label}</td>
                  <td className="py-1.5 text-right text-gray-700">{formatNumber(d.value)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-bold text-gray-900">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{formatNumber(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
