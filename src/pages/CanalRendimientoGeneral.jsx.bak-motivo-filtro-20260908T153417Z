import { useParams, Navigate } from "react-router-dom";
import ChannelRendimientoGeneral from "./ChannelRendimientoGeneral";
import useApiData from "../hooks/useApiData";
import PageSkeleton from "../components/common/PageSkeleton";
import useDelayedLoading from "../hooks/useDelayedLoading";
import EmptyState from "../components/common/EmptyState";
import { getCanalMetricas } from "../config/canalMetricas";
import { useClienteActivo } from "../context/ClienteActivoContext";

// Página genérica de Rendimiento General para cualquier canal (reemplaza a
// CanalResumenGeneral + CanalRendimientoDiario desde la reestructuración de
// 2026-08-24) -- las pestañas, columnas y KPIs de cada servicio vienen de
// src/config/canalMetricas.js, no de este archivo.
export default function CanalRendimientoGeneral() {
  const { canal } = useParams();
  const { data, loading, error } = useApiData(`/api/canal/${canal}/rendimiento-general`);
  const { clienteActivo, canalesDelClienteActivo } = useClienteActivo();

  const showSkeleton = useDelayedLoading(loading);

  // Si el cliente activo elegido no contrató este canal (ej. se cambió de
  // cliente estando parado en otro servicio), redirige al primer servicio
  // que sí tenga en vez de dejar la tabla en 0 filas.
  if (clienteActivo && canalesDelClienteActivo && !canalesDelClienteActivo.includes(canal)) {
    const destino = canalesDelClienteActivo[0];
    return <Navigate to={destino ? `/${destino}/rendimiento-general` : "/"} replace />;
  }

  if (showSkeleton) return <PageSkeleton />;
  if (loading) return null;
  if (error || !data) return <EmptyState message="No se pudo cargar la información de este canal." />;
  if (data.sinDatos) {
    return <EmptyState message="Aún no hay datos sincronizados para tu cuenta en este canal." />;
  }

  const metricas = getCanalMetricas(canal);
  if (!metricas) {
    return <EmptyState message="Este servicio todavía no tiene su estructura de Rendimiento General configurada." />;
  }

  return <ChannelRendimientoGeneral data={data} uiTabs={metricas.uiTabs} />;
}
