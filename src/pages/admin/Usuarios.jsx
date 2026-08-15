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

const ROL_LABEL = { admin: "Admin", cliente: "Cliente" };

function RolBadge({ rol }) {
  const isAdmin = rol === "admin";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        isAdmin ? "bg-brand-purple/10 text-brand-purple" : "bg-brand-magenta/10 text-brand-magenta"
      }`}
    >
      {ROL_LABEL[rol] ?? rol}
    </span>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API bloqueada (permiso, contexto no seguro, etc.) -- el
      // usuario igual puede seleccionar el texto a mano, no es fatal.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs font-medium text-brand-purple hover:underline whitespace-nowrap"
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}

const EMPTY_FORM = { id: null, nombre: "", email: "", rol: "cliente", clienteId: "", activo: true };

export default function AdminUsuarios() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passwordGenerada, setPasswordGenerada] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const [usuariosRes, clientesRes] = await Promise.all([
        apiFetch("/api/admin/usuarios"),
        apiFetch("/api/admin/clientes"),
      ]);
      setUsuarios(usuariosRes.usuarios);
      setClientes(clientesRes.clientes.filter((c) => c.activo));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirNuevo() {
    setForm({ ...EMPTY_FORM });
    setPasswordGenerada(null);
  }

  function abrirEditar(u) {
    setForm({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, clienteId: u.clienteId || "", activo: u.activo });
    setPasswordGenerada(null);
  }

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        rol: form.rol,
        clienteId: form.rol === "cliente" ? Number(form.clienteId) || null : null,
        activo: form.activo,
      };
      if (form.id) {
        await apiFetch(`/api/admin/usuarios/${form.id}`, { method: "PUT", body: JSON.stringify(body) });
        setForm(null);
      } else {
        const res = await apiFetch("/api/admin/usuarios", {
          method: "POST",
          body: JSON.stringify({ ...body, email: form.email }),
        });
        setPasswordGenerada({ email: form.email, password: res.passwordTemporal });
        setForm(null);
      }
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetearPassword(u) {
    setError("");
    try {
      const res = await apiFetch(`/api/admin/usuarios/${u.id}/reset-password`, { method: "POST" });
      setPasswordGenerada({ email: u.email, password: res.passwordTemporal });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActivo(u) {
    if (u.activo && !window.confirm(`¿Desactivar a ${u.nombre}? No podrá iniciar sesión hasta que lo reactives.`)) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/usuarios/${u.id}`, { method: "PUT", body: JSON.stringify({ activo: !u.activo }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <GradientHeader title="Administración: Usuarios" showDownload={false} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {passwordGenerada && (
        <div className="mb-4 rounded-lg bg-brand-purple/5 border border-brand-purple/20 px-4 py-3 text-sm text-gray-800 flex items-center justify-between gap-4">
          <span>
            Contraseña temporal para <strong>{passwordGenerada.email}</strong>:{" "}
            <span className="font-mono font-bold text-brand-purple">{passwordGenerada.password}</span> — cópiala
            ahora, no se volverá a mostrar.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <CopyButton value={passwordGenerada.password} />
            <button
              type="button"
              onClick={() => setPasswordGenerada(null)}
              className="text-slate-label hover:text-gray-700"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {!form && (
        <>
          <button
            type="button"
            onClick={abrirNuevo}
            className="mb-4 bg-brand-magenta text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-brand-magenta/90"
          >
            + Nuevo Usuario
          </button>

          {loading ? (
            <Spinner label="Cargando usuarios..." />
          ) : usuarios.length === 0 ? (
            <EmptyState message="No hay usuarios creados todavía. Usa '+ Nuevo Usuario' para dar de alta el primero." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="bg-brand-purple text-white text-left">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Rol</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-gray-800">{u.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <RolBadge rol={u.rol} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{u.clienteNombre || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => abrirEditar(u)}
                          className="text-brand-purple hover:underline text-sm font-medium mr-3"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => resetearPassword(u)}
                          className="text-brand-purple hover:underline text-sm font-medium mr-3"
                        >
                          Resetear contraseña
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => toggleActivo(u)}
                            className="text-brand-purple hover:underline text-sm font-medium"
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {form && (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-bold text-brand-purple mb-4">
            {form.id ? "Editar Usuario" : "Nuevo Usuario"}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                disabled={!!form.id}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta disabled:bg-slate-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
              <select
                value={form.rol}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rol: e.target.value,
                    clienteId: e.target.value === "admin" ? "" : f.clienteId,
                  }))
                }
                disabled={form.id === currentUser.id && form.rol === "admin"}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta disabled:bg-slate-50"
              >
                <option value="admin">Admin</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>

            {form.rol === "cliente" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente</label>
                <select
                  required
                  value={form.clienteId}
                  onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                >
                  <option value="" disabled>
                    {clientes.length === 0 ? "No hay clientes activos — crea uno primero" : "Selecciona un cliente"}
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.id && form.id !== currentUser.id && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="accent-brand-magenta"
                />
                Usuario activo
              </label>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={saving || (form.rol === "cliente" && clientes.length === 0)}
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
