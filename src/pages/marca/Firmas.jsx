import { useEffect, useMemo, useState } from "react";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import { useAuth } from "../../context/AuthContext";
import { firmaHtml, FIRMA_TEMAS } from "../../../shared/firma";
import { dibujarFirma, firmaImagenUrl } from "../../../shared/firmaPng";
import { gestionaFirmas, paisFirmasManager } from "../../../shared/marca";

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

// Las dos versiones se ofrecen juntas y cada persona elige cuál usar
// (pedido de Jose 2026-10-24): la oscura es el bloque Ink del manual, la
// clara se integra al cuerpo blanco del correo.
const VERSIONES = {
  oscuro: { label: "Oscura", nota: "Bloque oscuro del manual de marca, resalta sobre el correo." },
  claro: { label: "Clara", nota: "Fondo blanco con borde fino, se integra al correo." },
};

// Nombre de archivo a partir del nombre de la persona: "Yván Ackerman" -> "firma-yvan-ackerman".
function nombreArchivo(nombre) {
  const slug = String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `firma-${slug || "mediaudience"}`;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// La composición vive en shared/firmaPng.js, compartida con la imagen pública
// que sirve el backend: el PNG descargado y el de la URL de Gmail son iguales.
async function firmaPng(datos, tema) {
  await document.fonts.ready;
  const [isotipo, wordmark] = await Promise.all([
    cargarImagen(`/firma/isotipo-${tema}.png`),
    cargarImagen(`/firma/wordmark-${tema}.png`),
  ]);
  const crearCanvas = (width, height) => Object.assign(document.createElement("canvas"), { width, height });
  const canvas = dibujarFirma({ datos, tema, crearCanvas, isotipo, wordmark });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Copia como HTML enriquecido para pegar directo en Gmail/Outlook. Si el
// navegador no soporta ClipboardItem, cae al viejo execCommand sobre un nodo
// con la firma renderizada (mismo resultado al pegar).
async function copiarHtml(html, textoPlano) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([textoPlano], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // sigue al fallback
    }
  }
  const nodo = document.createElement("div");
  nodo.innerHTML = html;
  nodo.style.position = "fixed";
  nodo.style.left = "-9999px";
  document.body.appendChild(nodo);
  const rango = document.createRange();
  rango.selectNode(nodo);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(rango);
  const ok = document.execCommand("copy");
  sel.removeAllRanges();
  nodo.remove();
  if (!ok) throw new Error("No se pudo copiar. Usa \"Descargar HTML\".");
}

const CAMPOS = [
  { key: "nombre", label: "Nombre y apellido", placeholder: "Ej. Yván Ackerman", required: true },
  { key: "cargo", label: "Cargo", placeholder: "Ej. Director General" },
  { key: "email", label: "Correo", placeholder: "nombre@mediaudience.com", type: "email", required: true },
  { key: "telefono", label: "Teléfono", placeholder: "Ej. +593 99 123 4567", type: "tel" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta";

const VACIA = { nombre: "", cargo: "", telefono: "", email: "", pais: "" };

function formatoFecha(iso) {
  // updated_at viene en UTC de SQLite ("2026-10-24 15:30:00").
  return new Date(`${iso.replace(" ", "T")}Z`).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Firmas() {
  const { user } = useAuth();
  // Registro de firmas: Admin, Super Admin y Manager de país.
  const esStaff = gestionaFirmas(user);
  const [datos, setDatos] = useState(null);
  // Qué ficha muestra el formulario: la propia, una nueva (solo staff) o una
  // del registro que se está editando (solo staff).
  const [modo, setModo] = useState({ tipo: "mia" });
  const [registro, setRegistro] = useState([]);
  const [paises, setPaises] = useState([]);
  const [error, setError] = useState("");
  // Manager de país: las fichas que crea o edita del registro quedan fijas
  // en su país (el backend lo fuerza igual).
  const paisFijo = paises.find((p) => p.codigo === paisFirmasManager(user))?.nombre || "";
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");

  async function cargarRegistro() {
    const res = await apiFetch("/api/marca/firmas");
    setRegistro(res.firmas);
  }

  useEffect(() => {
    Promise.all([apiFetch("/api/marca/firma"), apiFetch("/api/marca/paises")])
      .then(([f, p]) => {
        setDatos(f.firma);
        setPaises(p.paises.filter((x) => x.codigo !== "GLOBAL"));
      })
      .catch((err) => setError(err.message));
    if (esStaff) cargarRegistro().catch((err) => setError(err.message));
  }, [esStaff]);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(id);
  }, [aviso]);

  const html = useMemo(
    () =>
      Object.fromEntries(
        FIRMA_TEMAS.map((tema) => [tema, datos ? firmaHtml({ ...datos, tema, baseUrl: window.location.origin }) : ""])
      ),
    [datos]
  );

  if (!datos) {
    return error ? (
      <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    ) : (
      <Spinner label="Cargando..." />
    );
  }

  const set = (key) => (e) => setDatos((d) => ({ ...d, [key]: e.target.value }));
  const listo = datos.nombre.trim().length > 0 && datos.email.trim().length > 0;

  // Guarda la ficha que está en el formulario donde corresponde según el
  // modo. Una "nueva" pasa a "editar" apenas se crea, para que el siguiente
  // guardado no intente crearla otra vez.
  async function guardar() {
    const body = JSON.stringify(datos);
    let res;
    if (modo.tipo === "mia") res = await apiFetch("/api/marca/firma", { method: "PUT", body });
    else if (modo.tipo === "nueva") res = await apiFetch("/api/marca/firmas", { method: "POST", body });
    else res = await apiFetch(`/api/marca/firmas/${modo.id}`, { method: "PUT", body });
    if (modo.tipo === "nueva") setModo({ tipo: "editar", id: res.firma.id });
    setDatos((d) => ({ ...d, token: res.firma.token }));
    if (esStaff) await cargarRegistro();
    return res.firma;
  }

  async function guardarManual() {
    if (!listo) {
      setError("Completa al menos el nombre y el correo.");
      return;
    }
    setError("");
    setOcupado("guardar");
    try {
      await guardar();
      setAviso("Firma guardada en el registro.");
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado("");
    }
  }

  async function verMia() {
    setError("");
    setModo({ tipo: "mia" });
    setDatos((await apiFetch("/api/marca/firma")).firma);
  }

  function nueva() {
    setError("");
    setModo({ tipo: "nueva" });
    setDatos({ ...VACIA, pais: paisFijo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editar(f) {
    setError("");
    // La propia se edita como "Mi firma" para que siga ligada al usuario.
    setModo(f.user_id === user.id ? { tipo: "mia" } : { tipo: "editar", id: f.id });
    setDatos({ nombre: f.nombre, cargo: f.cargo || "", telefono: f.telefono || "", email: f.email, pais: f.pais || "", token: f.token });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrar(f) {
    if (!window.confirm(`¿Eliminar la firma de ${f.nombre}? Sale del registro y su URL de imagen deja de funcionar: si alguien la usa en Gmail, se verá rota.`)) return;
    setError("");
    try {
      await apiFetch(`/api/marca/firmas/${f.id}`, { method: "DELETE" });
      if (modo.tipo === "editar" && modo.id === f.id) await verMia();
      else if (f.user_id === user.id) await verMia();
      await cargarRegistro();
      setAviso(`Firma de ${f.nombre} eliminada.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copiarUrl(url, etiqueta) {
    try {
      await navigator.clipboard.writeText(url);
      setAviso(`URL ${etiqueta} copiada. En Gmail: Insertar imagen → Dirección web (URL).`);
    } catch {
      setError("No se pudo copiar. Selecciona la URL y cópiala a mano.");
    }
  }

  const tituloForm =
    modo.tipo === "mia" ? "Tus datos" : modo.tipo === "nueva" ? "Nueva firma" : `Editando: ${datos.nombre || "firma"}`;

  async function accion(tipo, tema) {
    if (!listo) {
      setError("Completa al menos el nombre y el correo.");
      return;
    }
    setError("");
    setOcupado(`${tipo}-${tema}`);
    const sufijo = tema === "claro" ? "-clara" : "-oscura";
    const version = VERSIONES[tema].label.toLowerCase();
    try {
      if (tipo === "copiar") {
        const plano = [datos.nombre, datos.cargo, `Mediaudience ${datos.pais}`.trim(), datos.telefono, datos.email]
          .filter(Boolean)
          .join("\n");
        await copiarHtml(html[tema], plano);
        setAviso(`Firma ${version} copiada. Pégala en la configuración de tu correo (Ctrl+V / Cmd+V).`);
      } else if (tipo === "html") {
        const doc = `<!doctype html>\n<html><head><meta charset="utf-8"><title>Firma ${datos.nombre}</title></head><body>\n${html[tema]}\n</body></html>\n`;
        descargar(new Blob([doc], { type: "text/html" }), `${nombreArchivo(datos.nombre)}${sufijo}.html`);
        setAviso(`Firma ${version} descargada en HTML.`);
      } else if (tipo === "png") {
        descargar(await firmaPng(datos, tema), `${nombreArchivo(datos.nombre)}${sufijo}.png`);
        setAviso(`Firma ${version} descargada en PNG.`);
      }
      // La copia/descarga ya salió; si guardar falla (ej. correo repetido)
      // solo se avisa, sin deshacer lo que la persona ya tiene.
      await guardar().catch((err) => setError(`Se generó la firma, pero no se guardó en el registro: ${err.message}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="label-mono text-[10.5px] text-brand-purple mb-2">Línea gráfica · Signal</p>
        <h1 className="font-display font-medium text-gray-900 text-[28px] md:text-[34px] leading-tight tracking-tight">
          Firmas de correo
        </h1>
        <p className="mt-2 text-sm text-slate-label max-w-2xl">
          Completa tus datos y la firma se arma sola con la línea gráfica nueva. Cópiala y pégala en tu correo, o
          descárgala.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start">
        <Card className="p-6" hover={false}>
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="label-mono text-[10.5px] text-gray-500 truncate">{tituloForm}</h2>
            {modo.tipo !== "mia" ? (
              <button type="button" onClick={verMia} className="text-xs text-brand-purple hover:underline whitespace-nowrap">
                Volver a mi firma
              </button>
            ) : (
              esStaff && (
                <button type="button" onClick={nueva} className="text-xs text-brand-purple hover:underline whitespace-nowrap">
                  + Nueva firma
                </button>
              )
            )}
          </div>
          <div className="flex flex-col gap-3">
            {CAMPOS.map((c) => (
              <div key={c.key}>
                <label htmlFor={`firma-${c.key}`} className="block text-sm font-medium text-gray-700 mb-1.5">
                  {c.label}
                </label>
                <input
                  id={`firma-${c.key}`}
                  type={c.type || "text"}
                  required={c.required}
                  value={datos[c.key] ?? ""}
                  onChange={set(c.key)}
                  placeholder={c.placeholder}
                  maxLength={120}
                  className={inputClass}
                />
              </div>
            ))}
            <div>
              <label htmlFor="firma-pais" className="block text-sm font-medium text-gray-700 mb-1.5">
                País
              </label>
              <select
                id="firma-pais"
                value={datos.pais ?? ""}
                onChange={set("pais")}
                disabled={!!paisFijo && modo.tipo !== "mia"}
                className={inputClass}
              >
                <option value="">Sin país (solo "Mediaudience")</option>
                {/* Latam = corporativo regional, no es un país del catálogo. */}
                <option value="Latam">Latam (corporativo)</option>
                {paises.map((p) => (
                  <option key={p.codigo} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={guardarManual}
                disabled={!!ocupado}
                className="w-full bg-brand-magenta text-on-accent text-sm font-medium px-5 py-2.5 rounded-md hover:bg-brand-magenta/90 disabled:opacity-60"
              >
                {ocupado === "guardar" ? "Guardando..." : "Guardar firma"}
              </button>
              <p className="mt-1.5 text-xs text-slate-label">
                También se guarda sola al copiar o descargar.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-6" hover={false}>
            <h2 className="label-mono text-[10.5px] text-gray-500 mb-1">Elige tu versión</h2>
            <p className="text-sm text-slate-label mb-5">Las dos son oficiales. Usa la que más te guste.</p>
            <div className="flex flex-col gap-6">
              {FIRMA_TEMAS.map((tema) => (
                <section key={tema} aria-label={`Versión ${VERSIONES[tema].label}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2.5">
                    <h3 className="font-display font-semibold text-gray-900">{VERSIONES[tema].label}</h3>
                    <p className="text-xs text-slate-label">{VERSIONES[tema].nota}</p>
                  </div>
                  {/* Simula el cuerpo de un correo (blanco, como lo ve casi
                      todo el mundo) para juzgar la firma en su contexto real. */}
                  <div className="rounded-md bg-[#ffffff] p-6 overflow-x-auto">
                    <p style={{ font: "14px Arial, sans-serif", color: "#3c4043", margin: "0 0 16px" }}>Saludos,</p>
                    <div dangerouslySetInnerHTML={{ __html: html[tema] }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => accion("copiar", tema)}
                      disabled={!!ocupado}
                      className="bg-brand-magenta text-on-accent text-sm font-medium px-5 py-2.5 rounded-md hover:bg-brand-magenta/90 disabled:opacity-60"
                    >
                      {ocupado === `copiar-${tema}` ? "Copiando..." : "Copiar firma"}
                    </button>
                    <button
                      type="button"
                      onClick={() => accion("html", tema)}
                      disabled={!!ocupado}
                      className="text-sm font-medium px-5 py-2.5 rounded-md border border-line text-gray-800 hover:border-brand-purple/50 disabled:opacity-60"
                    >
                      Descargar HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => accion("png", tema)}
                      disabled={!!ocupado}
                      className="text-sm font-medium px-5 py-2.5 rounded-md border border-line text-gray-800 hover:border-brand-purple/50 disabled:opacity-60"
                    >
                      {ocupado === `png-${tema}` ? "Generando..." : "Descargar PNG"}
                    </button>
                  </div>
                  <div className="mt-3">
                    <label htmlFor={`firma-url-${tema}`} className="block text-xs font-medium text-gray-700 mb-1">
                      URL de la imagen para Gmail
                    </label>
                    {datos.token ? (
                      <div className="flex gap-2">
                        <input
                          id={`firma-url-${tema}`}
                          readOnly
                          value={firmaImagenUrl(window.location.origin, datos.token, tema)}
                          onFocus={(e) => e.target.select()}
                          className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-mono text-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => copiarUrl(firmaImagenUrl(window.location.origin, datos.token, tema), VERSIONES[tema].label.toLowerCase())}
                          className="text-sm font-medium px-4 py-2 rounded-md border border-line text-gray-800 hover:border-brand-purple/50 whitespace-nowrap"
                        >
                          Copiar URL
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-label">Guarda la firma para obtener su URL.</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
            <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-green-600">
              {aviso}
            </p>
          </Card>

          <Card className="p-6" hover={false}>
            <h2 className="label-mono text-[10.5px] text-gray-500 mb-4">Cómo instalarla</h2>
            <div className="grid gap-5 md:grid-cols-2 text-sm text-gray-700">
              <div>
                <h3 className="font-display font-semibold text-gray-900 mb-2">Gmail</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Toca <b>Copiar firma</b>.</li>
                  <li>En Gmail: engranaje → <b>Ver todos los ajustes</b>.</li>
                  <li>Pestaña <b>General</b> → sección <b>Firma</b> → <b>Crear</b>.</li>
                  <li>Pega con Ctrl+V (Cmd+V en Mac).</li>
                  <li>Baja hasta el final y toca <b>Guardar cambios</b>.</li>
                </ol>
              </div>
              <div className="md:col-span-2">
                <h3 className="font-display font-semibold text-gray-900 mb-2">Gmail con la URL de imagen</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Toca <b>Copiar URL</b> en la versión que prefieras.</li>
                  <li>En Gmail: engranaje → <b>Ver todos los ajustes</b> → <b>General</b> → <b>Firma</b> → <b>Crear</b>.</li>
                  <li>En la barra de la firma, toca el ícono <b>Insertar imagen</b> → pestaña <b>Dirección web (URL)</b>.</li>
                  <li>Pega la URL y toca <b>Seleccionar</b>. La imagen ya viene al tamaño justo para el correo.</li>
                  <li>Baja hasta el final y toca <b>Guardar cambios</b>.</li>
                </ol>
                <p className="mt-2 text-xs text-slate-label">
                  La imagen muestra la última versión guardada de la firma. Si cambias tus datos, la URL sigue siendo la
                  misma y la imagen se actualiza sola (Gmail puede tardar un rato en mostrar el cambio).
                </p>
              </div>
              <div>
                <h3 className="font-display font-semibold text-gray-900 mb-2">Outlook</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Toca <b>Copiar firma</b>.</li>
                  <li>
                    Web: <b>Configuración → Cuentas → Firmas</b>. Escritorio: <b>Archivo → Opciones → Correo → Firmas</b>.
                  </li>
                  <li>Crea una firma nueva y pega con Ctrl+V.</li>
                  <li>Guarda y elígela como predeterminada.</li>
                </ol>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-label">
              Con <b>Copiar firma</b> el correo y el teléfono quedan como enlaces y el texto se ve nítido. La imagen
              (URL o PNG) es la alternativa cuando pegar no funciona: no tiene enlaces y algunos filtros marcan como
              spam los correos con solo una imagen de firma.
            </p>
          </Card>
        </div>
      </div>

      {esStaff && (
        <Card className="mt-6 overflow-hidden" hover={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-line">
            <div>
              <h2 className="label-mono text-[10.5px] text-gray-500">
                Firmas registradas <span className="text-gray-400">· {registro.length}</span>
              </h2>
              <p className="mt-1 text-xs text-slate-label">Solo lo ven Admin y Super Admin.</p>
            </div>
            <button
              type="button"
              onClick={nueva}
              className="bg-brand-magenta text-on-accent text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-magenta/90"
            >
              + Nueva firma
            </button>
          </div>
          {registro.length === 0 ? (
            <p className="p-5 text-sm text-slate-label">Todavía no hay firmas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-surface-2 text-gray-500 text-left label-mono">
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Cargo</th>
                    <th className="px-4 py-3 font-semibold">País</th>
                    <th className="px-4 py-3 font-semibold">Correo</th>
                    <th className="px-4 py-3 font-semibold">URL para Gmail</th>
                    <th className="px-4 py-3 font-semibold">Última edición</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {registro.map((f, i) => {
                    const activa = (modo.tipo === "editar" && modo.id === f.id) || (modo.tipo === "mia" && f.user_id === user.id);
                    return (
                      <tr
                        key={f.id}
                        className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"} ${activa ? "shadow-[inset_2px_0_0_#58b0ff]" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-gray-900 font-medium">{f.nombre}</td>
                        <td className="px-4 py-2.5 text-gray-700">{f.cargo || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-700">{f.pais || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-700">{f.email}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {FIRMA_TEMAS.map((tema) => (
                            <button
                              key={tema}
                              type="button"
                              onClick={() => copiarUrl(firmaImagenUrl(window.location.origin, f.token, tema), `${VERSIONES[tema].label.toLowerCase()} de ${f.nombre}`)}
                              title={firmaImagenUrl(window.location.origin, f.token, tema)}
                              className="text-xs font-medium px-2.5 py-1 mr-1.5 rounded border border-line text-gray-700 hover:border-brand-purple/50"
                            >
                              {VERSIONES[tema].label}
                            </button>
                          ))}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">
                          {formatoFecha(f.updated_at)}
                          {f.actualizado_por_nombre && <span className="block text-gray-500">por {f.actualizado_por_nombre}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button type="button" onClick={() => editar(f)} className="text-brand-purple hover:underline text-sm font-medium mr-4">
                            Editar
                          </button>
                          <button type="button" onClick={() => borrar(f)} className="text-gray-500 hover:text-red-600 text-sm">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
