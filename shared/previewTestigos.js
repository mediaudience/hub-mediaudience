// Admin > Preview Testigos: formatos IAB que Raiza sube y que se buscan en la
// captura del medio. Compartido por el backend (detección, validación de
// creatividades) y el frontend (chips, agregar espacio a mano).
export const FORMATOS_TESTIGO = [
  { ancho: 970, alto: 250, dispositivo: "desktop" },
  { ancho: 728, alto: 90, dispositivo: "desktop" },
  { ancho: 300, alto: 600, dispositivo: "desktop" },
  { ancho: 160, alto: 600, dispositivo: "desktop" },
  { ancho: 300, alto: 250, dispositivo: "desktop + mobile" },
  { ancho: 320, alto: 100, dispositivo: "mobile" },
];

// Viewport con el que se captura cada dispositivo (px CSS). Mobile se saca a
// 2x para que se vea nítido en la lámina del reporte.
export const VIEWPORT_TESTIGO = {
  desktop: { ancho: 1366, alto: 768, escala: 1 },
  mobile: { ancho: 390, alto: 844, escala: 2 },
};

export const TESTIGO_MAX_MB = 5;

// Tamaño estándar de una creatividad: exacto o al doble (@2x, retina).
export function formatoDeCreatividad(ancho, alto) {
  for (const f of FORMATOS_TESTIGO) {
    if (f.ancho === ancho && f.alto === alto) return { ...f, retina: false };
    if (f.ancho * 2 === ancho && f.alto * 2 === alto) return { ...f, retina: true };
  }
  return null;
}
