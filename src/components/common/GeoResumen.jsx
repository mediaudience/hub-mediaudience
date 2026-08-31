import Card from "./Card";

// Resumen compacto al lado del mapa de la pestaña Geo -- mismos KPIs que ya
// se calculan para las KPICard de arriba (ver canalMetricas.js / calcularKpi
// en ChannelRendimientoGeneral.jsx), pero en formato tabla vertical angosta
// para convivir en la misma fila que el mapa (mapa a la derecha, resumen a
// la izquierda, pedido explícito de Jose el 2026-08-31).
export default function GeoResumen({ items }) {
  if (items.length === 0) return null;
  return (
    <Card hover={false} className="p-4 sm:p-5">
      <dl className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-xs text-slate-label">{item.label}</dt>
            <dd className="text-sm font-semibold text-gray-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
