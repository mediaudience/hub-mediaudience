import ChannelResumenGeneral from "../ChannelResumenGeneral";
import resumen from "../../data/programatico/resumen.json";
import ciudades from "../../data/programatico/ciudades.json";
import dispositivos from "../../data/programatico/dispositivos.json";
import campanas from "../../data/campanasServidas.json";

const CAMPAIGNS = campanas.filter((c) => c.formato === "Display Programático").map((c) => c.campana);
const ANUNCIANTES = [...new Set(campanas.filter((c) => c.formato === "Display Programático").map((c) => c.anunciante))];

export default function ProgramaticoResumenGeneral() {
  return (
    <ChannelResumenGeneral
      filters={[
        { label: "Anunciante", options: ANUNCIANTES },
        { label: "Campañas", options: CAMPAIGNS },
      ]}
      kpis={[
        { label: "Impresiones Totales", value: resumen.kpis.impresionesTotales },
        { label: "Visualizaciones", value: resumen.kpis.visualizaciones },
        { label: "VTR", value: resumen.kpis.vtr, percent: true },
      ]}
      chartData={resumen.mensual}
      chartSeries={[
        { key: "impresionesTotales", label: "Impresiones Totales", color: "#C4216F", type: "bar", yAxisId: "left" },
        { key: "visualizaciones", label: "Visualizaciones", color: "#57007E", type: "line", yAxisId: "right" },
      ]}
      donuts={[
        {
          title: "Consumo por Ciudades",
          labelHeader: "Ubicación",
          data: ciudades.map((c) => ({ label: c.ubicacion, value: c.impresionesTotales })),
        },
        {
          title: "Consumo por Dispositivos",
          labelHeader: "Dispositivos",
          data: dispositivos.map((d) => ({ label: d.dispositivo, value: d.impresionesTotales })),
        },
      ]}
    />
  );
}
