import { useMemo, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import KPICard from "../../components/common/KPICard";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import useApiData from "../../hooks/useApiData";
import { formatCurrency } from "../../utils/format";
import { downloadCSV } from "../../utils/csv";

const COLUMNS = [
  { key: "mes", label: "Mes" },
  { key: "agencia", label: "Agencia" },
  { key: "cliente", label: "Cliente" },
  { key: "producto", label: "Producto" },
  { key: "estadoFactura", label: "Estado Factura" },
  { key: "ordenAgencia", label: "Orden Agencia" },
  { key: "consumoNeto", label: "Consumo Neto", align: "right" },
];

// Data administrativa por país (Admin/Super Admin únicamente), sin relación
// a clientes/anunciantes -- ver [[project_mediaudience_gestion_sheets]].
export default function Facturacion() {
  const { data, loading, error } = useApiData("/api/gestion/facturacion");
  const [pais, setPais] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [agencia, setAgencia] = useState(null);
  const [producto, setProducto] = useState(null);
  const [estadoFactura, setEstadoFactura] = useState(null);
  const [mes, setMes] = useState(null);

  const filas = data?.filas ?? [];

  const paisesDisponibles = useMemo(() => [...new Set(filas.map((r) => r.pais).filter(Boolean))].sort(), [filas]);
  const filasDelPais = useMemo(() => filas.filter((r) => !pais || r.pais === pais), [filas, pais]);
  const clientesDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.cliente).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const agenciasDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.agencia).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const productosDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.producto).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const estadosDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.estadoFactura).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const mesesDisponibles = useMemo(() => [...new Set(filasDelPais.map((r) => r.mes).filter(Boolean))], [filasDelPais]);

  const filtradas = useMemo(
    () =>
      filasDelPais.filter(
        (r) =>
          (!cliente || r.cliente === cliente) &&
          (!agencia || r.agencia === agencia) &&
          (!producto || r.producto === producto) &&
          (!estadoFactura || r.estadoFactura === estadoFactura) &&
          (!mes || r.mes === mes)
      ),
    [filasDelPais, cliente, agencia, producto, estadoFactura, mes]
  );

  const totalConsumoNeto = filtradas.reduce((s, r) => s + (r.consumoNeto ?? 0), 0);
  const totalFacturado = filtradas.reduce((s, r) => s + (r.montoFacturado ?? 0), 0);
  const totalPendiente = filtradas.reduce((s, r) => s + (r.montoPendiente ?? 0), 0);

  const filters = [
    ...(paisesDisponibles.length > 1
      ? [{ label: "País", options: paisesDisponibles, value: pais, onChange: setPais }]
      : []),
    { label: "Cliente", options: clientesDisponibles, value: cliente, onChange: setCliente },
    { label: "Agencia", options: agenciasDisponibles, value: agencia, onChange: setAgencia },
    { label: "Producto", options: productosDisponibles, value: producto, onChange: setProducto },
    { label: "Estado Factura", options: estadosDisponibles, value: estadoFactura, onChange: setEstadoFactura },
    { label: "Mes", options: mesesDisponibles, value: mes, onChange: setMes },
  ];

  return (
    <div>
      <GradientHeader
        title="Facturación"
        noWrap
        filters={filters}
        onClearFilters={() => {
          setPais(null);
          setCliente(null);
          setAgencia(null);
          setProducto(null);
          setEstadoFactura(null);
          setMes(null);
        }}
        onDownload={filtradas.length > 0 ? () => downloadCSV("facturacion", filtradas, COLUMNS) : undefined}
      />

      {loading ? (
        <Spinner label="Cargando facturación..." />
      ) : error ? (
        <EmptyState message="No se pudo cargar la información." />
      ) : filas.length === 0 ? (
        <EmptyState message="Todavía no hay ningún país con Sheet ID sincronizado. Cargalo desde Admin > Sheets de Gestión." />
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-6">
            <KPICard label="Consumo Neto" value={formatCurrency(totalConsumoNeto)} />
            <KPICard label="Monto Facturado" value={formatCurrency(totalFacturado)} />
            <KPICard label="Monto Pendiente" value={formatCurrency(totalPendiente)} />
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-brand-purple text-white text-left">
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">PDF Orden</th>
                  <th className="px-4 py-3 font-semibold">PDF Factura</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 text-gray-800 whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {c.key === "consumoNeto" ? formatCurrency(r[c.key]) : r[c.key] ?? ""}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      {r.pdfOrden ? (
                        <a href={r.pdfOrden} target="_blank" rel="noreferrer" className="text-brand-purple hover:underline">
                          Ver
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.pdfFactura ? (
                        <a href={r.pdfFactura} target="_blank" rel="noreferrer" className="text-brand-purple hover:underline">
                          Ver
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
