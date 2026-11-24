import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { FORMATOS_TESTIGO, TESTIGO_MAX_MB, VIEWPORT_TESTIGO } from "../../../shared/previewTestigos";
import { cargarFuentes, fechaLima, hostDe, renderDispositivo, renderLamina } from "../../utils/testigoRender";

// Admin > Preview Testigos: Raiza pone la URL del medio, sube las
// creatividades y descarga el testigo (desktop, mobile y lámina 16:9) para el
// reporte, sin Photoshop. Backend en server/previewTestigosRoutes.js.

const API = "/api/preview-testigos";

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

function subirCreativo(id, file) {
  return fetch(`${API}/${id}/creativos`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Nombre-Archivo": encodeURIComponent(file.name),
    },
    body: file,
  }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || (res.status === 413 ? `${file.name} supera ${TESTIGO_MAX_MB} MB` : "No se pudo subir"));
    return data;
  });
}

function formatoFecha(iso) {
  if (!iso) return "";
  return new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString("es", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-magenta";
const btnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 hover:border-brand-magenta disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimario =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-magenta px-3.5 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed";

function EstadoChip({ estado }) {
  const estilos = {
    listo: "border-green-600/40 text-green-600",
    capturando: "border-brand-magenta/40 text-brand-magenta",
    error: "border-semaphore-orange/50 text-semaphore-orange",
  };
  const textos = { listo: "Listo", capturando: "Capturando", error: "Con error" };
  return (
    <span className={`label-mono !text-[10px] rounded border px-1.5 py-0.5 whitespace-nowrap ${estilos[estado] || ""}`}>
      {textos[estado] || estado}
    </span>
  );
}

export default function PreviewTestigos() {
  const { id } = useParams();
  return id ? <Editor key={id} id={id} /> : <Lista />;
}

// ---------------------------------------------------------------------------
// Lista + nuevo testigo
// ---------------------------------------------------------------------------

function Lista() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", cliente_id: "", url: "" });
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await apiFetch(API));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras haya capturas en curso, refresca la lista.
  const hayCapturando = datos?.testigos.some((t) => t.estado === "capturando");
  useEffect(() => {
    if (!hayCapturando) return undefined;
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [hayCapturando, cargar]);

  async function crear(e) {
    e.preventDefault();
    setCreando(true);
    setError("");
    try {
      const r = await apiFetch(API, { method: "POST", body: JSON.stringify(form) });
      navigate(`/admin/preview-testigos/${r.testigo.id}`);
    } catch (err) {
      setError(err.message);
      setCreando(false);
    }
  }

  async function borrar(t) {
    try {
      await apiFetch(`${API}/${t.id}`, { method: "DELETE" });
      setBorrando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const cambiarCliente = (v) => {
    setForm((f) => ({ ...f, cliente_id: v }));
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display font-medium text-gray-900 text-[28px] md:text-[34px] leading-tight tracking-tight">Preview Testigos</h1>
        <p className="mt-1 text-sm text-slate-label max-w-2xl">
          Pon la URL del medio donde corre la campaña, sube las creatividades y descarga el testigo listo para el reporte: desktop, mobile y
          una lámina 16:9.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="p-5 mb-6" hover={false}>
        <h2 className="label-mono text-[10.5px] text-gray-500 mb-3">Nuevo testigo</h2>
        <form onSubmit={crear} className="grid gap-3 md:grid-cols-[1fr_1fr_1.6fr_auto] items-end">
          <div>
            <label htmlFor="pt-cliente" className="block text-xs text-gray-500 mb-1">
              Cliente
            </label>
            <select id="pt-cliente" className={inputClass} value={form.cliente_id} onChange={(e) => cambiarCliente(e.target.value)}>
              <option value="">Sin cliente</option>
              {datos?.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pt-nombre" className="block text-xs text-gray-500 mb-1">
              Campaña
            </label>
            <input
              id="pt-nombre"
              className={inputClass}
              required
              maxLength={160}
              placeholder="Ej. CuidadoCapilar noviembre"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="pt-url" className="block text-xs text-gray-500 mb-1">
              URL donde corre el anuncio
            </label>
            <input
              id="pt-url"
              type="url"
              className={inputClass}
              required
              placeholder="https://www.medio.com/nota"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <button type="submit" className={btnPrimario} disabled={creando}>
            {creando ? "Creando…" : "Capturar"}
          </button>
        </form>
        <p className="mt-3 text-xs text-gray-500">
          La captura tarda entre 30 y 60 segundos: se abre el medio como computadora y como celular, y se buscan solos los espacios de
          publicidad.
        </p>
      </Card>

      {!datos && !error && (
        <div className="py-16 flex justify-center">
          <Spinner />
        </div>
      )}
      {datos && datos.testigos.length === 0 && (
        <EmptyState message="Todavía no hay testigos. Crea el primero con la URL de un medio donde esté corriendo la campaña." />
      )}
      {datos && datos.testigos.length > 0 && (
        <Card className="overflow-hidden" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Campaña", "Cliente", "Medio", "Creatividades", "Estado", "Actualizado", "Por", ""].map((h) => (
                    <th key={h} className="label-mono !text-[10.5px] text-gray-400 font-normal px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.testigos.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/admin/preview-testigos/${t.id}`} className="text-gray-900 hover:text-brand-magenta font-medium">
                        {t.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.cliente_nombre || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{hostDe(t.url)}</td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">{t.n_creativos}</td>
                    <td className="px-4 py-3">
                      <EstadoChip estado={t.estado} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatoFecha(t.updated_at)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.creado_por_nombre || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {borrando === t.id ? (
                        <span className="inline-flex gap-2 items-center">
                          <span className="text-xs text-gray-500">¿Borrar?</span>
                          <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => borrar(t)}>
                            Sí, borrar
                          </button>
                          <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setBorrando(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="text-xs text-gray-500 hover:text-red-600" onClick={() => setBorrando(t.id)}>
                          Borrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function descargarCanvas(canvas, nombre) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      resolve();
    }, "image/png");
  });
}

const nombreArchivo = (t, sufijo) =>
  `Testigo_${t.cliente_nombre ? `${t.cliente_nombre}_` : ""}${t.nombre}_${hostDe(t.url)}_${sufijo}.png`.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ]+/g, "_");

function Editor({ id }) {
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState("desktop");
  const [sel, setSel] = useState(null);
  const [capturas, setCapturas] = useState({});
  const [imgsCreativos, setImgsCreativos] = useState(new Map());
  const [subiendo, setSubiendo] = useState(0);
  const [nuevoTamano, setNuevoTamano] = useState("300x250");
  const [otraUrl, setOtraUrl] = useState("");
  const [mostrarOtra, setMostrarOtra] = useState(false);
  const [fuentes, setFuentes] = useState(false);
  const [sobre, setSobre] = useState(false);
  const canvasRef = useRef(null);
  const renderRef = useRef(null);
  const guardarTimer = useRef(null);
  const pendiente = useRef({});
  const arrastre = useRef(null);
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/${id}`);
      setT(r.testigo);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
    cargarFuentes().then(() => setFuentes(true));
  }, [cargar]);

  // Polling mientras captura.
  useEffect(() => {
    if (t?.estado !== "capturando") return undefined;
    const timer = setInterval(cargar, 3000);
    return () => clearInterval(timer);
  }, [t?.estado, cargar]);

  // Imágenes de las capturas (la URL cambia con capturado_at para romper caché).
  useEffect(() => {
    if (t?.estado !== "listo") return;
    let vivo = true;
    const v = encodeURIComponent(t.capturado_at || "");
    Promise.all(
      ["desktop", "mobile"].map((d) => (t[d] ? cargarImagen(`${API}/${t.id}/captura/${d}?v=${v}`).catch(() => null) : null))
    ).then(([desktop, mobile]) => vivo && setCapturas({ desktop, mobile }));
    return () => {
      vivo = false;
    };
  }, [t?.id, t?.estado, t?.capturado_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const idsCreativos = t?.creativos.map((c) => c.id).join(",");
  useEffect(() => {
    if (!t) return;
    let vivo = true;
    Promise.all(t.creativos.map((c) => cargarImagen(`${API}/${t.id}/creativos/${c.id}`).then((img) => [c.id, img]).catch(() => null))).then(
      (pares) => vivo && setImgsCreativos(new Map(pares.filter(Boolean)))
    );
    return () => {
      vivo = false;
    };
  }, [idsCreativos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardado automático (posiciones, asignaciones, opciones).
  const guardar = useCallback(
    (cambios) => {
      pendiente.current = { ...pendiente.current, ...cambios };
      clearTimeout(guardarTimer.current);
      guardarTimer.current = setTimeout(async () => {
        const body = pendiente.current;
        pendiente.current = {};
        try {
          await apiFetch(`${API}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        } catch (err) {
          setError(`No se guardó el último cambio: ${err.message}`);
        }
      }, 500);
    },
    [id]
  );
  // Manda ya lo pendiente (antes de subir/borrar/recapturar, para que la
  // respuesta del servidor no pise un cambio que todavía no se guardó).
  const guardarYa = useCallback(async () => {
    clearTimeout(guardarTimer.current);
    const body = pendiente.current;
    pendiente.current = {};
    if (!Object.keys(body).length) return;
    await apiFetch(`${API}/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch((err) =>
      setError(`No se guardó el último cambio: ${err.message}`)
    );
  }, [id]);
  useEffect(() => () => clearTimeout(guardarTimer.current), []);

  const opciones = useMemo(
    () => ({ marco: true, sello: true, ...(t?.opciones || {}), scroll: { desktop: 0, mobile: 0, ...(t?.opciones?.scroll || {}) } }),
    [t?.opciones]
  );

  function cambiarOpciones(o) {
    const nuevas = { ...opciones, ...o, scroll: { ...opciones.scroll, ...(o.scroll || {}) } };
    setT((prev) => ({ ...prev, opciones: nuevas }));
    guardar({ opciones: nuevas });
  }

  function cambiarEspacios(dev, espacios) {
    setT((prev) => ({ ...prev, [dev]: { ...prev[dev], espacios } }));
    guardar({ [`${dev}_espacios`]: espacios });
  }

  function asignar(espacioId, creativoId) {
    const asignaciones = { ...t.asignaciones, [espacioId]: creativoId };
    setT((prev) => ({ ...prev, asignaciones }));
    guardar({ asignaciones });
  }

  const creativosMap = imgsCreativos;
  const datosDev = useCallback(
    (dev, seleccion) => ({
      meta: t[dev],
      captura: capturas[dev],
      scroll: Math.min(opciones.scroll[dev] || 0, Math.max(0, (t[dev]?.alto || 0) - VIEWPORT_TESTIGO[dev].alto)),
      creativos: creativosMap,
      asignaciones: t.asignaciones,
      marco: opciones.marco,
      sello: opciones.sello,
      url: t.url,
      titulo: t.titulo_pagina,
      fecha: fechaLima(t.capturado_at),
      mostrarVacios: seleccion !== undefined,
      seleccion,
    }),
    [t, capturas, opciones, creativosMap]
  );

  // Dibujo en pantalla.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !t || t.estado !== "listo" || !capturas.desktop) return;
    let r;
    if (vista === "lamina") {
      const d = t.desktop ? renderDispositivo("desktop", datosDev("desktop")).canvas : null;
      const m = t.mobile && capturas.mobile ? renderDispositivo("mobile", datosDev("mobile")).canvas : null;
      r = { canvas: renderLamina({ desktop: d, mobile: m, campana: t.nombre, cliente: t.cliente_nombre, url: t.url, fecha: fechaLima(t.capturado_at) }) };
    } else {
      if (!t[vista] || !capturas[vista]) return;
      r = renderDispositivo(vista, datosDev(vista, sel));
    }
    renderRef.current = r;
    cv.width = r.canvas.width;
    cv.height = r.canvas.height;
    cv.getContext("2d").drawImage(r.canvas, 0, 0);
  }, [t, capturas, vista, sel, datosDev, fuentes]);

  // --- Interacción con el canvas: clic = cambiar creatividad, arrastrar = mover espacio.
  function puntoPagina(e) {
    const cv = canvasRef.current;
    const r = renderRef.current;
    const rect = cv.getBoundingClientRect();
    const px = ((e.clientX - rect.left) * cv.width) / rect.width / r.k;
    const py = ((e.clientY - rect.top) * cv.height) / rect.height / r.k;
    return { x: px - r.origen.x, y: py - r.origen.y + datosDev(vista).scroll };
  }

  function espacioEn(p) {
    const lista = t[vista]?.espacios || [];
    for (let i = lista.length - 1; i >= 0; i--) {
      const e = lista[i];
      if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) return e;
    }
    return null;
  }

  function onPointerDown(e) {
    if (vista === "lamina" || !renderRef.current?.origen) return;
    const p = puntoPagina(e);
    const esp = espacioEn(p);
    if (!esp) {
      setSel(null);
      return;
    }
    setSel(esp.id);
    canvasRef.current.setPointerCapture(e.pointerId);
    arrastre.current = { id: esp.id, dx: p.x - esp.x, dy: p.y - esp.y, inicio: p, movio: false };
  }

  function onPointerMove(e) {
    const a = arrastre.current;
    if (!a) return;
    const p = puntoPagina(e);
    if (!a.movio && Math.hypot(p.x - a.inicio.x, p.y - a.inicio.y) < 4) return;
    a.movio = true;
    const meta = t[vista];
    const espacios = meta.espacios.map((s) =>
      s.id === a.id
        ? {
            ...s,
            x: Math.round(Math.min(Math.max(p.x - a.dx, 0), meta.ancho - s.w)),
            y: Math.round(Math.min(Math.max(p.y - a.dy, 0), meta.alto - s.h)),
          }
        : s
    );
    setT((prev) => ({ ...prev, [vista]: { ...prev[vista], espacios } }));
  }

  function onPointerUp() {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (a.movio) {
      guardar({ [`${vista}_espacios`]: t[vista].espacios });
      return;
    }
    // clic: pasa a la siguiente creatividad del mismo tamaño
    const esp = t[vista].espacios.find((s) => s.id === a.id);
    const op = t.creativos.filter((c) => c.ancho === esp.w && c.alto === esp.h);
    if (!op.length) {
      setAviso(`Falta una creatividad de ${esp.w}×${esp.h} para ese espacio.`);
      return;
    }
    const actual = op.findIndex((c) => c.id === t.asignaciones[esp.id]);
    const sig = actual === op.length - 1 ? null : op[actual + 1].id;
    asignar(esp.id, sig);
    setAviso(sig ? `${esp.w}×${esp.h}: ${op[actual + 1].nombre}` : `${esp.w}×${esp.h}: se deja el anuncio del medio`);
  }

  // Rueda del mouse sobre el canvas = desplazar la captura.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const onWheel = (e) => {
      if (vista === "lamina" || !t?.[vista]) return;
      e.preventDefault();
      const max = Math.max(0, t[vista].alto - VIEWPORT_TESTIGO[vista].alto);
      const actual = Math.min(opciones.scroll[vista] || 0, max);
      cambiarOpciones({ scroll: { [vista]: Math.round(Math.min(Math.max(actual + e.deltaY, 0), max)) } });
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function irAEspacio(dev, esp) {
    setVista(dev);
    setSel(esp.id);
    const vp = VIEWPORT_TESTIGO[dev];
    const max = Math.max(0, t[dev].alto - vp.alto);
    cambiarOpciones({ scroll: { [dev]: Math.round(Math.min(Math.max(esp.y - (vp.alto - esp.h) / 2, 0), max)) } });
  }

  function agregarEspacio() {
    const dev = vista === "lamina" ? "desktop" : vista;
    const [w, h] = nuevoTamano.split("x").map(Number);
    const meta = t[dev];
    const vp = VIEWPORT_TESTIGO[dev];
    const scroll = datosDev(dev).scroll;
    const nuevo = {
      id: `${dev[0]}m${Date.now().toString(36)}`,
      w,
      h,
      x: Math.round(Math.max(0, (vp.ancho - w) / 2)),
      y: Math.round(Math.min(Math.max(scroll + (vp.alto - h) / 2, 0), Math.max(0, meta.alto - h))),
      origen: "manual",
    };
    cambiarEspacios(dev, [...meta.espacios, nuevo]);
    const c = t.creativos.find((k) => k.ancho === w && k.alto === h);
    if (c) asignar(nuevo.id, c.id);
    setVista(dev);
    setSel(nuevo.id);
    setAviso(`Espacio ${w}×${h} agregado en ${dev}. Arrástralo hasta donde va.`);
  }

  function quitarEspacio(dev, espId) {
    cambiarEspacios(
      dev,
      t[dev].espacios.filter((e) => e.id !== espId)
    );
    if (sel === espId) setSel(null);
  }

  async function subir(files) {
    const lista = [...files].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.name));
    if (!lista.length) {
      setError("Solo se aceptan imágenes JPG, PNG, GIF o WebP.");
      return;
    }
    setError("");
    const errores = [];
    let ultimo = null;
    setSubiendo(lista.length);
    await guardarYa();
    for (const f of lista) {
      try {
        ultimo = (await subirCreativo(id, f)).testigo;
      } catch (err) {
        errores.push(err.message);
      }
      setSubiendo((n) => n - 1);
    }
    if (ultimo) setT(ultimo);
    if (errores.length) setError(errores.join(" "));
    else setAviso(`${lista.length === 1 ? "Creatividad cargada" : `${lista.length} creatividades cargadas`} y colocadas en sus espacios.`);
  }

  async function quitarCreativo(c) {
    await guardarYa();
    try {
      const r = await apiFetch(`${API}/${id}/creativos/${c.id}`, { method: "DELETE" });
      setT(r.testigo);
    } catch (err) {
      setError(err.message);
    }
  }

  async function recapturar() {
    await guardarYa();
    try {
      const r = await apiFetch(`${API}/${id}/capturar`, { method: "POST" });
      setT(r.testigo);
      setCapturas({});
      setSel(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function duplicar(e) {
    e.preventDefault();
    await guardarYa();
    try {
      const r = await apiFetch(`${API}/${id}/duplicar`, { method: "POST", body: JSON.stringify({ url: otraUrl }) });
      setOtraUrl("");
      setMostrarOtra(false);
      navigate(`/admin/preview-testigos/${r.testigo.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function descargar(cual) {
    await cargarFuentes();
    const hechos = [];
    const dev = (d) => renderDispositivo(d, datosDev(d)).canvas;
    for (const v of cual === "todo" ? ["desktop", "mobile", "lamina"] : [cual]) {
      if (v !== "lamina" && (!t[v] || !capturas[v])) continue;
      const canvas =
        v === "lamina"
          ? renderLamina({
              desktop: t.desktop && capturas.desktop ? dev("desktop") : null,
              mobile: t.mobile && capturas.mobile ? dev("mobile") : null,
              campana: t.nombre,
              cliente: t.cliente_nombre,
              url: t.url,
              fecha: fechaLima(t.capturado_at),
            })
          : dev(v);
      await descargarCanvas(canvas, nombreArchivo(t, v));
      hechos.push(v);
    }
    setAviso(`Descargado: ${hechos.join(", ")}.`);
  }

  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(""), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  if (error && !t) {
    return (
      <div className="max-w-3xl">
        <Link to="/admin/preview-testigos" className="text-sm text-gray-500 hover:text-gray-900">
          ← Preview Testigos
        </Link>
        <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const vp = VIEWPORT_TESTIGO[vista === "lamina" ? "desktop" : vista];
  const maxScroll = vista !== "lamina" && t[vista] ? Math.max(0, t[vista].alto - vp.alto) : 0;
  const scrollActual = vista !== "lamina" ? Math.min(opciones.scroll[vista] || 0, maxScroll) : 0;
  const nEspacios = (t.desktop?.espacios.length || 0) + (t.mobile?.espacios.length || 0);
  const nConCreativo = ["desktop", "mobile"].reduce(
    (n, d) => n + (t[d]?.espacios || []).filter((e) => t.creativos.some((c) => c.id === t.asignaciones[e.id])).length,
    0
  );

  return (
    <div className="max-w-[1500px]">
      <Link to="/admin/preview-testigos" className="text-sm text-gray-500 hover:text-gray-900">
        ← Preview Testigos
      </Link>
      <div className="mt-2 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="label-mono text-gray-400">{[t.cliente_nombre, hostDe(t.url)].filter(Boolean).join(" · ")}</div>
          <h1 className="font-display font-medium text-gray-900 text-[26px] md:text-[30px] leading-tight tracking-tight break-words">{t.nombre}</h1>
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-brand-magenta break-all">
            {t.url}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnClass} onClick={recapturar} disabled={t.estado === "capturando"}>
            Volver a capturar
          </button>
          <button type="button" className={btnClass} onClick={() => setMostrarOtra((v) => !v)}>
            Usar en otra URL
          </button>
        </div>
      </div>

      {mostrarOtra && (
        <Card className="p-4 mb-4" hover={false}>
          <form onSubmit={duplicar} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label htmlFor="pt-otra" className="block text-xs text-gray-500 mb-1">
                Mismas creatividades, otro medio
              </label>
              <input
                id="pt-otra"
                type="url"
                required
                className={inputClass}
                placeholder="https://www.otro-medio.com/nota"
                value={otraUrl}
                onChange={(e) => setOtraUrl(e.target.value)}
              />
            </div>
            <button type="submit" className={btnPrimario}>
              Capturar
            </button>
          </form>
        </Card>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="text-xs underline shrink-0" onClick={() => setError("")}>
            Cerrar
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] items-start">
        {/* Panel izquierdo */}
        <Card className="divide-y divide-line" hover={false}>
          <section className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-gray-900">Creatividades</h2>
              <span className="label-mono !text-[10.5px] text-gray-400">{t.creativos.length} cargadas</span>
            </div>
            <label
              htmlFor="pt-file"
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(true);
              }}
              onDragLeave={() => setSobre(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(false);
                subir(e.dataTransfer.files);
              }}
              className={`block cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors ${
                sobre ? "border-brand-magenta bg-brand-magenta/10" : "border-slate-300 hover:border-brand-magenta"
              }`}
            >
              {subiendo > 0 ? (
                <span className="text-brand-magenta">Subiendo {subiendo}…</span>
              ) : (
                <>
                  <span className="text-gray-900 font-medium">Arrastra los banners aquí</span>
                  <span className="text-gray-500"> o haz clic para elegir.</span>
                  <br />
                  <span className="text-gray-500">JPG, PNG, GIF o WebP · el tamaño se reconoce solo</span>
                </>
              )}
              <input
                ref={fileRef}
                id="pt-file"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  subir(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1">
              {FORMATOS_TESTIGO.map((f) => {
                const hay = t.creativos.some((c) => c.ancho === f.ancho && c.alto === f.alto);
                return (
                  <span
                    key={`${f.ancho}x${f.alto}`}
                    title={f.dispositivo}
                    className={`font-mono text-[10.5px] rounded border px-1.5 ${hay ? "border-green-600/40 text-green-600" : "border-slate-200 text-gray-400"}`}
                  >
                    {f.ancho}×{f.alto}
                  </span>
                );
              })}
            </div>
            {t.creativos.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {t.creativos.map((c) => (
                  <li key={c.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-line bg-gray-50 p-1.5">
                    <div className="h-9 w-[52px] rounded bg-ink-deep border border-line overflow-hidden flex items-center justify-center">
                      <img src={`${API}/${t.id}/creativos/${c.id}`} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-gray-900" title={c.nombre}>
                        {c.nombre}
                      </div>
                      <div className="font-mono text-[10.5px] text-green-600">
                        {c.ancho}×{c.alto}
                        {c.ancho_px !== c.ancho ? " @2x" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarCreativo(c)}
                      className="rounded px-2 py-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      aria-label={`Quitar ${c.nombre}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-gray-900">Espacios</h2>
              <span className="label-mono !text-[10.5px] text-gray-400">
                {nConCreativo} de {nEspacios} con creatividad
              </span>
            </div>
            {t.estado !== "listo" && <p className="text-xs text-gray-500">Aparecen cuando termina la captura.</p>}
            {t.estado === "listo" &&
              ["desktop", "mobile"].map((dev) => (
                <div key={dev} className="mb-3 last:mb-0">
                  <div className="label-mono !text-[10px] text-gray-400 mb-1.5">{dev === "desktop" ? "Desktop" : "Mobile"}</div>
                  {(t[dev]?.espacios || []).length === 0 && (
                    <p className="text-xs text-gray-500 mb-1">No se encontraron espacios. Agrégalos a mano abajo.</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {(t[dev]?.espacios || []).map((e) => {
                      const ops = t.creativos.filter((c) => c.ancho === e.w && c.alto === e.h);
                      const valor = ops.some((c) => c.id === t.asignaciones[e.id]) ? String(t.asignaciones[e.id]) : "";
                      return (
                        <div
                          key={e.id}
                          className={`rounded-lg border bg-gray-50 p-2 ${sel === e.id && vista === dev ? "border-brand-magenta" : "border-line"}`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => irAEspacio(dev, e)}
                              className="font-mono text-xs text-gray-900 hover:text-brand-magenta"
                              title="Ver en la captura"
                            >
                              {e.w}×{e.h}
                            </button>
                            <span className="text-[11px] text-gray-500">{e.origen === "manual" ? "agregado a mano" : "detectado"}</span>
                            <button
                              type="button"
                              onClick={() => quitarEspacio(dev, e.id)}
                              className="ml-auto text-[11px] text-gray-400 hover:text-red-600"
                            >
                              Quitar
                            </button>
                          </div>
                          <select
                            aria-label={`Creatividad para el espacio ${e.w}×${e.h}`}
                            className={`${inputClass} !py-1 mt-1.5 !text-xs`}
                            value={valor}
                            onChange={(ev) => asignar(e.id, ev.target.value ? Number(ev.target.value) : null)}
                          >
                            <option value="">Dejar el anuncio del medio</option>
                            {ops.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            {t.estado === "listo" && (
              <div className="mt-3 flex gap-2">
                <select aria-label="Tamaño del espacio a agregar" className={`${inputClass} !py-1.5`} value={nuevoTamano} onChange={(e) => setNuevoTamano(e.target.value)}>
                  {FORMATOS_TESTIGO.map((f) => (
                    <option key={`${f.ancho}x${f.alto}`} value={`${f.ancho}x${f.alto}`}>
                      {f.ancho}×{f.alto}
                    </option>
                  ))}
                </select>
                <button type="button" className={`${btnClass} shrink-0`} onClick={agregarEspacio}>
                  + Agregar en {vista === "mobile" ? "mobile" : "desktop"}
                </button>
              </div>
            )}
          </section>
        </Card>

        {/* Lienzo */}
        <Card className="overflow-hidden min-w-0" hover={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5">
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="tablist">
              {[
                ["desktop", "Desktop"],
                ["mobile", "Mobile"],
                ["lamina", "Lámina 16:9"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={vista === v}
                  onClick={() => setVista(v)}
                  className={`px-3 py-1.5 text-sm ${vista === v ? "bg-gray-100 text-gray-900 shadow-[inset_0_-2px_0_var(--color-brand-magenta)]" : "text-gray-500 hover:text-gray-900"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="accent-brand-magenta" checked={opciones.marco} onChange={(e) => cambiarOpciones({ marco: e.target.checked })} />
              Marco
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="accent-brand-magenta" checked={opciones.sello} onChange={(e) => cambiarOpciones({ sello: e.target.checked })} />
              Sello de medio y fecha
            </label>
          </div>

          <div
            className="relative flex justify-center bg-ink-deep p-4 md:p-6 min-h-[360px]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent 0 23px,rgba(255,255,255,.025) 23px 24px),repeating-linear-gradient(90deg,transparent 0 23px,rgba(255,255,255,.025) 23px 24px)",
            }}
          >
            {t.estado === "capturando" && (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-24">
                <Spinner />
                <div className="label-mono text-brand-magenta">Capturando desktop y mobile</div>
                <p className="text-xs text-gray-500 max-w-xs">
                  {t.posicion_cola > 0
                    ? `Hay ${t.posicion_cola} captura${t.posicion_cola > 1 ? "s" : ""} antes. `
                    : ""}
                  Tarda entre 30 y 60 segundos. Mientras tanto puedes ir subiendo las creatividades.
                </p>
              </div>
            )}
            {t.estado === "error" && (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-24 max-w-md">
                <div className="label-mono text-semaphore-orange">No se pudo capturar</div>
                <p className="text-sm text-gray-600">{t.error}</p>
                <button type="button" className={btnPrimario} onClick={recapturar}>
                  Volver a capturar
                </button>
              </div>
            )}
            {t.estado === "listo" && (
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => (arrastre.current = null)}
                aria-label="Vista previa del testigo. Clic en un espacio para cambiar la creatividad; arrastra para moverlo."
                className={`block h-auto rounded shadow-xl touch-none ${vista === "lamina" ? "cursor-default" : "cursor-pointer"}`}
                style={{ maxWidth: "100%", maxHeight: vista === "mobile" ? 760 : undefined }}
              />
            )}
          </div>

          {t.estado === "listo" && vista !== "lamina" && (
            <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-xs text-gray-500">
              <span>Desplazar</span>
              <input
                type="range"
                aria-label="Posición vertical de la captura"
                className="flex-1 accent-brand-magenta"
                min={0}
                max={maxScroll}
                step={10}
                value={scrollActual}
                onChange={(e) => cambiarOpciones({ scroll: { [vista]: Number(e.target.value) } })}
              />
              <span className="tabular-nums w-16 text-right">{scrollActual === 0 ? "arriba" : `${scrollActual} px`}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <span className="basis-full lg:basis-0 lg:flex-1 text-xs text-gray-500 min-w-0" aria-live="polite">
              {aviso ||
                (vista === "lamina"
                  ? "Desktop y mobile juntos, listos para la PPT. Ajusta cada uno en su pestaña."
                  : "Clic en un espacio para cambiar la creatividad. Arrástralo para moverlo. Rueda del mouse para desplazar.")}
            </span>
            <button type="button" className={btnClass} disabled={t.estado !== "listo"} onClick={() => descargar(vista)}>
              Descargar PNG
            </button>
            <button type="button" className={btnPrimario} disabled={t.estado !== "listo"} onClick={() => descargar("todo")}>
              Descargar los 3
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
