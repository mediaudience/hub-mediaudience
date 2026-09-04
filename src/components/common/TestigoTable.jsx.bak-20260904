import Card from "./Card";

function EstadoBadge({ estado }) {
  const esVerificado = estado === "Verificado";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        esVerificado ? "bg-green-100 text-green-700" : "bg-semaphore-orange/10 text-semaphore-orange"
      }`}
    >
      {estado}
    </span>
  );
}

// `columns` son las columnas informativas propias de cada servicio (Campaña,
// Anunciante, Motivo, Formato, Mes -- definidas en canalMetricas.js); Estado
// y Testigo se calculan siempre igual a partir de `link` y se agregan fijas
// al final.
export default function TestigoTable({ rows, columns }) {
  return (
    <Card hover={false} className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-brand-purple text-white text-left">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-semibold">
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Testigo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const estado = r.link ? "Verificado" : "Pendiente";
            return (
              <tr
                key={i}
                className={`transition-colors hover:bg-brand-purple/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-gray-800 whitespace-nowrap">
                    {r[col.key]}
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  <EstadoBadge estado={estado} />
                </td>
                <td className="px-4 py-2.5">
                  {r.link ? (
                    <a href={r.link} className="text-blue-600 hover:underline truncate block max-w-[220px]">
                      {r.link}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
