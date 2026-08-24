import { useMemo, useState } from "react";
import GradientHeader from "../components/common/GradientHeader";
import Tabs from "../components/common/Tabs";
import KPICard from "../components/common/KPICard";
import MetricsTable from "../components/common/MetricsTable";
import TestigoTable from "../components/common/TestigoTable";
import GeoMap from "../components/common/GeoMap";
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
  porcentaje: (v) => `${v}%`,
};

function calcularKpi(kpi, rows) {
  if (kpi.formula === "suma") {
    const total = rows.reduce((s, r) => s + (r[kpi.key] ?? 0), 0);
    return KPI_FORMATTERS[kpi.type] ? KPI_FORMATTERS[kpi.type](total) : total;
  }
  if (kpi.formula === "ratio") {
    const numerador = rows.reduce((s, r) => s + (r[kpi.numeradorKey] ?? 0), 0);
    const denominador = rows.reduce((s, r) => s + (r[kpi.denominadorKey] ?? 0), 0);
    return `${denominador > 0 ? Math.round((numerador / denominador) * 100) : 0}%`;
  }
  // "promedio": fallback para cuando el dataset no trae el numerador/denominador
  // crudo para calcular el ratio real (ver canalMetricas.js).
  const promedio = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r[kpi.key] ?? 0), 0) / rows.length) : 0;
  return `${promedio}%`;
}

// Presentacional y genérico: quién define qué pestañas hay, qué columnas trae
// cada una y qué KPIs mostrar es src/config/canalMetricas.js, no este
// componente -- así los 5 servicios comparten un solo componente aunque sus
// datos sean bien distintos entre sí.
export default function ChannelRendimientoGeneral({ data, uiTabs }) {
  const { clienteActivo } = useClienteActivo();
  const [tabKey, setTabKey] = useState(uiTabs[0].key);
  const [campana, setCampana] = useState(null);
  const [anunciante, setAnunciante] = useState(null);
  const [periodo, setPeriodo] = useState(null);

  const tab = uiTabs.find((t) => t.key === tabKey) ?? uiTabs[0];
  const datasetCrudo = data[tab.source] ?? SIN_FILAS;
  const tieneCampanaAnunciante = datasetCrudo.length === 0 || "campana" in datasetCrudo[0];

  const filas = useMemo(
    () =>
      datasetCrudo.filter(
        (r) =>
          (!clienteActivo || r.cliente === clienteActivo) &&
          (!campana || r.campana === campana) &&
          (!anunciante || r.anunciante === anunciante) &&
          dentroDelPeriodo(r.fecha, periodo)
      ),
    [datasetCrudo, clienteActivo, campana, anunciante, periodo]
  );

  const handleDownload = () => downloadCSV(tab.key, filas, tab.columns);

  const filters = tieneCampanaAnunciante
    ? [
        { label: "Anunciante", options: data.anunciantes, value: anunciante, onChange: setAnunciante },
        { label: "Campaña", options: data.campanas, value: campana, onChange: setCampana },
      ]
    : [];

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

        {tab.key === "testigo" ? (
          <TestigoTable rows={filas} columns={tab.columns.filter((c) => c.key !== "link")} />
        ) : (
          <MetricsTable rows={filas} columns={tab.columns} showTotals={!!tab.totales} />
        )}

        {tab.key === "geo" && <GeoMap rows={filas} columns={tab.columns} />}
      </div>
    </div>
  );
}
