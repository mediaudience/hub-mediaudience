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
  red: "#F44336",
  orange: "#FFA726",
  green: "#4CAF50",
};
