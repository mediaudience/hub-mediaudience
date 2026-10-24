import { useEffect, useMemo, useState } from "react";
import Card from "../../components/common/Card";
import Spinner from "../../components/common/Spinner";
import { firmaHtml, FIRMA_TEMAS } from "../../../shared/firma";

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

// Versión imagen de la firma: misma composición que shared/firma.js, dibujada
// a mano en canvas (x2 para pantallas retina) con las fuentes de marca que el
// hub ya tiene cargadas. Es el respaldo para quien no puede pegar HTML.
const COLORES_PNG = {
  oscuro: { fondo: "#0A0E17", borde: "#1A2135", nombre: "#E9EDF6", texto: "#8A93A9", acento: "#58B0FF" },
  claro: { fondo: "#FFFFFF", borde: "#E9EDF6", nombre: "#0A0E17", texto: "#565E76", acento: "#1F74BF" },
};

async function firmaPng(datos, tema) {
  const c = COLORES_PNG[tema] || COLORES_PNG.oscuro;
  await document.fonts.ready;
  const [isotipo, wordmark] = await Promise.all([
    cargarImagen(`/firma/isotipo-${tema}.png`),
    cargarImagen(`/firma/wordmark-${tema}.png`),
  ]);
  const ESCALA = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fNombre = '600 18px "Space Grotesk", Arial, sans-serif';
  const fTexto = '400 13px "IBM Plex Sans", Arial, sans-serif';
  const fMono = '500 10px "JetBrains Mono", monospace';
  const CANALES = "CTV · MOBILE PUSH · PROGRAMMATIC · GAMING";

  const lineas = [
    datos.cargo && { t: datos.cargo, color: c.acento, font: '600 14px "IBM Plex Sans", Arial, sans-serif', alto: 22 },
    { t: datos.pais ? `Mediaudience ${datos.pais}` : "Mediaudience", color: c.texto },
    "gap",
    datos.telefono && { t: datos.telefono, color: c.nombre },
    datos.email && { t: datos.email, color: c.acento },
  ].filter(Boolean);

  const medir = (font, t, spacing = 0) => {
    ctx.font = font;
    ctx.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(t).width;
    ctx.letterSpacing = "0px";
    return w;
  };
  const xTexto = 20 + 56 + 18 + 1 + 18;
  const anchoTexto = Math.max(
    medir(fNombre, datos.nombre || ""),
    ...lineas.filter((l) => l !== "gap").map((l) => medir(l.font || fTexto, l.t))
  );
  const altoTexto = 24 + lineas.reduce((acc, l) => acc + (l === "gap" ? 8 : l.alto || 20), 0);
  const anchoPie = 20 + 106 + 24 + medir(fMono, CANALES, 1) + 24;
  const ancho = Math.ceil(Math.max(xTexto + anchoTexto + 24, anchoPie));
  const ySeparador = 20 + Math.max(altoTexto, 58) + 18;
  const alto = ySeparador + 1 + 12 + 20 + 14;

  canvas.width = ancho * ESCALA;
  canvas.height = alto * ESCALA;
  ctx.scale(ESCALA, ESCALA);
  ctx.textBaseline = "middle";

  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, ancho - 1, alto - 1, 10);
  ctx.fillStyle = c.fondo;
  ctx.fill();
  ctx.strokeStyle = c.borde;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.drawImage(isotipo, 20, 22, 56, 56);
  ctx.fillStyle = c.borde;
  ctx.fillRect(20 + 56 + 18, 20, 1, altoTexto);

  let y = 20;
  ctx.font = fNombre;
  ctx.fillStyle = c.nombre;
  ctx.fillText(datos.nombre || "", xTexto, y + 12);
  y += 24;
  ctx.font = fTexto;
  for (const l of lineas) {
    if (l === "gap") {
      y += 8;
      continue;
    }
    ctx.font = l.font || fTexto;
    ctx.fillStyle = l.color;
    ctx.fillText(l.t, xTexto, y + (l.alto || 20) / 2);
    y += l.alto || 20;
  }

  ctx.fillStyle = c.borde;
  ctx.fillRect(20, ySeparador, ancho - 44, 1);
  const yPie = ySeparador + 1 + 12;
  ctx.drawImage(wordmark, 20, yPie, 106, 20);
  ctx.font = fMono;
  ctx.letterSpacing = "1px";
  ctx.fillStyle = c.acento;
  ctx.textAlign = "right";
  ctx.fillText(CANALES, ancho - 24, yPie + 10);

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
  { key: "email", label: "Correo", placeholder: "nombre@mediaudience.com", type: "email" },
  { key: "telefono", label: "Teléfono", placeholder: "Ej. +593 99 123 4567", type: "tel" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta";

export default function Firmas() {
  const [datos, setDatos] = useState(null);
  const [paises, setPaises] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/marca/firma"), apiFetch("/api/marca/paises")])
      .then(([f, p]) => {
        setDatos(f.firma);
        setPaises(p.paises.filter((x) => x.codigo !== "GLOBAL"));
      })
      .catch((err) => setError(err.message));
  }, []);

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
  const listo = datos.nombre.trim().length > 0;

  // Guardar en segundo plano: que un fallo acá no frene la copia/descarga.
  const guardar = () =>
    apiFetch("/api/marca/firma", { method: "PUT", body: JSON.stringify(datos) }).catch(() => {});

  async function accion(tipo, tema) {
    if (!listo) {
      setError("Completa al menos tu nombre.");
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
      guardar();
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
          <h2 className="label-mono text-[10.5px] text-gray-500 mb-4">Tus datos</h2>
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
              <select id="firma-pais" value={datos.pais ?? ""} onChange={set("pais")} className={inputClass}>
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
              Recomendamos <b>Copiar firma</b>: el correo y el teléfono quedan como enlaces y el texto se ve nítido. El
              PNG es un respaldo; como firma de correo, una imagen sola no tiene enlaces y algunos filtros la marcan como
              spam.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
