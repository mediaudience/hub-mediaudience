import ChannelRendimientoDiario from "../ChannelRendimientoDiario";
import useApiData from "../../hooks/useApiData";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

export default function PushNotificationRendimientoDiario() {
  const { data, loading, error } = useApiData("/api/canal/push-notification/rendimiento-diario");

  if (loading) return <Spinner label="Cargando rendimiento diario..." />;
  if (error || !data) return <EmptyState message="No se pudo cargar la información de este canal." />;

  return <ChannelRendimientoDiario data={data} filters={[{ label: "Campaña", options: data.campanas }]} />;
}
