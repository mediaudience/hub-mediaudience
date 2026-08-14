import ChannelResumenGeneral from "../ChannelResumenGeneral";
import resumen from "../../data/tiktok/resumen.json";
import ciudades from "../../data/tiktok/ciudades.json";
import dispositivos from "../../data/tiktok/dispositivos.json";

export default function TiktokResumenGeneral() {
  return (
    <ChannelResumenGeneral
      filters={[{ label: "Campañas", options: ["Yanbal Nueva Colección", "Coca-Cola Verano sin Fin", "Kia Sportage 2026"] }]}
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
