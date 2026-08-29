import { useEffect, useMemo, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import useApiData from "../../hooks/useApiData";
import { formatNumber, progressTier, TIER_COLORS } from "../../utils/format";
import { downloadCSV } from "../../utils/csv";

// Se deriva de `fechaInicio` (ISO, ya parseada por el sync) en vez de leer
// una columna "Mes" del Sheet -- evita el problema real que encontramos en
// Facturación, donde el Sheet escribe el mes en curso abreviado ("Ago") y
// no matchea contra el nombre completo que calcula el navegador. Acá el mes
// se calcula siempre a partir de una fecha real, nunca de texto libre del
// Sheet, así que es inmune a cómo esté escrito ahí.
function mesLabelDeFecha(fechaISO) {
  if (!fechaISO) return null;
  const [y, m] = fechaISO.split("-").map(Number);
  const nombre = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

// Pedido por Jose 2026-08-29: al entrar (y al "Borrar Filtros") arrancar en
// el mes en curso -- se recalcula en cada carga de la página (no hace falta
// que reaccione a que pase la medianoche con el panel abierto). El pill
// nunca muestra este valor (ver `hideValueInLabel` en el filtro "Mes" más
// abajo), así que preseleccionar no alarga el botón ni descuadra los
// filtros a 2 filas.
function mesActualLabel() {
  const hoy = new Date();
  return mesLabelDeFecha(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`);
}
const MES_ACTUAL_LABEL = mesActualLabel();

// `width` en %, suma 100 -- table-layout: fixed para que la tabla entre en el
// ancho de la página sin scroll horizontal, en vez de min-width + scroll
// (mismo problema que ya se resolvió en MetricsTable.jsx para otras
// pestañas con texto largo, ver ese componente).
const COLUMNS = [
  { key: "anunciante", label: "Anunciante", width: 11 },
  { key: "campana", label: "Campaña", width: 16 },
  { key: "reporte", label: "Reporte", width: 7 },
  { key: "ejecutivo", label: "Ejecutivo", width: 11 },
  { key: "formato", label: "Formato", width: 9 },
  { key: "tipoVenta", label: "Tipo de Venta", width: 7 },
  { key: "fechaInicio", label: "Fecha Inicio", width: 8 },
  { key: "fechaFin", label: "Fecha Fin", width: 8 },
  { key: "objetivo", label: "Objetivo", align: "right", width: 8 },
  { key: "consumo", label: "Consumo", align: "right", width: 8 },
  { key: "porcentajeConsumo", label: "% Consumo", align: "right", width: 7 },
];

// Data administrativa por país (Admin/Super Admin únicamente), sin relación
// a clientes/anunciantes -- ver [[project_mediaudience_gestion_sheets]].
export default function CampanasServidas() {
  const { data, loading, error } = useApiData("/api/gestion/campanas-servidas");
  const [pais, setPais] = useState(null);
  const [anunciante, setAnunciante] = useState(null);
  const [formato, setFormato] = useState(null);
  const [ejecutivo, setEjecutivo] = useState(null);
  // `undefined` = todavía sin decidir (esperando la primera carga de datos
  // para saber si el mes actual tiene filas); `null` = "Todos" elegido a
  // propósito -- mismo patrón que Facturacion.jsx.
  const [mes, setMes] = useState(undefined);

  const filas = data?.filas ?? [];

  const paisesDisponibles = useMemo(() => [...new Set(filas.map((r) => r.pais).filter(Boolean))].sort(), [filas]);
  const filasDelPais = useMemo(() => filas.filter((r) => !pais || r.pais === pais), [filas, pais]);
  const anunciantesDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.anunciante).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const formatosDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.formato).filter(Boolean))].sort(),
    [filasDelPais]
  );
  const ejecutivosDisponibles = useMemo(
    () => [...new Set(filasDelPais.map((r) => r.ejecutivo).filter(Boolean))].sort(),
    [filasDelPais]
  );
  // Orden cronológico real (por fecha, no alfabético) -- evita que "Agosto"
  // quede antes que "Julio" en el desplegable.
  const mesesDisponibles = useMemo(() => {
    const claves = [...new Set(filasDelPais.map((r) => r.fechaInicio?.slice(0, 7)).filter(Boolean))].sort();
    return claves.map((clave) => mesLabelDeFecha(`${clave}-01`));
  }, [filasDelPais]);

  useEffect(() => {
    if (mes === undefined && mesesDisponibles.length > 0) {
      setMes(mesesDisponibles.includes(MES_ACTUAL_LABEL) ? MES_ACTUAL_LABEL : null);
    }
  }, [mes, mesesDisponibles]);

  const filtradas = useMemo(
    () =>
      filasDelPais.filter(
        (r) =>
          (!anunciante || r.anunciante === anunciante) &&
          (!formato || r.formato === formato) &&
          (!ejecutivo || r.ejecutivo === ejecutivo) &&
          (!mes || mesLabelDeFecha(r.fechaInicio) === mes)
      ),
    [filasDelPais, anunciante, formato, ejecutivo, mes]
  );

  const filters = [
    ...(paisesDisponibles.length > 1
      ? [{ label: "País", options: paisesDisponibles, value: pais, onChange: setPais }]
      : []),
    { label: "Anunciante", options: anunciantesDisponibles, value: anunciante, onChange: setAnunciante },
    { label: "Formato", options: formatosDisponibles, value: formato, onChange: setFormato },
    { label: "Ejecutivo", options: ejecutivosDisponibles, value: ejecutivo, onChange: setEjecutivo },
    { label: "Mes", options: mesesDisponibles, value: mes, onChange: setMes, hideValueInLabel: true },
  ];

  return (
    <div>
      <GradientHeader
        title="Campañas Servidas"
        noWrap
        showPeriodPicker={false}
        filters={filters}
        onClearFilters={() => {
          setPais(null);
          setAnunciante(null);
          setFormato(null);
          setEjecutivo(null);
          setMes(undefined);
        }}
        onDownload={filtradas.length > 0 ? () => downloadCSV("campanas-servidas", filtradas, COLUMNS) : undefined}
      />

      {loading ? (
        <Spinner label="Cargando campañas servidas..." />
      ) : error ? (
        <EmptyState message="No se pudo cargar la información." />
      ) : filas.length === 0 ? (
        <EmptyState message="Todavía no hay ningún país con Sheet ID sincronizado. Cargalo desde Admin > Sheets de Gestión." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="text-xs" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.key} style={{ width: `${c.width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-brand-purple text-white text-left">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-2.5 py-2.5 font-semibold truncate ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  {COLUMNS.map((c) => {
                    if (c.key === "porcentajeConsumo") {
                      return (
                        <td key={c.key} className="px-2.5 py-2 text-right">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                            style={{ backgroundColor: TIER_COLORS[progressTier(r.porcentajeConsumo)] }}
                          >
                            {(r.porcentajeConsumo ?? 0).toFixed(2)}%
                          </span>
                        </td>
                      );
                    }
                    const esNumerico = c.key === "objetivo" || c.key === "consumo";
                    const valor = esNumerico ? formatNumber(r[c.key]) : r[c.key] ?? "";
                    return (
                      <td
                        key={c.key}
                        title={!esNumerico ? String(valor) : undefined}
                        className={`px-2.5 py-2 text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis ${
                          c.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {valor}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
