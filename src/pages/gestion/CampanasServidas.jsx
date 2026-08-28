import { useMemo, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import useApiData from "../../hooks/useApiData";
import { formatNumber, progressTier, TIER_COLORS } from "../../utils/format";
import { downloadCSV } from "../../utils/csv";

function diaISO(day) {
  if (!day) return null;
  return `${day.year}-${String(day.month + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function dentroDelPeriodo(fecha, periodo) {
  if (!periodo || !fecha) return true;
  if (periodo.inicio && fecha < periodo.inicio) return false;
  if (periodo.fin && fecha > periodo.fin) return false;
  return true;
}

const COLUMNS = [
  { key: "anunciante", label: "Anunciante" },
  { key: "campana", label: "Campaña" },
  { key: "reporte", label: "Reporte" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "formato", label: "Formato" },
  { key: "tipoVenta", label: "Tipo de Venta" },
  { key: "fechaInicio", label: "Fecha Inicio" },
  { key: "fechaFin", label: "Fecha Fin" },
  { key: "objetivo", label: "Objetivo", align: "right" },
  { key: "consumo", label: "Consumo", align: "right" },
  { key: "porcentajeConsumo", label: "% Consumo", align: "right" },
];

// Data administrativa por país (Admin/Super Admin únicamente), sin relación
// a clientes/anunciantes -- ver [[project_mediaudience_gestion_sheets]].
export default function CampanasServidas() {
  const { data, loading, error } = useApiData("/api/gestion/campanas-servidas");
  const [pais, setPais] = useState(null);
  const [anunciante, setAnunciante] = useState(null);
  const [formato, setFormato] = useState(null);
  const [ejecutivo, setEjecutivo] = useState(null);
  const [periodo, setPeriodo] = useState(null);

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
        title="Gestión: Campañas Servidas"
        filters={filters}
        onApplyPeriod={({ startDay, endDay }) =>
          setPeriodo(startDay && endDay ? { inicio: diaISO(startDay), fin: diaISO(endDay) } : null)
        }
        onClearFilters={() => {
          setPais(null);
          setAnunciante(null);
          setFormato(null);
          setEjecutivo(null);
          setPeriodo(null);
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
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="bg-brand-purple text-white text-left">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
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
                        <td key={c.key} className="px-4 py-2.5 text-right">
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: TIER_COLORS[progressTier(r.porcentajeConsumo)] }}
                          >
                            {(r.porcentajeConsumo ?? 0).toFixed(2)}%
                          </span>
                        </td>
                      );
                    }
                    const esNumerico = c.key === "objetivo" || c.key === "consumo";
                    return (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 text-gray-800 whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {esNumerico ? formatNumber(r[c.key]) : r[c.key] ?? ""}
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
