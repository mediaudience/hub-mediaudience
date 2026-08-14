export default function Spinner({ label = "Cargando..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
      <span className="text-sm text-slate-label">{label}</span>
    </div>
  );
}
