import { clamp, formatPercent, formatPrice } from "./formatters";

export function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;

  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function sma(values, period) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

export function emaSeries(values, period) {
  if (values.length < period) return [];

  const k = 2 / (period + 1);
  const result = [];

  let previous = average(values.slice(0, period));
  result.push(previous);

  for (let i = period; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
    result.push(previous);
  }

  return result;
}

export function ema(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}

export function rsi(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];

    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(values) {
  if (values.length < 35) return null;

  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  const offset = ema12.length - ema26.length;

  const macdLine = ema26.map((value, index) => ema12[index + offset] - value);
  const signalLine = emaSeries(macdLine, 9);

  if (!signalLine.length) return null;

  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];

  return {
    macd: latestMacd,
    signal: latestSignal,
    histogram: latestMacd - latestSignal,
  };
}

export function standardDeviation(values) {
  const avg = average(values);
  if (avg === null) return null;

  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function bollingerBands(values, period = 20, multiplier = 2) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mid = average(slice);
  const std = standardDeviation(slice);
  if (!mid || !std) return null;
  const upper = mid + multiplier * std;
  const lower = mid - multiplier * std;
  const last = values[values.length - 1];
  const bandwidth = (upper - lower) / mid * 100;
  const percentB = upper !== lower ? (last - lower) / (upper - lower) : 0.5;
  return { upper, middle: mid, lower, percentB, bandwidth };
}

export function calculateADX(candles, period = 14) {
  if (candles.length < period * 2 + 1) return null;
  const trs = [], plusDMs = [], minusDMs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low;
    const ph = candles[i - 1].high, pl = candles[i - 1].low, pc = candles[i - 1].close;
    const up = h - ph, down = pl - l;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    plusDMs.push(up > down && up > 0 ? up : 0);
    minusDMs.push(down > up && down > 0 ? down : 0);
  }
  let sTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let sPDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let sMDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  const dxArr = [];
  const pushDX = () => {
    const pdi = sTR > 0 ? 100 * sPDM / sTR : 0;
    const mdi = sTR > 0 ? 100 * sMDM / sTR : 0;
    if (pdi + mdi > 0) dxArr.push(100 * Math.abs(pdi - mdi) / (pdi + mdi));
  };
  pushDX();
  for (let i = period; i < trs.length; i++) {
    sTR = sTR - sTR / period + trs[i];
    sPDM = sPDM - sPDM / period + plusDMs[i];
    sMDM = sMDM - sMDM / period + minusDMs[i];
    pushDX();
  }
  if (dxArr.length < period) return null;
  let adxVal = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxArr.length; i++) adxVal = (adxVal * (period - 1) + dxArr[i]) / period;
  const plusDI = sTR > 0 ? 100 * sPDM / sTR : 0;
  const minusDI = sTR > 0 ? 100 * sMDM / sTR : 0;
  return { adx: adxVal, plusDI, minusDI };
}

export function calculateStochastic(candles, kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod + dPeriod) return null;
  const kValues = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...slice.map(c => c.high));
    const ll = Math.min(...slice.map(c => c.low));
    kValues.push(hh === ll ? 50 : 100 * (candles[i].close - ll) / (hh - ll));
  }
  if (kValues.length < dPeriod) return null;
  const dSlice = kValues.slice(-dPeriod);
  return { k: kValues[kValues.length - 1], d: dSlice.reduce((a, b) => a + b, 0) / dPeriod };
}

export function calculateOBVTrend(candles, lookback = 20) {
  if (candles.length < lookback + 1) return null;
  let obv = 0;
  const series = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    series.push(obv);
  }
  const recent = series.slice(-lookback);
  const n = recent.length;
  const avgY = recent.reduce((a, b) => a + b, 0) / n;
  if (!avgY) return null;
  const meanX = (n - 1) / 2;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - meanX) * (recent[i] - avgY); den += (i - meanX) ** 2; }
  return den > 0 ? (num / den / Math.abs(avgY)) * 100 : 0;
}

export function calculateROC(values, period) {
  if (values.length < period + 1) return null;
  const past = values[values.length - 1 - period];
  return past !== 0 ? (values[values.length - 1] - past) / past * 100 : null;
}

export function parseCandles(values) {
  if (!Array.isArray(values)) return [];

  return [...values]
    .reverse()
    .map((item) => ({
      datetime: item.datetime,
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume),
    }))
    .filter((item) => Number.isFinite(item.close));
}

export function signalFromScore(score) {
  if (score >= 80) return "Strong Buy";
  if (score >= 60) return "Buy";
  if (score > 40) return "Hold";
  if (score >= 20) return "Sell";
  return "Strong Sell";
}

export function calculateIndicators(candles, quotePercentChange = 0) {
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  const volumes = candles.map((candle) => candle.volume).filter(Number.isFinite);

  const lastClose = closes[closes.length - 1];
  const firstClose = closes[0];

  if (closes.length < 20 || !lastClose || !firstClose) {
    const basicScore = clamp(50 + (Number(quotePercentChange) || 0) * 8, 1, 99);

    return {
      score: Math.round(basicScore),
      signal: signalFromScore(basicScore),
      summary: "Limited data",
      rsi: null,
      macd: null,
      sma20: null,
      sma50: null,
      ema20: null,
      ema50: null,
      volatility: null,
      volumeTrend: null,
      momentum: Number(quotePercentChange) || 0,
      components: {
        trend: 50,
        momentum: basicScore,
        macd: 50,
        volume: 50,
        volatility: 50,
      },
    };
  }

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, Math.min(50, closes.length));
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, Math.min(50, closes.length));
  const rsi14 = rsi(closes, 14);
  const macdValue = macd(closes);
  const bb = bollingerBands(closes, 20, 2);
  const adx = calculateADX(candles, 14);
  const stoch = calculateStochastic(candles, 14, 3);
  const obvTrend = calculateOBVTrend(candles, 20);
  const roc14 = calculateROC(closes, 14);
  const roc5 = calculateROC(closes, 5);
  const divergence = (() => {
    if (!Number.isFinite(rsi14) || closes.length < 44) return "none";
    const half = 15;
    const midRsi = rsi(closes.slice(0, closes.length - half), 14);
    if (!Number.isFinite(midRsi)) return "none";
    const recentAvg = average(closes.slice(-half));
    const olderAvg = average(closes.slice(-half * 2, -half));
    if (!recentAvg || !olderAvg) return "none";
    if (recentAvg > olderAvg * 1.005 && rsi14 < midRsi - 3) return "bearish";
    if (recentAvg < olderAvg * 0.995 && rsi14 > midRsi + 3) return "bullish";
    return "none";
  })();

  const chartMomentum = ((lastClose - firstClose) / firstClose) * 100;
  const quoteMomentum = Number(quotePercentChange) || 0;

  const recentReturns = closes
    .slice(-21)
    .map((value, index, array) =>
      index === 0 ? null : Math.log(value / array[index - 1])
    )
    .filter(Number.isFinite);

  const volatility = (standardDeviation(recentReturns) || 0) * 100;

  const latestVolume = volumes[volumes.length - 1];
  const avgVolume20 = average(volumes.slice(-20));
  const volumeTrend =
    latestVolume && avgVolume20
      ? ((latestVolume - avgVolume20) / avgVolume20) * 100
      : null;

  let trendScore = 50;

  if (lastClose > sma20) trendScore += 12;
  else trendScore -= 12;

  if (lastClose > sma50) trendScore += 12;
  else trendScore -= 12;

  if (ema20 && ema50 && ema20 > ema50) trendScore += 14;
  else trendScore -= 10;

  if (sma20 && sma50 && sma20 > sma50) trendScore += 10;
  else trendScore -= 6;

  let momentumScore = 50 + chartMomentum * 4 + quoteMomentum * 6;

  if (rsi14 !== null) {
    if (rsi14 >= 50 && rsi14 <= 70) momentumScore += 16;
    else if (rsi14 > 70) momentumScore += 4;
    else if (rsi14 >= 40) momentumScore += 2;
    else momentumScore -= 18;
  }

  let macdScore = 50;

  if (macdValue) {
    macdScore += macdValue.histogram > 0 ? 22 : -22;
    macdScore += macdValue.macd > 0 ? 10 : -8;
  }

  let volumeScore = 50;

  if (volumeTrend !== null) {
    if (quoteMomentum >= 0 && volumeTrend > 0) volumeScore += 18;
    else if (quoteMomentum < 0 && volumeTrend > 0) volumeScore -= 14;
    else if (quoteMomentum >= 0 && volumeTrend < 0) volumeScore -= 4;
  }

  const volatilityScore = clamp(80 - volatility * 18, 20, 90);

  const components = {
    trend: clamp(trendScore),
    momentum: clamp(momentumScore),
    macd: clamp(macdScore),
    volume: clamp(volumeScore),
    volatility: clamp(volatilityScore),
  };

  const finalScore =
    components.trend * 0.32 +
    components.momentum * 0.25 +
    components.macd * 0.18 +
    components.volume * 0.10 +
    components.volatility * 0.15;

  return {
    score: Math.round(clamp(finalScore, 1, 99)),
    signal: signalFromScore(finalScore),
    summary: chartMomentum >= 0 ? "Positive" : "Negative",
    rsi: rsi14,
    macd: macdValue,
    sma20, sma50, ema20, ema50,
    volatility, volumeTrend, momentum: chartMomentum, components,
    bb, adx, stoch, obvTrend, roc14, roc5, divergence,
  };
}

export function normalizeQuote(config, quote, candles = []) {
  const percentChange =
    quote?.percent_change ?? quote?.percentChange ?? quote?.change_percent;

  const price = quote?.close ?? quote?.price ?? quote?.previous_close;

  const indicators = calculateIndicators(candles, percentChange);
  const hasMarketStatus = typeof quote?.is_market_open === "boolean";

  return {
    ...config,
    price: formatPrice(price),
    rawPrice: Number(price),
    change: formatPercent(percentChange),
    rawChange: Number(percentChange),
    score: indicators.score,
    signal: indicators.signal,
    marketOpen: hasMarketStatus ? quote.is_market_open : null,
    chart: candles.map((candle) => candle.close),
    candles,
    indicators,
  };
}

export function getTrendLabel(indicators) {
  const trend = indicators?.components?.trend;

  if (trend === null || trend === undefined) return "Neutral";
  if (trend >= 70) return "Bullish";
  if (trend <= 35) return "Bearish";

  return "Mixed";
}