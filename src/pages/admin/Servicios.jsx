import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../context/AuthContext";

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

// Solo vista previa -- el slug real y definitivo lo calcula el backend
// (server/adminRoutes.js) al crear el servicio.
function previsualizarSlug(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminServicios() {
  const { refrescarCanales } = useAuth();
  const [canales, setCanales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");

  async function cargar() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/canales");
      setCanales(res.canales);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e) {
    e.preventDefault();
    setCreando(true);
    setError("");
    try {
      await apiFetch("/api/admin/canales", { method: "POST", body: JSON.stringify({ nombre: nombreNuevo }) });
      setNombreNuevo("");
      await cargar();
      await refrescarCanales();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(c) {
    setEditando(c.slug);
    setNombreEditado(c.nombre);
  }

  function cancelarEdicion() {
    setEditando(null);
    setNombreEditado("");
  }

  async function guardarNombre(c) {
    const nuevo = nombreEditado.trim();
    if (!nuevo || nuevo === c.nombre) {
      cancelarEdicion();
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/canales/${c.slug}`, { method: "PUT", body: JSON.stringify({ nombre: nuevo }) });
      cancelarEdicion();
      await cargar();
      await refrescarCanales();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActivo(c) {
    if (
      c.activo &&
      !window.confirm(
        `¿Desactivar "${c.nombre}"? Desaparecerá del menú y de las opciones al configurar clientes hasta que lo reactives.`
      )
    ) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/canales/${c.slug}`, { method: "PUT", body: JSON.stringify({ activo: !c.activo }) });
      await cargar();
      await refrescarCanales();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Servicios" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-6 max-w-xl mb-4">
        <h2 className="text-lg font-bold text-brand-purple mb-1">+ Nuevo Servicio</h2>
        <p className="text-sm text-slate-label mb-4">
          Se crea con la misma estructura que los demás (Resumen General + Rendimiento Diario, Sheet de 5 pestañas
          por cliente que lo contrate). Solo un Super Admin puede hacer esto.
        </p>
        <form onSubmit={crear} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input
              required
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej. Meta Ads"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            />
            {nombreNuevo.trim() && (
              <p className="mt-1.5 text-xs text-slate-label">
                URL / identificador: <span className="font-mono">{previsualizarSlug(nombreNuevo) || "—"}</span>
              </p>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={creando || !previsualizarSlug(nombreNuevo)}
              className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
            >
              {creando ? "Creando..." : "Crear servicio"}
            </button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Spinner label="Cargando servicios..." />
      ) : canales.length === 0 ? (
        <EmptyState message="No hay servicios en el catálogo todavía." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-brand-purple text-white text-left">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Identificador</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {canales.map((c, i) => (
                <tr key={c.slug} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-4 py-2.5 text-gray-800">
                    {editando === c.slug ? (
                      <input
                        autoFocus
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") guardarNombre(c);
                          if (e.key === "Escape") cancelarEdicion();
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                      />
                    ) : (
                      c.nombre
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {editando === c.slug ? (
                      <>
                        <button
                          type="button"
                          onClick={() => guardarNombre(c)}
                          className="text-brand-purple hover:underline text-sm font-medium mr-3"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelarEdicion}
                          className="text-slate-label hover:underline text-sm font-medium"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => iniciarEdicion(c)}
                          className="text-brand-purple hover:underline text-sm font-medium mr-3"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActivo(c)}
                          className="text-brand-purple hover:underline text-sm font-medium"
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
