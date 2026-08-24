import GradientHeader from "../../components/common/GradientHeader";
import EmptyState from "../../components/common/EmptyState";

// Placeholder genérico para las 4 secciones de "Gestión" (Metas Comerciales,
// Prospección, Campañas Servidas, Facturación) pedidas por Jose el
// 2026-08-25 -- aún sin desarrollar, solo reservan su lugar en el Sidebar.
export default function EnDesarrollo({ titulo }) {
  return (
    <div>
      <GradientHeader title={`Gestión: ${titulo}`} showDownload={false} />
      <EmptyState message="Esta sección está en desarrollo. Todavía no hay nada que mostrar acá." />
    </div>
  );
}
