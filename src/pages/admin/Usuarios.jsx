import { useEffect, useState } from "react";
import GradientHeader from "../../components/common/GradientHeader";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { PERFILES_INTERNO, veTodosLosClientesDelPais } from "../../../shared/perfilesInterno";

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

const ROL_BADGE_CLASS = {
  super_admin: "bg-brand-magenta text-white",
  admin: "bg-brand-purple/10 text-brand-purple",
  usuario_interno: "bg-slate-label/10 text-slate-label",
  usuario_externo: "bg-brand-magenta/10 text-brand-magenta",
};

function RolBadge({ rol }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROL_BADGE_CLASS[rol] ?? "bg-slate-label/10 text-slate-label"}`}>
      {ROL_LABEL[rol] ?? rol}
    </span>
  );
}

// Checkboxes de anunciantes de UN cliente ya visible para el usuario -- todos
// marcados equivale a "sin restricción" (ver anunciantesPayloadDeCliente).
function AnunciantesCheckboxes({ cliente, seleccionados, onToggle }) {
  if (!cliente || cliente.anunciantes.length === 0) {
    return <p className="text-sm text-slate-label">Este cliente no tiene anunciantes asociados todavía.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-3">
      {cliente.anunciantes.map((a) => (
        <label key={a} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={seleccionados.includes(a)}
            onChange={(e) => onToggle(a, e.target.checked)}
            className="accent-brand-magenta"
          />
          {a}
        </label>
      ))}
    </div>
  );
}

// navigator.clipboard requiere "contexto seguro" (HTTPS) -- en este panel, que
// hoy corre en HTTP plano, el navegador la deja undefined o la rechaza sin
// avisar. Este fallback con execCommand sí funciona sobre HTTP.
function copyConFallback(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("No se pudo copiar");
}

function CopyButton({ value }) {
  const [status, setStatus] = useState("idle");

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        copyConFallback(value);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs font-medium text-brand-purple hover:underline whitespace-nowrap"
    >
      {status === "copied" ? "¡Copiado!" : status === "error" ? "No se pudo copiar, selecciónala" : "Copiar"}
    </button>
  );
}

const EMPTY_FORM = {
  id: null,
  nombre: "",
  email: "",
  rol: "usuario_externo",
  clienteId: "",
  clienteIds: [],
  anunciantesPorCliente: {},
  pais: "",
  perfil: "",
  activo: true,
};

const FILTROS_INVITACION = [
  { key: "todos", label: "Todos" },
  { key: "pendientes", label: "Pendientes por activar" },
  { key: "activas", label: "Invitación activa" },
];

function NotificacionInvitacion({ notif, onCerrar }) {
  const mostrarPassword = !notif.invitacionEnviada;
  return (
    <div
      className={`mb-2 rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-4 ${
        mostrarPassword
          ? "bg-brand-purple/5 border-brand-purple/20 text-gray-800"
          : "bg-semaphore-green/10 border-semaphore-green/20 text-gray-800"
      }`}
    >
      <div className="flex flex-col gap-1">
        {mostrarPassword ? (
          <>
            <span>
              Contraseña temporal para <strong>{notif.email}</strong>:{" "}
              <span className="font-mono font-bold text-brand-purple">{notif.password}</span> — cópiala ahora, no se
              volverá a mostrar.
            </span>
            <span className="text-xs text-semaphore-orange">
              {notif.invitacionError
                ? `No se pudo enviar el correo (${notif.invitacionError}) — compártela manualmente.`
                : "No se envió por correo — compártela manualmente."}
            </span>
          </>
        ) : (
          <span className="text-green-700">✓ Invitación enviada por correo a {notif.email}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {mostrarPassword && <CopyButton value={notif.password} />}
        <button
          type="button"
          onClick={() => onCerrar(notif.id)}
          className="text-slate-label hover:text-gray-700"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function InvitacionBadge({ ultimoLogin }) {
  const pendiente = !ultimoLogin;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        pendiente ? "bg-semaphore-orange/15 text-semaphore-orange" : "bg-semaphore-green/15 text-green-700"
      }`}
    >
      {pendiente ? "Pendiente" : "Activa"}
    </span>
  );
}

// Menu de acciones por fila -- un solo control igual en todas las filas (en
// vez de una cantidad variable de links de texto segun que aplique para cada
// usuario), para que la columna quede simetrica sin importar el caso.
function AccionesMenu({
  usuario: u,
  currentUser,
  abierto,
  onToggle,
  onEditar,
  onReset,
  onToggleActivo,
  onReenviar,
  onEliminar,
  reenviando,
}) {
  const esStaff = u.rol === "admin" || u.rol === "super_admin";
  const sinAcciones = u.rol === "super_admin" && currentUser.rol !== "super_admin";
  const esUnoMismo = u.id === currentUser.id;
  // Mismo criterio que el backend: solo Super Admin elimina a otro Admin/Super
  // Admin; nadie puede eliminarse a si mismo.
  const puedeEliminar = !esUnoMismo && (!esStaff || currentUser.rol === "super_admin");
  return (
    <div className="relative inline-block text-left" data-acciones-menu>
      <button
        type="button"
        onClick={() => !sinAcciones && onToggle(u.id)}
        disabled={sinAcciones}
        aria-haspopup="true"
        aria-expanded={abierto}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
          sinAcciones
            ? "border-slate-200 text-slate-300 cursor-not-allowed"
            : "border-slate-200 text-gray-700 hover:border-brand-purple hover:text-brand-purple"
        }`}
      >
        Acciones
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && !sinAcciones && (
        <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
          <button
            type="button"
            onClick={onEditar}
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            Editar
          </button>
          {!u.ultimoLogin && (
            <button
              type="button"
              onClick={onReenviar}
              disabled={reenviando === "enviando"}
              className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {reenviando === "enviando" ? "Enviando..." : reenviando === "enviado" ? "✓ Enviado" : "Reenviar invitación"}
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
          >
            Resetear contraseña
          </button>
          {!esUnoMismo && (
            <button
              type="button"
              onClick={onToggleActivo}
              className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
            >
              {u.activo ? "Desactivar" : "Activar"}
            </button>
          )}
          {puedeEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              className="block w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100 mt-1"
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUsuarios() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [paises, setPaises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [reenviando, setReenviando] = useState({});
  const [resetForm, setResetForm] = useState(null);
  const [resetSaving, setResetSaving] = useState(false);
  const [filtroInvitacion, setFiltroInvitacion] = useState("todos");
  const [menuAbierto, setMenuAbierto] = useState(null);

  useEffect(() => {
    if (menuAbierto === null) return;
    function cerrarSiEsAfuera(e) {
      if (!e.target.closest("[data-acciones-menu]")) setMenuAbierto(null);
    }
    document.addEventListener("click", cerrarSiEsAfuera);
    return () => document.removeEventListener("click", cerrarSiEsAfuera);
  }, [menuAbierto]);

  function notificarInvitacion({ email, password, invitacionEnviada, invitacionError }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotificaciones((prev) => [...prev, { id, email, password, invitacionEnviada, invitacionError }]);
    if (invitacionEnviada) {
      setTimeout(() => setNotificaciones((prev) => prev.filter((n) => n.id !== id)), 4000);
    }
  }

  function cerrarNotificacion(id) {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroInvitacion === "pendientes") return !u.ultimoLogin;
    if (filtroInvitacion === "activas") return !!u.ultimoLogin;
    return true;
  });

  async function cargar() {
    setLoading(true);
    try {
      const [usuariosRes, clientesRes, paisesRes] = await Promise.all([
        apiFetch("/api/admin/usuarios"),
        apiFetch("/api/admin/clientes"),
        apiFetch("/api/admin/paises"),
      ]);
      setUsuarios(usuariosRes.usuarios);
      setClientes(clientesRes.clientes.filter((c) => c.activo));
      setPaises(paisesRes.paises.filter((p) => p.activo));
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
  }

  function abrirEditar(u) {
    setForm({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      clienteId: u.clienteId || "",
      clienteIds: u.clienteIds || [],
      anunciantesPorCliente: u.anunciantesPorCliente || {},
      pais: u.pais || "",
      perfil: u.perfil || "",
      activo: u.activo,
    });
  }

  // Anunciantes marcados ahora mismo para `clienteId` en el form -- si no hay
  // restricción explícita en curso, arranca con todos los del cliente (= ve
  // todos, comportamiento default).
  function anunciantesSeleccionados(clienteId) {
    const cliente = clientes.find((c) => c.id === Number(clienteId));
    if (!cliente) return [];
    return form.anunciantesPorCliente[clienteId] ?? cliente.anunciantes;
  }

  function toggleAnunciante(clienteId, anunciante, checked) {
    const actual = anunciantesSeleccionados(clienteId);
    if (!checked && actual.length <= 1) return; // no dejar 0 anunciantes marcados
    const nuevo = checked ? [...actual, anunciante] : actual.filter((a) => a !== anunciante);
    setForm((f) => ({ ...f, anunciantesPorCliente: { ...f.anunciantesPorCliente, [clienteId]: nuevo } }));
  }

  // null = sin restricción (ve todos, incluidos los que se agreguen después);
  // array = subconjunto explícito. Comparar contra el total del cliente en
  // vez de confiar en si hubo un toggle, para que "todos marcados" siempre se
  // guarde como "sin restricción".
  function anunciantesPayloadDeCliente(clienteId) {
    const cliente = clientes.find((c) => c.id === Number(clienteId));
    if (!cliente) return null;
    const seleccion = anunciantesSeleccionados(clienteId);
    return seleccion.length >= cliente.anunciantes.length ? null : seleccion;
  }

  // Manager/Ejecutivo Comercial ven todo el país (ver
  // shared/perfilesInterno.js) -- el checklist manual de clientes puntuales
  // queda oculto para ellos, y el guardado siempre manda listas vacías para
  // no arrastrar una asignación manual de un perfil anterior.
  const paisCompleto = form.rol === "usuario_interno" && veTodosLosClientesDelPais(form.perfil);

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        rol: form.rol,
        clienteId: form.rol === "usuario_externo" ? Number(form.clienteId) || null : null,
        clienteIds: form.rol === "usuario_interno" ? (paisCompleto ? [] : form.clienteIds) : undefined,
        pais: form.rol === "usuario_interno" ? form.pais || null : null,
        perfil: form.rol === "usuario_interno" ? form.perfil || null : null,
        anunciantes:
          form.rol === "usuario_externo" && form.clienteId
            ? anunciantesPayloadDeCliente(form.clienteId)
            : undefined,
        anunciantesPorCliente:
          form.rol === "usuario_interno"
            ? paisCompleto
              ? {}
              : Object.fromEntries(
                  form.clienteIds
                    .map((id) => [id, anunciantesPayloadDeCliente(id)])
                    .filter(([, v]) => v !== null)
                )
            : undefined,
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
        notificarInvitacion({
          email: form.email,
          password: res.passwordTemporal,
          invitacionEnviada: res.invitacionEnviada,
          invitacionError: res.invitacionError,
        });
        setForm(null);
      }
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function abrirReset(u) {
    setResetForm({ user: u, modo: "auto", passwordManual: "", enviarPorCorreo: true });
  }

  async function reenviarInvitacion(u) {
    setError("");
    setReenviando((r) => ({ ...r, [u.id]: "enviando" }));
    try {
      const res = await apiFetch(`/api/admin/usuarios/${u.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ enviarPorCorreo: true }),
      });
      notificarInvitacion({
        email: u.email,
        password: res.passwordTemporal,
        invitacionEnviada: res.invitacionEnviada,
        invitacionError: res.invitacionError,
      });
      setReenviando((r) => ({ ...r, [u.id]: "enviado" }));
      setTimeout(
        () =>
          setReenviando((r) => {
            const next = { ...r };
            delete next[u.id];
            return next;
          }),
        2000
      );
    } catch (err) {
      setError(err.message);
      setReenviando((r) => {
        const next = { ...r };
        delete next[u.id];
        return next;
      });
    }
  }

  async function confirmarReset(e) {
    e.preventDefault();
    setResetSaving(true);
    setError("");
    try {
      const body = {
        ...(resetForm.modo === "manual" ? { password: resetForm.passwordManual } : {}),
        enviarPorCorreo: resetForm.enviarPorCorreo,
      };
      const res = await apiFetch(`/api/admin/usuarios/${resetForm.user.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      notificarInvitacion({
        email: resetForm.user.email,
        password: res.passwordTemporal,
        invitacionEnviada: res.invitacionEnviada,
        invitacionError: res.invitacionError,
      });
      setResetForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetSaving(false);
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

  async function eliminarUsuario(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre} (${u.email}) definitivamente? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/admin/usuarios/${u.id}`, { method: "DELETE" });
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

      {notificaciones.map((notif) => (
        <NotificacionInvitacion key={notif.id} notif={notif} onCerrar={cerrarNotificacion} />
      ))}

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
            <>
              <div className="flex gap-2 mb-3">
                {FILTROS_INVITACION.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFiltroInvitacion(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filtroInvitacion === f.key
                        ? "bg-brand-magenta text-white"
                        : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {usuariosFiltrados.length === 0 ? (
                <EmptyState message="No hay usuarios que coincidan con este filtro." />
              ) : (
              <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-brand-purple text-white text-left">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Rol</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Invitación</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u, i) => (
                    <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-2.5 text-gray-800">{u.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <RolBadge rol={u.rol} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {u.rol === "usuario_interno" ? (
                          <>
                            {u.perfil && (
                              <span className="mr-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-magenta/10 text-brand-magenta">
                                {PERFILES_INTERNO.find((p) => p.codigo === u.perfil)?.nombre ?? u.perfil}
                              </span>
                            )}
                            {u.pais && (
                              <span className="mr-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-purple/10 text-brand-purple">
                                {paises.find((p) => p.codigo === u.pais)?.nombre ?? u.pais} (todos)
                              </span>
                            )}
                            {u.clienteNombres.length ? u.clienteNombres.join(", ") : !u.pais && "— (sin asignar)"}
                          </>
                        ) : u.rol === "admin" || u.rol === "super_admin" ? (
                          "Todos"
                        ) : (
                          u.clienteNombre || "—"
                        )}
                        {Object.keys(u.anunciantesPorCliente || {}).length > 0 && (
                          <span
                            className="ml-1.5 text-xs text-brand-magenta"
                            title="Ve solo algunos anunciantes de este/estos cliente(s)"
                          >
                            (acotado)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <InvitacionBadge ultimoLogin={u.ultimoLogin} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <AccionesMenu
                          usuario={u}
                          currentUser={currentUser}
                          abierto={menuAbierto === u.id}
                          onToggle={(id) => setMenuAbierto((prev) => (prev === id ? null : id))}
                          onEditar={() => {
                            setMenuAbierto(null);
                            abrirEditar(u);
                          }}
                          onReset={() => {
                            setMenuAbierto(null);
                            abrirReset(u);
                          }}
                          onToggleActivo={() => {
                            setMenuAbierto(null);
                            toggleActivo(u);
                          }}
                          onReenviar={() => reenviarInvitacion(u)}
                          onEliminar={() => {
                            setMenuAbierto(null);
                            eliminarUsuario(u);
                          }}
                          reenviando={reenviando[u.id]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
              )}
            </>
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
                    clienteId: e.target.value === "usuario_externo" ? f.clienteId : "",
                    clienteIds: e.target.value === "usuario_interno" ? f.clienteIds : [],
                    pais: e.target.value === "usuario_interno" ? f.pais : "",
                    perfil: e.target.value === "usuario_interno" ? f.perfil : "",
                    anunciantesPorCliente: {},
                  }))
                }
                disabled={
                  (form.id === currentUser.id && ["super_admin", "admin"].includes(form.rol)) ||
                  (form.rol === "super_admin" && currentUser.rol !== "super_admin")
                }
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta disabled:bg-slate-50"
              >
                {currentUser.rol === "super_admin" && <option value="super_admin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="usuario_interno">Usuario Interno</option>
                <option value="usuario_externo">Usuario Externo</option>
              </select>
            </div>

            {form.rol === "usuario_externo" && (
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

            {form.rol === "usuario_externo" && form.clienteId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Anunciantes visibles</label>
                <AnunciantesCheckboxes
                  cliente={clientes.find((c) => c.id === Number(form.clienteId))}
                  seleccionados={anunciantesSeleccionados(form.clienteId)}
                  onToggle={(a, checked) => toggleAnunciante(form.clienteId, a, checked)}
                />
                <p className="mt-1.5 text-xs text-slate-label">
                  Con todos marcados, este usuario ve todos los anunciantes de este cliente (incluidos los que se
                  agreguen después).
                </p>
              </div>
            )}

            {form.rol === "usuario_interno" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">País</label>
                <select
                  required={paisCompleto}
                  value={form.pais}
                  onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                >
                  {!paisCompleto && <option value="">— Sin país (solo clientes marcados abajo)</option>}
                  {paises.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-label">
                  {paisCompleto
                    ? "Le da acceso automático a todos los clientes y anunciantes activos de ese país, incluidos los que se creen después."
                    : "Le da acceso automático a todos los clientes activos de ese país, incluidos los que se creen después. Se suma a los clientes marcados abajo, no los reemplaza."}
                </p>
              </div>
            )}

            {form.rol === "usuario_interno" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Perfil</label>
                <select
                  value={form.perfil}
                  onChange={(e) => {
                    const nuevoPerfil = e.target.value;
                    setForm((f) => ({
                      ...f,
                      perfil: nuevoPerfil,
                      clienteIds: veTodosLosClientesDelPais(nuevoPerfil) ? [] : f.clienteIds,
                      anunciantesPorCliente: veTodosLosClientesDelPais(nuevoPerfil) ? {} : f.anunciantesPorCliente,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                >
                  <option value="">— Sin perfil (ve todas las secciones)</option>
                  {PERFILES_INTERNO.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-label">
                  Define qué secciones de Gestión/Campañas puede abrir (no qué datos ve: eso lo sigue decidiendo el
                  país y los clientes de abajo).
                </p>
              </div>
            )}

            {form.rol === "usuario_interno" && !paisCompleto && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Clientes puntuales adicionales
                </label>
                {clientes.length === 0 ? (
                  <p className="text-sm text-slate-label">No hay clientes activos — crea uno primero.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3">
                    {clientes.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.clienteIds.includes(c.id)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              clienteIds: e.target.checked
                                ? [...f.clienteIds, c.id]
                                : f.clienteIds.filter((id) => id !== c.id),
                            }))
                          }
                          className="accent-brand-magenta"
                        />
                        {c.nombre}
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-slate-label">
                  {form.pais
                    ? "Para sumar, además, algún cliente puntual de otro país."
                    : "Si no marcas ningún cliente (ni un país arriba), este usuario no verá datos."}
                </p>
              </div>
            )}

            {form.rol === "usuario_interno" && !paisCompleto && form.clienteIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Anunciantes visibles por cliente</label>
                <div className="flex flex-col gap-3">
                  {form.clienteIds.map((clienteId) => {
                    const cliente = clientes.find((c) => c.id === clienteId);
                    if (!cliente) return null;
                    return (
                      <div key={clienteId} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-medium text-gray-700 mb-1.5">{cliente.nombre}</p>
                        <AnunciantesCheckboxes
                          cliente={cliente}
                          seleccionados={anunciantesSeleccionados(clienteId)}
                          onToggle={(a, checked) => toggleAnunciante(clienteId, a, checked)}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-label">
                  Con todos los anunciantes de un cliente marcados, este usuario los ve todos (incluidos los que se
                  agreguen después).
                </p>
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
                disabled={saving || (form.rol === "usuario_externo" && clientes.length === 0)}
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

      {resetForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setResetForm(null)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="p-6">
              <h2 className="text-lg font-bold text-brand-purple mb-1">Resetear contraseña</h2>
              <p className="text-sm text-slate-label mb-4">
                Para <strong className="text-gray-700">{resetForm.user.nombre}</strong> ({resetForm.user.email})
              </p>
              <form onSubmit={confirmarReset} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="modoReset"
                      checked={resetForm.modo === "auto"}
                      onChange={() => setResetForm((f) => ({ ...f, modo: "auto" }))}
                      className="accent-brand-magenta"
                    />
                    Generar automáticamente
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="modoReset"
                      checked={resetForm.modo === "manual"}
                      onChange={() => setResetForm((f) => ({ ...f, modo: "manual" }))}
                      className="accent-brand-magenta"
                    />
                    Escribir una manualmente
                  </label>
                </div>

                {resetForm.modo === "manual" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={resetForm.passwordManual}
                      onChange={(e) => setResetForm((f) => ({ ...f, passwordManual: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-magenta"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={resetForm.enviarPorCorreo}
                    onChange={(e) => setResetForm((f) => ({ ...f, enviarPorCorreo: e.target.checked }))}
                    className="accent-brand-magenta"
                  />
                  Enviarla también por correo al usuario
                </label>

                <div className="flex gap-3 mt-2">
                  <button
                    type="submit"
                    disabled={resetSaving || (resetForm.modo === "manual" && resetForm.passwordManual.length < 8)}
                    className="bg-brand-magenta text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-brand-magenta/90 disabled:opacity-60"
                  >
                    {resetSaving ? "Reseteando..." : "Resetear contraseña"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetForm(null)}
                    className="text-sm font-medium text-gray-600 px-5 py-2.5 rounded-full hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
