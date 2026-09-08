import { useEffect, useMemo, useState } from "react";
import GradientHeader from "../components/common/GradientHeader";
import Tabs from "../components/common/Tabs";
import KPICard from "../components/common/KPICard";
import MetricsTable from "../components/common/MetricsTable";
import TestigoTable from "../components/common/TestigoTable";
import GeoMap from "../components/common/GeoMap";
import GeoResumen from "../components/common/GeoResumen";
import EvolucionDiariaChart from "../components/common/EvolucionDiariaChart";
import { formatNumber, formatCurrency } from "../utils/format";
import { downloadCSV } from "../utils/csv";
import { useClienteActivo } from "../context/ClienteActivoContext";

const SIN_FILAS = [];

// `fecha` ya viene normalizada a "YYYY-MM-DD" desde el sync (parseFechaEs en
// scripts/syncSheets.js), así que la comparación de string alcanza.
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

const KPI_FORMATTERS = {
  numero: formatNumber,
  moneda: formatCurrency,
  porcentaje: (v) => `${(v ?? 0).toFixed(2)}%`,
};

function calcularKpi(kpi, rows) {
  if (kpi.formula === "suma") {
    const total = rows.reduce((s, r) => s + (r[kpi.key] ?? 0), 0);
    return KPI_FORMATTERS[kpi.type] ? KPI_FORMATTERS[kpi.type](total) : total;
  }
  if (kpi.formula === "ratio") {
    const numerador = rows.reduce((s, r) => s + (r[kpi.numeradorKey] ?? 0), 0);
    const denominador = rows.reduce((s, r) => s + (r[kpi.denominadorKey] ?? 0), 0);
    return `${denominador > 0 ? ((numerador / denominador) * 100).toFixed(2) : "0.00"}%`;
  }
  // "promedio": fallback para cuando el dataset no trae el numerador/denominador
  // crudo para calcular el ratio real (ver canalMetricas.js).
  const promedio = rows.length > 0 ? (rows.reduce((s, r) => s + (r[kpi.key] ?? 0), 0) / rows.length).toFixed(2) : "0.00";
  return `${promedio}%`;
}

// Presentacional y genérico: quién define qué pestañas hay, qué columnas trae
// cada una y qué KPIs mostrar es src/config/canalMetricas.js, no este
// componente -- así los 5 servicios comparten un solo componente aunque sus
// datos sean bien distintos entre sí.
export default function ChannelRendimientoGeneral({ data, uiTabs }) {
  const { clientes, clienteActivo, setClienteActivo } = useClienteActivo();
  const [tabKey, setTabKey] = useState(uiTabs[0].key);
  const [campana, setCampana] = useState(null);
  const [anunciante, setAnunciante] = useState(null);
  const [periodo, setPeriodo] = useState(null);

  const tab = uiTabs.find((t) => t.key === tabKey) ?? uiTabs[0];
  const datasetCrudo = data[tab.source] ?? SIN_FILAS;
  const tieneCampanaAnunciante = datasetCrudo.length === 0 || "campana" in datasetCrudo[0];

  // Un anunciante/campaña elegido puede dejar de existir para el cliente
  // activo si se cambia de cliente arriba -- se limpia para no dejar un
  // filtro "fantasma" que deja la tabla en 0 filas sin ninguna pista de por
  // qué (ver más abajo, mismo problema que motivó este fix).
  useEffect(() => {
    setAnunciante(null);
    setCampana(null);
  }, [clienteActivo]);

  // Solo el cliente activo, SIN los demás filtros -- son las opciones que
  // debe ofrecer el desplegable de Anunciante/Campaña. Antes esos
  // desplegables se armaban con `data.anunciantes`/`data.campanas` (el
  // agregado completo del canal, de TODOS los clientes) sin importar cuál
  // cliente estaba elegido arriba -- afectaba a Admin/Super Admin y a
  // usuario_interno con más de un cliente visible.
  const filasDelClienteActivo = useMemo(
    () => datasetCrudo.filter((r) => !clienteActivo || r.cliente === clienteActivo),
    [datasetCrudo, clienteActivo]
  );
  const anunciantesDisponibles = useMemo(
    () => [...new Set(filasDelClienteActivo.map((r) => r.anunciante).filter(Boolean))].sort(),
    [filasDelClienteActivo]
  );
  const campanasDisponibles = useMemo(
    () => [...new Set(filasDelClienteActivo.map((r) => r.campana).filter(Boolean))].sort(),
    [filasDelClienteActivo]
  );

  const filas = useMemo(
    () =>
      filasDelClienteActivo.filter(
        (r) =>
          (!campana || r.campana === campana) &&
          (!anunciante || r.anunciante === anunciante) &&
          dentroDelPeriodo(r.fecha, periodo)
      ),
    [filasDelClienteActivo, campana, anunciante, periodo]
  );

  const handleDownload = () => downloadCSV(tab.key, filas, tab.columns);

  // "Cliente" acá pega directo sobre el mismo estado global de "Cliente
  // activo" (Navbar) -- no es un filtro local aparte -- para que elegirlo
  // desde la barra de filtros o desde el menú de la cuenta sea intercambiable
  // y nunca queden desincronizados. Se oculta si el usuario solo tiene un
  // cliente visible, igual que en el Navbar (ver [[project_mediaudience_cliente_activo]]).
  const filters = [
    ...(clientes.length > 1
      ? [{ label: "Cliente", options: clientes.map((c) => c.nombre), value: clienteActivo, onChange: setClienteActivo }]
      : []),
    ...(tieneCampanaAnunciante
      ? [
          { label: "Anunciante", options: anunciantesDisponibles, value: anunciante, onChange: setAnunciante },
          { label: "Campaña", options: campanasDisponibles, value: campana, onChange: setCampana },
        ]
      : []),
  ];

  return (
    <div>
      <GradientHeader
        title="Rendimiento General"
        filters={filters}
        onApplyPeriod={({ startDay, endDay }) =>
          setPeriodo(startDay && endDay ? { inicio: diaISO(startDay), fin: diaISO(endDay) } : null)
        }
        onClearFilters={() => {
          setCampana(null);
          setAnunciante(null);
          setPeriodo(null);
        }}
        onDownload={filas.length > 0 ? handleDownload : undefined}
      />

      <Tabs tabs={uiTabs.map((t) => ({ key: t.key, label: t.label }))} active={tabKey} onChange={setTabKey} />

      <div className="pt-4">
        {tab.kpis.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-6">
            {tab.kpis.map((kpi) => (
              <KPICard key={kpi.label} label={kpi.label} value={calcularKpi(kpi, filas)} />
            ))}
          </div>
        )}

        {tab.key === "detalle-diario" && <EvolucionDiariaChart rows={filas} columns={tab.columns} />}

        {tab.key === "testigo" ? (
          <TestigoTable rows={filas} columns={tab.columns.filter((c) => c.key !== "link")} />
        ) : (
          <MetricsTable rows={filas} columns={tab.columns} showTotals={!!tab.totales} />
        )}

        {tab.key === "geo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mt-6">
            <GeoResumen rows={filas} columns={tab.columns} />
            <GeoMap rows={filas} columns={tab.columns} />
          </div>
        )}
      </div>
    </div>
  );
}
