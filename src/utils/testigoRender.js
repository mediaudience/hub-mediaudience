// Composición de los testigos de Admin > Preview Testigos, en canvas del
// navegador: captura del medio + creatividades encima de los espacios +
// marco de navegador / celular + sello de medio y fecha. Lo que se ve en
// pantalla es exactamente lo que se descarga.
import { VIEWPORT_TESTIGO } from "../../shared/previewTestigos";

export const BARRA_NAVEGADOR = 76; // px CSS
const BISEL = 18;
const BARRA_ESTADO = 44;

export function hostDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
}

// "24/11/2026 17:05 (Lima)". capturado_at viene en UTC de SQLite.
export function fechaLima(isoUtc) {
  const d = isoUtc ? new Date(`${isoUtc.replace(" ", "T")}Z`) : new Date();
  const f = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${f.replace(",", "")} (Lima)`;
}

function redondo(x, X, Y, W, H, r) {
  x.beginPath();
  x.roundRect(X, Y, W, H, r);
}

function espacioVacio(x, e) {
  x.save();
  x.fillStyle = "rgba(88,176,255,0.10)";
  x.fillRect(e.x, e.y, e.w, e.h);
  x.strokeStyle = "rgba(88,176,255,0.85)";
  x.setLineDash([6, 5]);
  x.lineWidth = 1.5;
  x.strokeRect(e.x + 0.75, e.y + 0.75, e.w - 1.5, e.h - 1.5);
  x.restore();
}

function sello(x, { url, fecha }, derecha, abajo, k) {
  const t = `${hostDe(url)}  ·  ${fecha}`;
  x.save();
  x.font = `500 ${12 * k}px "JetBrains Mono", ui-monospace, monospace`;
  const w = x.measureText(t).width + 22 * k;
  const h = 26 * k;
  x.fillStyle = "rgba(10,14,23,0.84)";
  redondo(x, derecha - w - 12 * k, abajo - h - 12 * k, w, h, 6 * k);
  x.fill();
  x.fillStyle = "#E9EDF6";
  x.textBaseline = "middle";
  x.fillText(t, derecha - w - 1 * k, abajo - h / 2 - 12 * k);
  x.restore();
}

function barraNavegador(x, ancho, url, titulo) {
  const H = BARRA_NAVEGADOR;
  x.fillStyle = "#DEE1E6";
  x.fillRect(0, 0, ancho, H);
  ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, i) => {
    x.fillStyle = c;
    x.beginPath();
    x.arc(22 + i * 18, 22, 6, 0, Math.PI * 2);
    x.fill();
  });
  x.fillStyle = "#FFFFFF";
  redondo(x, 82, 8, 250, 32, [8, 8, 0, 0]);
  x.fill();
  x.fillStyle = "#3C4043";
  x.font = '12px "IBM Plex Sans", Arial, sans-serif';
  x.textBaseline = "middle";
  let t = titulo || hostDe(url);
  while (t.length > 4 && x.measureText(t).width > 210) t = t.slice(0, -2);
  if (t !== (titulo || hostDe(url))) t += "…";
  x.fillText(t, 98, 25);
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 40, ancho, H - 40);
  x.fillStyle = "#F1F3F4";
  redondo(x, 96, 45, ancho - 192, 26, 13);
  x.fill();
  // candado
  x.strokeStyle = "#5F6368";
  x.lineWidth = 1.4;
  x.beginPath();
  x.arc(116, 55, 3.5, Math.PI, 0);
  x.stroke();
  x.fillStyle = "#5F6368";
  x.fillRect(111.5, 55, 9, 7);
  x.font = '13px "IBM Plex Sans", Arial, sans-serif';
  let u = String(url || "").replace(/^https?:\/\//, "");
  while (u.length > 10 && x.measureText(u).width > ancho - 260) u = u.slice(0, -2);
  x.fillText(u, 130, 58);
  x.fillStyle = "#DADCE0";
  x.fillRect(0, H - 1, ancho, 1);
}

// Página del medio con las creatividades pegadas, recortada al viewport.
// scroll = px CSS desde arriba. `seleccion`: id del espacio a resaltar
// (solo en pantalla, nunca en lo que se descarga).
function dibujarViewport(x, { captura, meta, scroll, creativos, asignaciones, mostrarVacios, seleccion }) {
  const vp = VIEWPORT_TESTIGO[meta === undefined ? "desktop" : meta.dispositivo];
  const s = meta.escala;
  const alto = Math.min(vp.alto, meta.alto);
  x.save();
  x.beginPath();
  x.rect(0, 0, vp.ancho, alto);
  x.clip();
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, vp.ancho, vp.alto);
  if (captura) x.drawImage(captura, 0, scroll * s, vp.ancho * s, alto * s, 0, 0, vp.ancho, alto);
  x.translate(0, -scroll);
  for (const e of meta.espacios || []) {
    if (e.y + e.h < scroll || e.y > scroll + alto) continue;
    const img = creativos.get(asignaciones[e.id]);
    if (img) x.drawImage(img, e.x, e.y, e.w, e.h);
    else if (mostrarVacios) espacioVacio(x, e);
    if (seleccion === e.id) {
      x.strokeStyle = "#58B0FF";
      x.lineWidth = 3;
      x.setLineDash([]);
      x.strokeRect(e.x - 2.5, e.y - 2.5, e.w + 5, e.h + 5);
    }
  }
  x.restore();
}

// Devuelve { canvas, origen: {x, y}, k } -- origen/k sirven para traducir un
// clic en el canvas a coordenadas de la página (arrastrar espacios).
export function renderDispositivo(dev, datos) {
  const { meta, marco } = datos;
  const vp = VIEWPORT_TESTIGO[dev];
  const k = meta.escala; // se dibuja a la resolución de la captura
  const m = { ...meta, dispositivo: dev };
  const alto = Math.min(vp.alto, meta.alto);
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  let ox = 0;
  let oy = 0;
  if (dev === "desktop") {
    oy = marco ? BARRA_NAVEGADOR : 0;
    c.width = vp.ancho * k;
    c.height = (alto + oy) * k;
    x.scale(k, k);
    if (marco) barraNavegador(x, vp.ancho, datos.url, datos.titulo);
    x.translate(0, oy);
    dibujarViewport(x, { ...datos, meta: m });
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (datos.sello) sello(x, datos, c.width, c.height, k);
  } else {
    const b = marco ? BISEL : 0;
    const be = marco ? BARRA_ESTADO : 0;
    ox = b;
    oy = b + be;
    c.width = (vp.ancho + b * 2) * k;
    c.height = (alto + b * 2 + be) * k;
    x.scale(k, k);
    if (marco) {
      x.fillStyle = "#1B1D22";
      redondo(x, 0, 0, vp.ancho + b * 2, alto + b * 2 + be, 54);
      x.fill();
      x.save();
      redondo(x, b, b, vp.ancho, alto + be, 40);
      x.clip();
      x.fillStyle = "#FFFFFF";
      x.fillRect(b, b, vp.ancho, be);
      x.fillStyle = "#111111";
      x.font = '600 15px "IBM Plex Sans", Arial, sans-serif';
      x.textBaseline = "middle";
      x.fillText("9:41", b + 30, b + 24);
      x.fillStyle = "#1B1D22";
      redondo(x, b + vp.ancho / 2 - 58, b + 9, 116, 30, 15);
      x.fill();
      x.fillStyle = "#111111";
      redondo(x, b + vp.ancho - 62, b + 18, 24, 12, 3);
      x.fill();
      x.translate(b, b + be);
      dibujarViewport(x, { ...datos, meta: m });
      x.restore();
    } else {
      dibujarViewport(x, { ...datos, meta: m });
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (datos.sello) sello(x, datos, c.width - b * k, c.height - b * k, k);
  }
  return { canvas: c, origen: { x: ox, y: oy }, k };
}

// Lámina 16:9 para pegar en la PPT del reporte: desktop + mobile sobre el
// fondo Signal, con campaña, medio y fecha.
export function renderLamina({ desktop, mobile, campana, cliente, url, fecha }) {
  const W = 1920;
  const H = 1080;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#0A0E17";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(255,255,255,0.035)";
  x.lineWidth = 1;
  for (let i = 0; i <= W; i += 48) {
    x.beginPath();
    x.moveTo(i + 0.5, 0);
    x.lineTo(i + 0.5, H);
    x.stroke();
  }
  for (let j = 0; j <= H; j += 48) {
    x.beginPath();
    x.moveTo(0, j + 0.5);
    x.lineTo(W, j + 0.5);
    x.stroke();
  }
  const M = 96;
  x.textBaseline = "alphabetic";
  x.fillStyle = "#58B0FF";
  x.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
  x.fillText(`TESTIGO  ·  ${hostDe(url).toUpperCase()}`, M, 104);
  x.fillStyle = "#E9EDF6";
  x.font = '600 44px "Space Grotesk", "IBM Plex Sans", sans-serif';
  let t = campana || "";
  while (t.length > 4 && x.measureText(t).width > 1300) t = t.slice(0, -2);
  x.fillText(t === campana ? t : `${t}…`, M, 162);
  x.fillStyle = "#8A93A9";
  x.font = '400 20px "IBM Plex Sans", sans-serif';
  x.fillText([cliente, fecha].filter(Boolean).join("  ·  "), M, 200);
  // logo
  x.font = '600 24px "Space Grotesk", sans-serif';
  const lw = x.measureText("mediaudience").width;
  x.fillStyle = "#E9EDF6";
  x.fillText("mediaudience", W - M - lw, 104);
  x.fillStyle = "#58B0FF";
  x.beginPath();
  x.arc(W - M - lw - 16, 96, 6, 0, Math.PI * 2);
  x.fill();

  const top = 256;
  const altoMax = H - top - 90;
  const gap = 64;
  const anchoUtil = W - M * 2;
  // escalas que llenan el ancho con ambos a la misma altura
  const dH = desktop ? desktop.height / desktop.width : 0;
  const mH = mobile ? mobile.height / mobile.width : 0;
  let hComun = altoMax;
  const anchoTotal = (h) => (desktop ? h / dH : 0) + (mobile ? h / mH : 0) + (desktop && mobile ? gap : 0);
  if (anchoTotal(hComun) > anchoUtil) hComun = (hComun * (anchoUtil - (desktop && mobile ? gap : 0))) / (anchoTotal(hComun) - (desktop && mobile ? gap : 0));
  const total = anchoTotal(hComun);
  let cx = (W - total) / 2;
  x.font = '500 15px "JetBrains Mono", ui-monospace, monospace';
  for (const [img, rel, etiqueta] of [
    [desktop, dH, "DESKTOP"],
    [mobile, mH, "MOBILE"],
  ]) {
    if (!img) continue;
    const w = hComun / rel;
    x.save();
    x.shadowColor = "rgba(0,0,0,0.5)";
    x.shadowBlur = 40;
    x.shadowOffsetY = 16;
    x.drawImage(img, cx, top, w, hComun);
    x.restore();
    x.fillStyle = "#7782A3";
    x.fillText(etiqueta, cx, top + hComun + 34);
    cx += w + gap;
  }
  return c;
}

export async function cargarFuentes() {
  if (!document.fonts?.load) return;
  await Promise.all(
    ['600 44px "Space Grotesk"', '400 20px "IBM Plex Sans"', '500 18px "JetBrains Mono"', '600 15px "IBM Plex Sans"'].map((f) =>
      document.fonts.load(f).catch(() => {})
    )
  );
}
