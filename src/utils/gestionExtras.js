// Columnas nuevas del Sheet de Gestión que el sync guarda en `fila.extras`
// (ver scripts/syncGestionSheets.js) -- se agregan solas como columnas al
// final de la tabla, en el orden en que aparecen en el Sheet.
function titulo(h) {
  // Headers en MAYÚSCULAS ("ORDEN INTERNA") -> "Orden Interna", igual que el
  // resto de etiquetas de la tabla. Si vienen en mixto, se respetan.
  if (h !== h.toUpperCase()) return h;
  return h.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, l) => s + l.toUpperCase());
}

export function columnasExtras(filas, extra = {}) {
  const headers = [];
  for (const f of filas) {
    for (const h of Object.keys(f.extras ?? {})) if (!headers.includes(h)) headers.push(h);
  }
  return headers.map((h) => ({ key: `extra:${h}`, header: h, label: titulo(h), extra: true, ...extra }));
}

export function valorColumna(fila, c) {
  return c.extra ? fila.extras?.[c.header] ?? "" : fila[c.key];
}

export function filasParaDescarga(filas, columnas) {
  const extras = columnas.filter((c) => c.extra);
  if (extras.length === 0) return filas;
  return filas.map((f) => ({ ...f, ...Object.fromEntries(extras.map((c) => [c.key, valorColumna(f, c)])) }));
}
