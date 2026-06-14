import { normalizeQuote, parseCandles } from "../lib/marketAnalysis";

const API_BASE = import.meta.env.VITE_API_URL || "";

export const QUOTE_REFRESH_MS = 15 * 60 * 1000;
export const CHART_REFRESH_MS = 30 * 60 * 1000;
export const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000;

export const intervalMap = {
  "1D": "1day",
  "1W": "1week",
  "1M": "1day",
  "3M": "1day",
  "1Y": "1month",
  "All": "1month",
};

export async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data?.status === "error") {
    throw new Error(data?.message || "API error");
  }

  if (data?.code || data?.message?.toLowerCase?.().includes("api key")) {
    throw new Error(data.message || "API key error");
  }

  return data;
}

export async function fetchTwelveDataMarketSnapshot({
  marketConfig,
  selected,
  currentInterval,
  cachedCandles,
  shouldFetchQuotes,
  shouldFetchChart,
}) {
  const symbols = marketConfig.map((item) => item.apiSymbol).join(",");
  const selectedConfig =
    marketConfig.find((item) => item.symbol === selected) || marketConfig[0];

  const quotePromise = shouldFetchQuotes
    ? fetchJson(`${API_BASE}/api/market-data?endpoint=quote&symbol=${symbols}`)
    : Promise.resolve(null);

  const chartPromise = shouldFetchChart
    ? fetchJson(
        `${API_BASE}/api/market-data?endpoint=time_series&symbol=${selectedConfig.apiSymbol}&interval=${currentInterval}&outputsize=120`
      )
    : Promise.resolve({
        values: [...cachedCandles.candles]
          .reverse()
          .map((candle) => ({
            ...candle,
            close: String(candle.close),
          })),
      });

  const [quoteResponse, seriesResponse] = await Promise.all([
    quotePromise,
    chartPromise,
  ]);

  const selectedCandles = parseCandles(seriesResponse?.values);

  return {
    quoteResponse,
    selectedCandles,
  };
}

export function buildNextMarkets({
  marketConfig,
  markets,
  selected,
  quoteResponse,
  selectedCandles,
}) {
  return marketConfig.map((config) => {
    const existing = markets.find((item) => item.symbol === config.symbol);

    const liveQuote =
      quoteResponse?.[config.apiSymbol] ||
      quoteResponse?.[config.symbol] ||
      quoteResponse;

    const cachedQuote = {
      close: existing?.rawPrice,
      percent_change: existing?.rawChange,
      is_market_open: existing?.marketOpen,
    };

    const quote = liveQuote || cachedQuote;

    const candlesForThisMarket =
      config.symbol === selected ? selectedCandles : existing?.candles || [];

    return normalizeQuote(config, quote, candlesForThisMarket);
  });
}