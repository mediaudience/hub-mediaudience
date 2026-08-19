import { useState } from "react";
import GradientHeader from "../components/common/GradientHeader";
import Tabs from "../components/common/Tabs";
import DailyPerformanceTable from "../components/common/DailyPerformanceTable";
import PublisherPerformanceTable from "../components/common/PublisherPerformanceTable";
import TestigoTable from "../components/common/TestigoTable";
import { downloadCSV } from "../utils/csv";

const TABS = [
  { key: "campana", label: "Rendimiento por Campañas", icon: "megaphone" },
  { key: "publisher", label: "Rendimiento por Publisher", icon: "megaphone" },
  { key: "testigo", label: "Testigo", icon: "clip" },
];

const CAMPANA_COLUMNS = [
  { key: "fecha", label: "Fecha" },
  { key: "campana", label: "Campaña" },
  { key: "motivo", label: "Motivo" },
  { key: "impresionesTotales", label: "Impresiones Totales" },
  { key: "visualizaciones", label: "Visualizaciones" },
  { key: "quartil25", label: "Quartil 25%" },
  { key: "quartil50", label: "Quartil 50%" },
  { key: "quartil75", label: "Quartil 75%" },
  { key: "quartil100", label: "Quartil 100%" },
  { key: "vtr", label: "VTR" },
];

const PUBLISHER_COLUMNS = [
  { key: "mes", label: "Mes" },
  { key: "publisher", label: "Publisher" },
  { key: "motivo", label: "Motivo" },
  { key: "impresionesTotales", label: "Impresiones Totales" },
  { key: "visualizaciones", label: "Visualizaciones" },
];

const TESTIGO_COLUMNS = [
  { key: "mes", label: "Mes" },
  { key: "campana", label: "Campaña" },
  { key: "motivo", label: "Motivo" },
  { key: "formato", label: "Formato" },
  { key: "estado", label: "Estado" },
  { key: "testigoUrl", label: "Testigo" },
];

export default function ChannelRendimientoDiario({ data, filters = [{ label: "Campaña", options: [] }] }) {
  const [tab, setTab] = useState("campana");

  const exportConfig = {
    campana: { rows: data.porCampana, columns: CAMPANA_COLUMNS, filename: "rendimiento-por-campana" },
    publisher: { rows: data.porPublisher, columns: PUBLISHER_COLUMNS, filename: "rendimiento-por-publisher" },
    testigo: { rows: data.testigo, columns: TESTIGO_COLUMNS, filename: "testigo" },
  }[tab];

  const handleDownload = () => downloadCSV(exportConfig.filename, exportConfig.rows, exportConfig.columns);

  return (
    <div>
      <GradientHeader
        title="Rendimiento Diario"
        filters={filters}
        onDownload={exportConfig.rows.length > 0 ? handleDownload : undefined}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="pt-4">
        {tab === "campana" && (
          <DailyPerformanceTable rows={data.porCampana} entityKey="campana" entityLabel="Campaña" />
        )}
        {tab === "publisher" && <PublisherPerformanceTable rows={data.porPublisher} />}
        {tab === "testigo" && <TestigoTable rows={data.testigo} />}
      </div>
    </div>
  );
}
