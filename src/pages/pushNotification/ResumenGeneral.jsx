import ChannelResumenGeneral from "../ChannelResumenGeneral";
import resumen from "../../data/pushNotification/resumen.json";
import ciudades from "../../data/pushNotification/ciudades.json";
import dispositivos from "../../data/pushNotification/dispositivos.json";

export default function PushNotificationResumenGeneral() {
  return (
    <ChannelResumenGeneral
      filters={[{ label: "Campañas", options: ["Fybeca Salud Familiar", "TÍA Vuelta a Clases", "De Prati Rebajas de Julio"] }]}
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
