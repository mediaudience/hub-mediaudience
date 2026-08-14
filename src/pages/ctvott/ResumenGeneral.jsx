import GradientHeader from "../../components/common/GradientHeader";
import KPICard from "../../components/common/KPICard";
import ComboBarChart from "../../components/common/ComboBarChart";
import DonutWithTable from "../../components/common/DonutWithTable";
import Card from "../../components/common/Card";
import { formatNumber, formatPercent } from "../../utils/format";
import resumen from "../../data/ctvOtt/resumen.json";
import ciudades from "../../data/ctvOtt/ciudades.json";
import dispositivos from "../../data/ctvOtt/dispositivos.json";
import campanas from "../../data/campanasServidas.json";

const CTV_CAMPAIGNS = campanas.filter((c) => c.formato === "CTV").map((c) => c.campana);
const ANUNCIANTES = [...new Set(campanas.map((c) => c.anunciante))];

export default function CtvOttResumenGeneral() {
  return (
    <div>
      <GradientHeader
        title="Resumen General"
        filters={[
          { label: "Anunciante", options: ANUNCIANTES },
          { label: "Campañas", options: CTV_CAMPAIGNS },
        ]}
      />

      <div className="flex flex-wrap gap-4 mb-6">
        <KPICard label="Impresiones Totales" value={formatNumber(resumen.kpis.impresionesTotales)} />
        <KPICard label="Visualizaciones" value={formatNumber(resumen.kpis.visualizaciones)} />
        <KPICard label="VTR" value={formatPercent(resumen.kpis.vtr)} />
      </div>

      <Card className="p-5 mb-6">
        <ComboBarChart
          data={resumen.mensual}
          xKey="mes"
          series={[
            { key: "impresionesTotales", label: "Impresiones Totales", color: "#C4216F", type: "bar", yAxisId: "left" },
            { key: "visualizaciones", label: "Visualizaciones", color: "#57007E", type: "line", yAxisId: "right" },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutWithTable
          title="Consumo por Ciudades"
          data={ciudades.map((c) => ({ label: c.ubicacion, value: c.impresionesTotales }))}
          labelHeader="Ubicación"
        />
        <DonutWithTable
          title="Consumo por Dispositivos"
          data={dispositivos.map((d) => ({ label: d.dispositivo, value: d.impresionesTotales }))}
          labelHeader="Dispositivos"
        />
      </div>
    </div>
  );
}
