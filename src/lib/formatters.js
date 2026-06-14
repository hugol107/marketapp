export function tone(value) {
  const v = String(value).toLowerCase();

  if (
    v.includes("strong buy") ||
    v.includes("buy") ||
    v.includes("+") ||
    v.includes("bullish") ||
    v.includes("open")
  ) {
    return "positive";
  }

  if (
    v.includes("sell") ||
    v.includes("-") ||
    v.includes("bearish") ||
    v.includes("closed")
  ) {
    return "negative";
  }

  if (v.includes("hold")) return "neutral";

  return "neutral";
}

export function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";

  return number.toLocaleString(undefined, {
    maximumFractionDigits: number >= 1000 ? 0 : 2,
  });
}

export function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}