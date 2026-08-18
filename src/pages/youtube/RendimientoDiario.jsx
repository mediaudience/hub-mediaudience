import ChannelRendimientoDiario from "../ChannelRendimientoDiario";
import useApiData from "../../hooks/useApiData";
import PageSkeleton from "../../components/common/PageSkeleton";
import useDelayedLoading from "../../hooks/useDelayedLoading";
import EmptyState from "../../components/common/EmptyState";

export default function YoutubeRendimientoDiario() {
  const { data, loading, error } = useApiData("/api/canal/youtube/rendimiento-diario");

  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton) return <PageSkeleton variant="table" />;
  if (loading) return null;
  if (error || !data) return <EmptyState message="No se pudo cargar la información de este canal." />;

  return <ChannelRendimientoDiario data={data} filters={[{ label: "Campaña", options: data.campanas }]} />;
}
