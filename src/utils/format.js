const numberFmt = new Intl.NumberFormat("es-EC");
const currencyFmt = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  return numberFmt.format(Math.round(value ?? 0));
}

// Métricas que son un promedio/ratio sin %, como Frecuencia (impresiones por
// usuario alcanzado): siempre con 2 decimales -- pedido de Jose 2026-11-18.
const decimalFmt = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatDecimal(value) {
  return decimalFmt.format(value ?? 0);
}

// Dólares explícitos ("US$ 60,00") para Performance -- pedido de Jose
// 2026-11-24: con solo "$" no quedaba claro que la inversión es en dólares.
export function formatUSD(value) {
  return `US$ ${decimalFmt.format(value ?? 0)}`;
}

export function formatCurrency(value) {
  return currencyFmt.format(value ?? 0);
}

export function formatPercent(value) {
  return `${(value ?? 0).toFixed(2)} %`;
}

export function progressTier(pct) {
  if (pct >= 90) return "green";
  if (pct >= 51) return "orange";
  return "red";
}

export const TIER_COLORS = {
  red: "#E4665B",
  orange: "#D8B650",
  green: "#3FDDB0",
};
