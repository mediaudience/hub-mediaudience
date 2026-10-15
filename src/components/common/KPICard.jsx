import Card from "./Card";

export default function KPICard({ label, value }) {
  return (
    <Card className="px-5 py-5 flex-1 min-w-[200px] flex flex-col gap-2.5">
      <p className="label-mono text-[10.5px] text-gray-500">{label}</p>
      <p className="font-display font-medium text-[34px] leading-none tracking-tight text-gray-900 tabular-nums">{value}</p>
    </Card>
  );
}
