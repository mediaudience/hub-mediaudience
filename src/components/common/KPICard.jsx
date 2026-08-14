import Card from "./Card";

export default function KPICard({ label, value }) {
  return (
    <Card accent className="px-5 py-4 flex-1 min-w-[200px]">
      <p className="text-brand-purple font-bold text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </Card>
  );
}
