import Card from "./Card";

// El Sheet a veces trae en la columna Testigo solo un nombre de archivo
// (ej. "Testigo Cyber WOW Abril") en vez de un link real de Drive -- eso
// no debe renderizarse como <a href>, porque el navegador lo interpreta
// como ruta relativa y termina navegando dentro del propio hub.
function esLinkValido(link) {
  return typeof link === "string" && /^https?:\/\//i.test(link.trim());
}

function EstadoBadge({ estado }) {
  const esVerificado = estado === "Verificado";
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-xs font-medium ${
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
          <tr className="bg-surface-2 text-gray-500 text-left label-mono">
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
                    esLinkValido(r.link) ? (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-[220px]"
                      >
                        {r.link}
                      </a>
                    ) : (
                      <span
                        className="text-gray-500 italic truncate block max-w-[220px]"
                        title={`"${r.link}" no es un link de Drive válido`}
                      >
                        {r.link}
                      </span>
                    )
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
