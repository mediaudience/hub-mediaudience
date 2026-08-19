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

export default function AdminPaises() {
  const [paises, setPaises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/paises");
      setPaises(res.paises);
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
      await apiFetch("/api/admin/paises", {
        method: "POST",
        body: JSON.stringify({ codigo: codigoNuevo, nombre: nombreNuevo }),
      });
      setCodigoNuevo("");
      setNombreNuevo("");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function toggleActivo(p) {
    if (
      p.activo &&
      !window.confirm(
        `¿Desactivar "${p.nombre}"? Desaparecerá de las opciones al crear o editar clientes hasta que lo reactives.`
      )
    ) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/paises/${p.codigo}`, { method: "PUT", body: JSON.stringify({ activo: !p.activo }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Países" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-6 max-w-xl mb-4">
        <h2 className="text-lg font-bold text-brand-purple mb-1">+ Nuevo País</h2>
        <p className="text-sm text-slate-label mb-4">
          Se suma como una opción más al crear o editar un cliente (prefijo de nombre). Solo un Super Admin puede
          hacer esto.
        </p>
        <form onSubmit={crear} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código</label>
            <input
              required
              value={codigoNuevo}
              onChange={(e) => setCodigoNuevo(e.target.value.toUpperCase())}
              placeholder="Ej. CO"
              maxLength={3}
              className="w-32 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            />
            <p className="mt-1.5 text-xs text-slate-label">2 o 3 letras -- es el prefijo que llevará el nombre de cada cliente de ese país (ej. CO_NombreCliente).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input
              required
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej. Colombia"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={creando}
              className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
            >
              {creando ? "Creando..." : "Crear país"}
            </button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Spinner label="Cargando países..." />
      ) : paises.length === 0 ? (
        <EmptyState message="No hay países en el catálogo todavía." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-brand-purple text-white text-left">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {paises.map((p, i) => (
                <tr key={p.codigo} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-4 py-2.5 text-gray-800">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{p.codigo}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleActivo(p)}
                      className="text-brand-purple hover:underline text-sm font-medium"
                    >
                      {p.activo ? "Desactivar" : "Activar"}
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
