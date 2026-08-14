import { useState } from "react";
import GradientHeader from "../components/common/GradientHeader";
import Tabs from "../components/common/Tabs";
import DailyPerformanceTable from "../components/common/DailyPerformanceTable";
import TestigoTable from "../components/common/TestigoTable";

const TABS = [
  { key: "campana", label: "Rendimiento por Campañas", icon: "megaphone" },
  { key: "publisher", label: "Rendimiento por Publisher", icon: "megaphone" },
  { key: "testigo", label: "Testigo", icon: "clip" },
];

export default function ChannelRendimientoDiario({ data, filters = [{ label: "Campaña", options: [] }] }) {
  const [tab, setTab] = useState("campana");

  return (
    <div>
      <GradientHeader title="Rendimiento Diario" filters={filters} />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="pt-4">
        {tab === "campana" && (
          <DailyPerformanceTable rows={data.porCampana} entityKey="campana" entityLabel="Campaña" />
        )}
        {tab === "publisher" && (
          <DailyPerformanceTable rows={data.porPublisher} entityKey="publisher" entityLabel="Publisher" />
        )}
        {tab === "testigo" && <TestigoTable rows={data.testigo} />}
      </div>
    </div>
  );
}
