import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";

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

const EMPTY_FORM = { id: null, nombre: "", sheetId: "", anunciantes: [], activo: true };

export default function AdminClientes() {
  const [clientes, setClientes] = useState([]);
  const [anunciantesDisponibles, setAnunciantesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const [clientesRes, anunciantesRes] = await Promise.all([
        apiFetch("/api/admin/clientes"),
        apiFetch("/api/admin/anunciantes-disponibles"),
      ]);
      setClientes(clientesRes.clientes);
      setAnunciantesDisponibles(anunciantesRes.anunciantes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function toggleAnunciante(a) {
    setForm((f) => ({
      ...f,
      anunciantes: f.anunciantes.includes(a) ? f.anunciantes.filter((x) => x !== a) : [...f.anunciantes, a],
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        sheetId: form.sheetId || null,
        anunciantes: form.anunciantes,
        activo: form.activo,
      };
      if (form.id) {
        await apiFetch(`/api/admin/clientes/${form.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/admin/clientes", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Clientes" />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!form && (
        <>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="mb-4 bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90"
          >
            + Nuevo Cliente
          </button>

          {loading ? (
            <Spinner label="Cargando clientes..." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-brand-purple text-white text-left">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Anunciantes</th>
                    <th className="px-4 py-3 font-semibold">Sheet ID</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-gray-800">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.anunciantes.join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">
                        {c.sheetId || "sin configurar"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              nombre: c.nombre,
                              sheetId: c.sheetId || "",
                              anunciantes: c.anunciantes,
                              activo: c.activo,
                            })
                          }
                          className="text-brand-purple hover:underline text-sm font-medium"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clientes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-label">
                        No hay clientes creados todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {form && (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-bold text-brand-purple mb-4">
            {form.id ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Google Sheet ID <span className="text-slate-label font-normal">(opcional por ahora)</span>
              </label>
              <input
                value={form.sheetId}
                onChange={(e) => setForm((f) => ({ ...f, sheetId: e.target.value }))}
                placeholder="ID del Spreadsheet de este cliente"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Anunciantes de este cliente</label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5">
                {anunciantesDisponibles.length === 0 && (
                  <span className="text-sm text-slate-label">
                    No hay anunciantes en los datos sincronizados todavía.
                  </span>
                )}
                {anunciantesDisponibles.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.anunciantes.includes(a)}
                      onChange={() => toggleAnunciante(a)}
                      className="accent-brand-magenta"
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            {form.id && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="accent-brand-magenta"
                />
                Cliente activo
              </label>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="text-sm font-medium text-gray-600 px-5 py-2.5 rounded-full hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
