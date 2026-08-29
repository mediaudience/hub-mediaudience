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

// Se filtra/ordena contra el ISO completo (arriba); esto es solo para no
// mostrar el año en la tabla -- Jose pidió simplificar Fecha Inicio/Fecha
// Fin a día/mes para efectos visuales, sin tocar el dato real.
function formatFechaCorta(fechaISO) {
  const partes = String(fechaISO ?? "").split("-");
  if (partes.length !== 3) return fechaISO ?? "";
  const [, mes, dia] = partes;
  return `${dia}/${mes}`;
}

// Semáforo del Avance -- mismos colores/umbrales que ya usa la columna
// "Avance" más abajo (progressTier/TIER_COLORS de utils/format), para que
// el legend tenga identidad con lo que ya se ve en esta misma tabla, y no
// una paleta distinta copiada de otro panel.
function AvanceLegend() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-5 text-sm font-semibold text-slate-label px-1 py-4">
      <span className="uppercase tracking-wide text-brand-purple">Avance</span>
      <span className="flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: TIER_COLORS.red }} />
        0% – 50%
      </span>
      <span className="flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: TIER_COLORS.orange }} />
        51% – 89%
      </span>
      <span className="flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: TIER_COLORS.green }} />
        90% – 100%
      </span>
    </div>
  );
}

// `width` en %, suma 100 -- table-layout: fixed para que la tabla entre en el
// ancho de la página sin scroll horizontal, en vez de min-width + scroll
// (mismo problema que ya se resolvió en MetricsTable.jsx para otras
// pestañas con texto largo, ver ese componente).
const COLUMNS = [
  { key: "anunciante", label: "Anunciante", width: 10 },
  { key: "campana", label: "Campaña", width: 16 },
  { key: "reporte", label: "Reporte", width: 12 },
  { key: "ejecutivo", label: "Ejecutivo", width: 10 },
  { key: "formato", label: "Formato", width: 9 },
  { key: "tipoVenta", label: "Tipo", width: 6 },
  { key: "fechaInicio", label: "Fecha Inicio", align: "center", width: 8 },
  { key: "fechaFin", label: "Fecha Fin", align: "center", width: 7 },
  { key: "objetivo", label: "Objetivo", align: "right", width: 8 },
  { key: "consumo", label: "Consumo", align: "right", width: 7 },
  { key: "porcentajeConsumo", label: "Avance", align: "center", width: 7 },
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
  const filtradas = useMemo(
    () =>
      filasDelPais
        .filter(
          (r) =>
            (!anunciante || r.anunciante === anunciante) &&
            (!formato || r.formato === formato) &&
            (!ejecutivo || r.ejecutivo === ejecutivo) &&
            dentroDelPeriodo(r.fechaInicio, periodo)
        )
        // Fecha Inicio descendente (más reciente primero) -- mismo criterio
        // por defecto que MetricsTable.jsx usa en los 5 canales de campaña.
        .sort((a, b) => String(b.fechaInicio ?? "").localeCompare(String(a.fechaInicio ?? ""))),
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
        periodFilter={{ label: "Mes", onChange: setPeriodo }}
        onClearFilters={() => {
          setPais(null);
          setAnunciante(null);
          setFormato(null);
          setEjecutivo(null);
          setPeriodo(estePeriodoISO("Este mes"));
        }}
        onDownload={filtradas.length > 0 ? () => downloadCSV("campanas-servidas", filtradas, COLUMNS) : undefined}
      />

      <AvanceLegend />

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
                    className={`px-2.5 py-2.5 font-semibold truncate ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
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
                        <td key={c.key} className="px-2.5 py-2 text-center">
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
                    const esFecha = c.key === "fechaInicio" || c.key === "fechaFin";
                    // Anunciante nunca se corta -- es el nombre del cliente, y Jose
                    // pidió mostrarlo completo por respeto a ellos, aunque la fila
                    // crezca en alto. Reporte ("Enviado"/"No enviado") tampoco se
                    // corta -- Jose pidió que ese estado se vea completo siempre,
                    // sin depender del ancho. El resto de columnas sigue truncando
                    // con "..." (Campaña incluida, a propósito).
                    const noTruncar = c.key === "anunciante" || c.key === "reporte";
                    const valor = esNumerico
                      ? formatNumber(r[c.key])
                      : esFecha
                      ? formatFechaCorta(r[c.key])
                      : r[c.key] ?? "";
                    return (
                      <td
                        key={c.key}
                        title={!esNumerico && !noTruncar ? String(esFecha ? r[c.key] ?? "" : valor) : undefined}
                        className={`px-2.5 py-2 text-gray-800 ${
                          noTruncar ? "whitespace-normal break-words" : "whitespace-nowrap overflow-hidden text-ellipsis"
                        } ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
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
