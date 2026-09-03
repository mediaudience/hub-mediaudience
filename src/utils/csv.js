import * as XLSX from "xlsx";

function normalizeColumns(rows, columns) {
  const cols = columns || Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
  return cols.map((c) => (typeof c === "string" ? { key: c, label: c } : c));
}

function buildWorksheet(rows, columns) {
  const cols = normalizeColumns(rows, columns);
  const data = rows.map((row) => {
    const record = {};
    cols.forEach((c) => {
      record[c.label] = row[c.key] ?? "";
    });
    return record;
  });
  const worksheet = XLSX.utils.json_to_sheet(data, { header: cols.map((c) => c.label) });
  // `width` ya viene definido en algunas columnas para la tabla en pantalla
  // (ver CampanasServidas.jsx) -- se reutiliza acá para que el .xlsx no
  // salga con todas las columnas apretadas al ancho por defecto.
  worksheet["!cols"] = cols.map((c) => ({ wch: c.width ?? Math.max(c.label.length, 10) }));
  return worksheet;
}

function triggerDownload(filename, workbook) {
  const name = filename.replace(/\.(csv|xlsx)$/i, "");
  XLSX.writeFile(workbook, `${name}.xlsx`);
}

export function downloadCSV(filename, rows, columns) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildWorksheet(rows, columns), "Datos");
  triggerDownload(filename, workbook);
}

export function downloadSectionsCSV(filename, sections) {
  const workbook = XLSX.utils.book_new();
  sections
    .filter((s) => s.rows.length > 0)
    .forEach((s) => {
      // Nombre de hoja de Excel: máximo 31 caracteres, sin \ / ? * [ ].
      const sheetName = s.title.replace(/[\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, buildWorksheet(s.rows, s.columns), sheetName);
    });
  triggerDownload(filename, workbook);
}
