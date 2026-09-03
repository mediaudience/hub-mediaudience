// Si el valor (viene de un Sheet o de un formulario editable, ej. nombre de
// contacto en Prospección) empieza con uno de estos caracteres, Excel/Sheets
// puede interpretarlo como fórmula al abrir el CSV exportado -- se antepone
// un apóstrofe para forzarlo a texto plano (mitigación estándar de CSV/Formula
// Injection).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function toCSVValue(value) {
  let str = String(value ?? "");
  if (FORMULA_TRIGGER.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function normalizeColumns(rows, columns) {
  const cols = columns || Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
  return cols.map((c) => (typeof c === "string" ? { key: c, label: c } : c));
}

export function rowsToCSV(rows, columns) {
  const cols = normalizeColumns(rows, columns);
  const lines = [cols.map((c) => toCSVValue(c.label)).join(",")];
  rows.forEach((row) => lines.push(cols.map((c) => toCSVValue(row[c.key])).join(",")));
  return lines.join("\n");
}

export function sectionsToCSV(sections) {
  return sections
    .filter((s) => s.rows.length > 0)
    .map((s) => `${s.title}\n${rowsToCSV(s.rows, s.columns)}`)
    .join("\n\n");
}

function triggerDownload(filename, content) {
  // BOM UTF-8: sin esto, Excel abre el CSV asumiendo la codificación local
  // (no UTF-8) y las tildes/ñ se ven rotas. Con el BOM, Excel detecta UTF-8
  // solo con doble clic, sin pasar por el asistente de importación.
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename, rows, columns) {
  triggerDownload(filename, rowsToCSV(rows, columns));
}

export function downloadSectionsCSV(filename, sections) {
  triggerDownload(filename, sectionsToCSV(sections));
}
