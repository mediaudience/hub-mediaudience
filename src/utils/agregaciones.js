// Columnas numéricas/moneda se totalizan sumando. Porcentaje: si la columna
// declara `numeradorKey`/`denominadorKey` (mismo par que usa el KPI de esa
// pestaña, ver canalMetricas.js) se calcula el ratio real -- suma de
// numerador / suma de denominador -- para que el % de la fila de Total
// coincida siempre con el KPI de arriba. Solo cuando el dataset no trae esas
// columnas crudas (Geo, que no guarda Vistas/Clics por fila) se cae a un
// promedio simple del % ya calculado por el Sheet, que es lo único posible ahí.
export function calcularAgregado(col, rows) {
  if (col.type === "numero" || col.type === "moneda") {
    return rows.reduce((s, r) => s + (r[col.key] ?? 0), 0);
  }
  if (col.type === "porcentaje") {
    if (col.numeradorKey && col.denominadorKey) {
      const numerador = rows.reduce((s, r) => s + (r[col.numeradorKey] ?? 0), 0);
      const denominador = rows.reduce((s, r) => s + (r[col.denominadorKey] ?? 0), 0);
      return denominador > 0 ? Math.round((numerador / denominador) * 100) : 0;
    }
    return rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r[col.key] ?? 0), 0) / rows.length) : 0;
  }
  return null;
}
