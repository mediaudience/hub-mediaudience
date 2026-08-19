import { useParams } from "react-router-dom";
import ChannelRendimientoDiario from "./ChannelRendimientoDiario";
import useApiData from "../hooks/useApiData";
import PageSkeleton from "../components/common/PageSkeleton";
import useDelayedLoading from "../hooks/useDelayedLoading";
import EmptyState from "../components/common/EmptyState";

// Página genérica de Rendimiento Diario para cualquier canal -- ver
// CanalResumenGeneral.jsx para el porqué de la consolidación.
export default function CanalRendimientoDiario() {
  const { canal } = useParams();
  const { data, loading, error } = useApiData(`/api/canal/${canal}/rendimiento-diario`);

  const showSkeleton = useDelayedLoading(loading);

  if (showSkeleton) return <PageSkeleton variant="table" />;
  if (loading) return null;
  if (error || !data) return <EmptyState message="No se pudo cargar la información de este canal." />;

  return <ChannelRendimientoDiario data={data} filters={[{ label: "Campaña", options: data.campanas }]} />;
}
