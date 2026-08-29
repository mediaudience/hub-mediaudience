import { useMemo, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import useApiData from "../../hooks/useApiData";
import { formatNumber, progressTier, TIER_COLORS } from "../../utils/format";
import { downloadCSV } from "../../utils/csv";
import { estePeriodoISO } from "../../components/common/PeriodFilterPill";

function dentroDelPeriodo(fecha, periodo) {
  if (!periodo || !fecha) return true;
  if (periodo.inicio && fecha < periodo.inicio) return false;
  if (periodo.fin && fecha > periodo.fin) return false;
  return true;
}

// Solo para generar las etiquetas de "meses con data" que ofrece el filtro
// de periodo (PeriodFilterPill) -- el filtrado real usa fechas ISO, nunca
// texto, así que es inmune a cómo esté escrito el mes en cualquier Sheet
// (ver el bug real que encontramos en Facturación con "Ago" vs "Agosto").
function mesLabelDeFecha(fechaISO) {
  const [y, m] = fechaISO.split("-").map(Number);
  const nombre = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

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
  // Pedido por Jose 2026-08-29: arrancar (y "Borrar Filtros") en el mes en
  // curso -- a diferencia del filtro de mes por texto, esto no depende de
  // esperar a que carguen los datos, se calcula directo.
  const [periodo, setPeriodo] = useState(() => estePeriodoISO("Este mes"));

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
  // Meses concretos que ya tienen data, para el atajo "Meses con data" del
  // filtro de periodo -- orden cronológico real (por fecha, no alfabético).
  const mesesConData = useMemo(() => {
    const claves = [...new Set(filasDelPais.map((r) => r.fechaInicio?.slice(0, 7)).filter(Boolean))].sort();
    return claves.map((clave) => ({ clave, label: mesLabelDeFecha(`${clave}-01`) }));
  }, [filasDelPais]);

  const filtradas = useMemo(
    () =>
      filasDelPais.filter(
        (r) =>
          (!anunciante || r.anunciante === anunciante) &&
          (!formato || r.formato === formato) &&
          (!ejecutivo || r.ejecutivo === ejecutivo) &&
          dentroDelPeriodo(r.fechaInicio, periodo)
      ),
    [filasDelPais, anunciante, formato, ejecutivo, periodo]
  );

  const filters = [
    ...(paisesDisponibles.length > 1
      ? [{ label: "País", options: paisesDisponibles, value: pais, onChange: setPais }]
      : []),
    { label: "Anunciante", options: anunciantesDisponibles, value: anunciante, onChange: setAnunciante },
    { label: "Formato", options: formatosDisponibles, value: formato, onChange: setFormato },
    { label: "Ejecutivo", options: ejecutivosDisponibles, value: ejecutivo, onChange: setEjecutivo },
  ];

  return (
    <div>
      <GradientHeader
        title="Campañas Servidas"
        noWrap
        showPeriodPicker={false}
        filters={filters}
        periodFilter={{ label: "Mes", meses: mesesConData, onChange: setPeriodo }}
        onClearFilters={() => {
          setPais(null);
          setAnunciante(null);
          setFormato(null);
          setEjecutivo(null);
          setPeriodo(estePeriodoISO("Este mes"));
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
