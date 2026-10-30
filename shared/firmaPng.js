// Versión imagen de la firma: misma composición que shared/firma.js, dibujada
// a mano en canvas. La usan el navegador (Descargar PNG en Admin > Firmas) y
// el backend (URL pública que se pega en Gmail con "Insertar imagen"), así
// las dos salen idénticas.
//
// Tamaño: 1x, unos 500 px de ancho. Gmail muestra una imagen insertada por
// URL a su tamaño real, y la versión x2 que se usaba antes quedaba enorme en
// el correo (pedido de Jose 2026-10-30).

export const COLORES_PNG = {
  oscuro: { fondo: "#0A0E17", borde: "#1A2135", nombre: "#E9EDF6", texto: "#8A93A9", acento: "#58B0FF" },
  claro: { fondo: "#FFFFFF", borde: "#E9EDF6", nombre: "#0A0E17", texto: "#565E76", acento: "#1F74BF" },
};

const CANALES = "CTV · MOBILE PUSH · PROGRAMMATIC · GAMING";

// crearCanvas(ancho, alto) devuelve un canvas de ese tamaño en píxeles;
// isotipo y wordmark son las imágenes ya cargadas del tema.
export function dibujarFirma({ datos, tema, crearCanvas, isotipo, wordmark, escala = 1 }) {
  const c = COLORES_PNG[tema] || COLORES_PNG.oscuro;
  const medidor = crearCanvas(1, 1).getContext("2d");
  const fNombre = '600 18px "Space Grotesk", Arial, sans-serif';
  const fTexto = '400 13px "IBM Plex Sans", Arial, sans-serif';
  const fMono = '500 10px "JetBrains Mono", monospace';

  const lineas = [
    datos.cargo && { t: datos.cargo, color: c.acento, font: '600 14px "IBM Plex Sans", Arial, sans-serif', alto: 22 },
    { t: datos.pais ? `Mediaudience ${datos.pais}` : "Mediaudience", color: c.texto },
    "gap",
    datos.telefono && { t: datos.telefono, color: c.nombre },
    datos.email && { t: datos.email, color: c.acento },
  ].filter(Boolean);

  const medir = (font, t, spacing = 0) => {
    medidor.font = font;
    medidor.letterSpacing = `${spacing}px`;
    const w = medidor.measureText(t).width;
    medidor.letterSpacing = "0px";
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

  const canvas = crearCanvas(Math.round(ancho * escala), Math.round(alto * escala));
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);
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

  return canvas;
}

// URL pública de la imagen de una firma (la sirve server/firmaImagen.js).
export function firmaImagenUrl(baseUrl, token, tema) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/api/firma/${token}/${tema === "claro" ? "clara" : "oscura"}.png`;
}
