import { useEffect, useMemo, useState } from "react";
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

// Sheet no trae fecha exacta, solo el nombre del mes (ver
// scripts/syncGestionSheets.js) -- el filtro por defecto pedido por Jose
// 2026-08-29 (mostrar solo el mes en curso) se resuelve comparando contra
// este nombre, capitalizado igual que en el Sheet ("Agosto", no "agosto").
function mesActualNombre() {
  const nombre = new Date().toLocaleDateString("es-ES", { month: "long" });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
const MES_ACTUAL_NOMBRE = mesActualNombre();

// Data administrativa por país, sin relación a clientes/anunciantes -- ver
// [[project_mediaudience_gestion_sheets]]. Visible para Admin/Super Admin
// (todos los países) y usuario_interno (solo el suyo, filtrado en el
// backend -- ver server/gestionRoutes.js).
export default function Facturacion() {
  const { data, loading, error } = useApiData("/api/gestion/facturacion");
  const [pais, setPais] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [agencia, setAgencia] = useState(null);
  const [producto, setProducto] = useState(null);
  const [estadoFactura, setEstadoFactura] = useState(null);
  // `undefined` = todavía sin decidir (esperando la primera carga de datos
  // para saber si el mes actual existe en el Sheet); `null` = "Todos"
  // elegido a propósito por el usuario -- distinguir los dos es lo que evita
  // que el efecto de abajo pise una elección explícita.
  const [mes, setMes] = useState(undefined);

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

  useEffect(() => {
    if (mes === undefined && mesesDisponibles.length > 0) {
      setMes(mesesDisponibles.includes(MES_ACTUAL_NOMBRE) ? MES_ACTUAL_NOMBRE : null);
    }
  }, [mes, mesesDisponibles]);

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
    { label: "Mes", options: mesesDisponibles, value: mes, onChange: setMes, hideValueInLabel: true },
  ];

  return (
    <div>
      <GradientHeader
        title="Facturación"
        noWrap
        showPeriodPicker={false}
        filters={filters}
        onClearFilters={() => {
          setPais(null);
          setCliente(null);
          setAgencia(null);
          setProducto(null);
          setEstadoFactura(null);
          setMes(undefined);
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
