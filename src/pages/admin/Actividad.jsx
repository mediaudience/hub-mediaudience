import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

async function apiFetch(url, options) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Ocurrió un error");
  return data;
}

const ROL_LABEL = {
  super_admin: "Super Admin",
  admin: "Admin",
  usuario_interno: "Usuario Interno",
  usuario_externo: "Usuario Externo",
};

function formatFecha(fecha) {
  // `created_at` sale de SQLite en UTC ("YYYY-MM-DD HH:MM:SS"), sin
  // zona -- se lo indicamos a Date explícitamente para que la hora mostrada
  // se convierta a la zona local del navegador en vez de tratarse como si ya
  // fuera local.
  return new Date(`${fecha.replace(" ", "T")}Z`).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function diaISO(day) {
  if (!day) return null;
  return `${day.year}-${String(day.month + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export default function AdminActividad() {
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [emails, setEmails] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [actorEmail, setActorEmail] = useState(null);
  const [accion, setAccion] = useState(null);
  const [periodo, setPeriodo] = useState(null);

  async function cargarFiltros() {
    try {
      const [usuariosRes, accionesRes] = await Promise.all([
        apiFetch("/api/admin/usuarios"),
        apiFetch("/api/admin/actividad/acciones"),
      ]);
      setEmails(usuariosRes.usuarios.map((u) => u.email).sort());
      setAcciones(accionesRes.acciones);
    } catch {
      // Los filtros son un plus -- si fallan, la tabla igual carga sin ellos.
    }
  }

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
      if (actorEmail) params.set("actorEmail", actorEmail);
      if (accion) params.set("accion", accion);
      if (periodo?.inicio) params.set("desde", periodo.inicio);
      if (periodo?.fin) params.set("hasta", `${periodo.fin} 23:59:59`);
      const res = await apiFetch(`/api/admin/actividad?${params.toString()}`);
      setRegistros(res.registros);
      setTotal(res.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarFiltros();
  }, []);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, actorEmail, accion, periodo]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const filters = [
    { label: "Usuario", options: emails, value: actorEmail, onChange: (v) => (setActorEmail(v), setPagina(1)) },
    { label: "Acción", options: acciones, value: accion, onChange: (v) => (setAccion(v), setPagina(1)) },
  ];

  return (
    <div>
      <GradientHeader
        title="Actividad"
        filters={filters}
        showDownload={false}
        onApplyPeriod={({ startDay, endDay }) => {
          setPeriodo(startDay && endDay ? { inicio: diaISO(startDay), fin: diaISO(endDay) } : null);
          setPagina(1);
        }}
        onClearFilters={() => {
          setActorEmail(null);
          setAccion(null);
          setPeriodo(null);
          setPagina(1);
        }}
      />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <Spinner label="Cargando actividad..." />
      ) : registros.length === 0 ? (
        <EmptyState message="No hay actividad registrada con estos filtros." />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-brand-purple text-white text-left">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Acción</th>
                  <th className="px-4 py-3 font-semibold">Detalle</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-2.5 text-gray-800">{r.actorEmail ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{ROL_LABEL[r.actorRol] ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">{r.accion}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.detalle ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="flex items-center justify-between mt-4 text-sm text-slate-label">
            <span>
              {total} registro{total === 1 ? "" : "s"} -- página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
                className="px-3 py-1.5 rounded-full border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="px-3 py-1.5 rounded-full border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
