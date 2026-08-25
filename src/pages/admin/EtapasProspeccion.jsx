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

const TIPO_LABEL = { abierta: "Abierta", ganada: "Ganada", perdida: "Perdida" };

export default function AdminEtapasProspeccion() {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [tipoNuevo, setTipoNuevo] = useState("abierta");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/etapas-prospeccion");
      setEtapas(res.etapas);
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
      await apiFetch("/api/admin/etapas-prospeccion", {
        method: "POST",
        body: JSON.stringify({ codigo: codigoNuevo, nombre: nombreNuevo, tipo: tipoNuevo }),
      });
      setCodigoNuevo("");
      setNombreNuevo("");
      setTipoNuevo("abierta");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function toggleActivo(e) {
    if (
      e.activo &&
      !window.confirm(`¿Desactivar "${e.nombre}"? Desaparecerá del tablero de Prospección hasta que la reactives.`)
    ) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/etapas-prospeccion/${e.codigo}`, {
        method: "PUT",
        body: JSON.stringify({ activo: !e.activo }),
      });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function mover(e, direccion) {
    const ordenados = [...etapas].sort((a, b) => a.orden - b.orden);
    const idx = ordenados.findIndex((x) => x.codigo === e.codigo);
    const vecino = ordenados[idx + direccion];
    if (!vecino) return;
    setError("");
    try {
      await Promise.all([
        apiFetch(`/api/admin/etapas-prospeccion/${e.codigo}`, { method: "PUT", body: JSON.stringify({ orden: vecino.orden }) }),
        apiFetch(`/api/admin/etapas-prospeccion/${vecino.codigo}`, { method: "PUT", body: JSON.stringify({ orden: e.orden }) }),
      ]);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const ordenadas = [...etapas].sort((a, b) => a.orden - b.orden);

  return (
    <div>
      <GradientHeader title="Administración: Etapas de Prospección" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-6 max-w-xl mb-4">
        <h2 className="text-lg font-bold text-brand-purple mb-1">+ Nueva etapa</h2>
        <p className="text-sm text-slate-label mb-4">
          Se suma como una columna más en el tablero de Gestión &gt; Prospección. Solo un Super Admin puede hacer esto.
        </p>
        <form onSubmit={crear} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código</label>
            <input
              required
              value={codigoNuevo}
              onChange={(e) => setCodigoNuevo(e.target.value)}
              placeholder="Ej. propuesta"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input
              required
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej. Propuesta enviada"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
            <select
              value={tipoNuevo}
              onChange={(e) => setTipoNuevo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            >
              <option value="abierta">Abierta (en curso)</option>
              <option value="ganada">Ganada (habilita "Convertir a Cliente")</option>
              <option value="perdida">Perdida (cierra sin conversión)</option>
            </select>
          </div>
          <div>
            <button
              type="submit"
              disabled={creando}
              className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
            >
              {creando ? "Creando..." : "Crear etapa"}
            </button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Spinner label="Cargando etapas..." />
      ) : ordenadas.length === 0 ? (
        <EmptyState message="No hay etapas en el catálogo todavía." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-brand-purple text-white text-left">
                <th className="px-4 py-3 font-semibold" />
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((e, i) => (
                <tr key={e.codigo} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <button type="button" onClick={() => mover(e, -1)} disabled={i === 0} className="text-slate-label disabled:opacity-30 mr-1">
                      ↑
                    </button>
                    <button type="button" onClick={() => mover(e, 1)} disabled={i === ordenadas.length - 1} className="text-slate-label disabled:opacity-30">
                      ↓
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-800">{e.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{TIPO_LABEL[e.tipo] ?? e.tipo}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {e.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => toggleActivo(e)} className="text-brand-purple hover:underline text-sm font-medium">
                      {e.activo ? "Desactivar" : "Activar"}
                    </button>
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
