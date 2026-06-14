const ASSET_DESCRIPTIONS = {
  SPY: "broad US large-cap equity ETF tracking the S&P 500",
  VT: "global all-world equity ETF covering US and international markets",
  QQQ: "Nasdaq 100 ETF — tech and growth heavy, higher sector concentration",
  EEM: "emerging markets ETF — China, India, LatAm; elevated currency and geopolitical risk",
};

export const SYSTEM_PROMPT = `You are a sharp, direct investment analyst assistant. The user already holds this ETF as part of a long-term portfolio and wants a clear recommendation: should they add more money to it right now, or wait?

Respond in EXACTLY this format — no preamble, no extra lines:

VERDICT: <one of: Add more | Wait for entry | Hold position | Reduce risk>
CONFIDENCE: <one of: High | Medium | Low>
REASON: <one sentence, max 20 words, referencing a specific indicator or condition>
REASON: <one sentence, max 20 words, referencing a different indicator or condition>
REASON: <one sentence, max 20 words, referencing a third factor>
ENTRY: <one sentence — if not adding now, give a specific price level or condition to watch; if adding now, say so briefly>
RISK: <one sentence — the single most important risk to be aware of right now>`;

export function buildMarketContext(market, decision, timeframe) {
  const symbol = market?.apiSymbol || "UNKNOWN";
  const description = ASSET_DESCRIPTIONS[symbol] || "equity ETF";
  const factors = decision?.factors || [];

  const factor = (label) => factors.find((f) => f.label === label);
  const trendF = factor("Trend");
  const rsiF = factor("RSI");
  const macdF = factor("MACD");
  const volumeF = factor("Volume");
  const structureF = factor("Structure");
  const entryF = factor("Entry");
  const riskF = factor("Risk");

  const rsi = market?.indicators?.rsi;
  const macd = market?.indicators?.macd;
  const volumeTrend = market?.indicators?.volumeTrend;
  const volatility = market?.indicators?.volatility;
  const sma20 = market?.indicators?.sma20;
  const ema20 = market?.indicators?.ema20;

  const lines = [
    `Asset: ${market?.symbol ?? symbol} (${symbol}) — ${description}`,
    `Price: ${market?.price ?? "--"} (${market?.change ?? "--"} today, ${timeframe} chart)`,
    `Market: ${market?.marketOpen === true ? "open" : market?.marketOpen === false ? "closed" : "status unknown"}`,
    "",
    "Technical picture:",
    rsi != null
      ? `RSI(14): ${rsi.toFixed(1)} — ${rsiF?.note ?? ""}`
      : "RSI: not yet available",
    macd != null
      ? `MACD: ${macd.histogram >= 0 ? "positive histogram" : "negative histogram"}, ${macd.macd > 0 ? "above zero" : "below zero"} — ${macdF?.note ?? ""}`
      : "MACD: not yet available",
    trendF
      ? `Trend score: ${trendF.value}/100 (${trendF.note})`
      : "Trend: unavailable",
    volumeTrend != null
      ? `Volume vs 20-day avg: ${volumeTrend >= 0 ? "+" : ""}${volumeTrend.toFixed(1)}% — ${volumeF?.note ?? ""}`
      : "Volume: unavailable",
    volatility != null
      ? `Daily volatility: ${volatility.toFixed(2)}%`
      : "Volatility: unavailable",
    sma20 != null && market?.rawPrice
      ? `Price vs SMA20: ${(((market.rawPrice - sma20) / sma20) * 100).toFixed(1)}%`
      : null,
    ema20 != null && market?.rawPrice
      ? `Price vs EMA20: ${(((market.rawPrice - ema20) / ema20) * 100).toFixed(1)}% (EMA20 at ${ema20.toFixed(2)})`
      : null,
    structureF
      ? `Swing structure: ${structureF.note}`
      : null,
    "",
    "Decision engine summary:",
    `Score: ${decision?.score ?? "--"}/100 — ${decision?.signal ?? "--"}`,
    entryF ? `Entry quality: ${entryF.note} (${entryF.value}/100)` : null,
    riskF ? `Risk level: ${riskF.note}` : null,
    `Confidence: ${decision?.confidence ?? "--"}%`,
    `Market regime: ${decision?.regime?.stance ?? "--"}`,
    "",
    "The investor already holds this ETF as part of a long-term portfolio. Should they add more money to it right now?",
  ];

  return lines.filter((l) => l != null).join("\n");
}

export function parseAnalysisResponse(text) {
  const result = {
    verdict: "",
    verdictTone: "neutral",
    confidence: "",
    reasons: [],
    entry: "",
    risk: "",
    raw: text,
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("VERDICT:")) {
      result.verdict = line.replace("VERDICT:", "").trim();
      const v = result.verdict.toLowerCase();
      if (v.includes("add") || v.includes("more")) result.verdictTone = "positive";
      else if (v.includes("reduce") || v.includes("risk")) result.verdictTone = "negative";
      else result.verdictTone = "neutral";
    } else if (line.startsWith("CONFIDENCE:")) {
      result.confidence = line.replace("CONFIDENCE:", "").trim();
    } else if (line.startsWith("REASON:")) {
      const r = line.replace("REASON:", "").trim();
      if (r) result.reasons.push(r);
    } else if (line.startsWith("ENTRY:")) {
      result.entry = line.replace("ENTRY:", "").trim();
    } else if (line.startsWith("RISK:")) {
      result.risk = line.replace("RISK:", "").trim();
    }
  }

  return result;
}
