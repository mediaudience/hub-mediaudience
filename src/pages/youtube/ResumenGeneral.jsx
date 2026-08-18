import ChannelResumenGeneral from "../ChannelResumenGeneral";
import useApiData from "../../hooks/useApiData";
import PageSkeleton from "../../components/common/PageSkeleton";
import useDelayedLoading from "../../hooks/useDelayedLoading";
import EmptyState from "../../components/common/EmptyState";

export default function YoutubeResumenGeneral() {
  const { data, loading, error } = useApiData("/api/canal/youtube/resumen-general");

  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton) return <PageSkeleton />;
  if (loading) return null;
  if (error || !data) return <EmptyState message="No se pudo cargar la información de este canal." />;
  if (data.sinDatos) {
    return <EmptyState message="Aún no hay datos sincronizados para tu cuenta en este canal." />;
  }

  return (
    <ChannelResumenGeneral
      filters={[
        { label: "Anunciante", options: data.anunciantes },
        { label: "Campañas", options: data.campanas },
      ]}
      kpis={[
        { label: "Impresiones Totales", value: data.kpis.impresionesTotales },
        { label: "Visualizaciones", value: data.kpis.visualizaciones },
        { label: "VTR", value: data.kpis.vtr, percent: true },
      ]}
      chartData={data.mensual}
      chartSeries={[
        { key: "impresionesTotales", label: "Impresiones Totales", color: "#C4216F", type: "bar", yAxisId: "left" },
        { key: "visualizaciones", label: "Visualizaciones", color: "#57007E", type: "line", yAxisId: "right" },
      ]}
      donuts={[
        {
          title: "Consumo por Ciudades",
          labelHeader: "Ubicación",
          data: data.ciudades.map((c) => ({ label: c.ubicacion, value: c.impresionesTotales })),
        },
        {
          title: "Consumo por Dispositivos",
          labelHeader: "Dispositivos",
          data: data.dispositivos.map((d) => ({ label: d.dispositivo, value: d.impresionesTotales })),
        },
      ]}
    />
  );
}
