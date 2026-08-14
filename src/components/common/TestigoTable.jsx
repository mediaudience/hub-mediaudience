import Card from "./Card";

export default function TestigoTable({ rows }) {
  return (
    <Card hover={false} className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-brand-purple text-white text-left">
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold">Campaña</th>
            <th className="px-4 py-3 font-semibold">Publisher</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Testigo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
            >
              <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">{r.fecha}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.campana}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.publisher}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.estado}</td>
              <td className="px-4 py-2.5">
                {r.testigoUrl ? (
                  <a href={r.testigoUrl} className="text-blue-600 hover:underline truncate block max-w-[220px]">
                    {r.testigoUrl}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
