import GradientHeader from "../components/common/GradientHeader";
import KPICard from "../components/common/KPICard";
import ComboBarChart from "../components/common/ComboBarChart";
import DonutWithTable from "../components/common/DonutWithTable";
import Card from "../components/common/Card";
import { formatNumber, formatPercent } from "../utils/format";

export default function ChannelResumenGeneral({ kpis, chartData, chartXKey = "mes", chartSeries, donuts, filters = [] }) {
  return (
    <div>
      <GradientHeader title="Resumen General" filters={filters} />

      <div className="flex flex-wrap gap-4 mb-6">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.percent ? formatPercent(k.value) : formatNumber(k.value)} />
        ))}
      </div>

      <Card className="p-5 mb-6">
        <ComboBarChart data={chartData} xKey={chartXKey} series={chartSeries} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {donuts.map((d) => (
          <DonutWithTable key={d.title} title={d.title} data={d.data} labelHeader={d.labelHeader} />
        ))}
      </div>
    </div>
  );
}
