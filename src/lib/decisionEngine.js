// src/lib/decisionEngine.js
// Rule-based AI-style decision engine.
// No AI APIs are used.
// Assumes normal £200/month DCA continues. It only decides whether to add EXTRA cash today.

const SIGNALS = {
  strongBuy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strongSell: "Strong Sell",
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(safeNumber(value));
}

function roundTo(value, decimals = 2) {
  const number = safeNumber(value, 0);
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function percentChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";

  return number.toLocaleString(undefined, {
    maximumFractionDigits: number >= 1000 ? 0 : 2,
  });
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function scoreToSignal(score) {
  if (score >= 82) return SIGNALS.strongBuy;
  if (score >= 65) return SIGNALS.buy;
  if (score >= 45) return SIGNALS.hold;
  if (score >= 28) return SIGNALS.sell;
  return SIGNALS.strongSell;
}

function confidenceLabel(score) {
  if (score >= 78) return "High confidence";
  if (score >= 58) return "Medium confidence";
  if (score >= 38) return "Low confidence";
  return "Very low confidence";
}

function riskLabel(score) {
  if (score >= 78) return "Very High";
  if (score >= 62) return "High";
  if (score >= 42) return "Moderate";
  return "Controlled";
}

function entryLabel(score) {
  if (score >= 78) return "Good";
  if (score >= 60) return "Acceptable";
  if (score >= 42) return "Wait";
  return "Poor";
}

function getLatestCandle(market) {
  const candles = Array.isArray(market?.candles) ? market.candles : [];
  return candles.length ? candles[candles.length - 1] : null;
}

function getCandleArrays(market) {
  const candles = Array.isArray(market?.candles) ? market.candles : [];

  return {
    candles,
    closes: candles.map((candle) => Number(candle.close)).filter(Number.isFinite),
    highs: candles.map((candle) => Number(candle.high)).filter(Number.isFinite),
    lows: candles.map((candle) => Number(candle.low)).filter(Number.isFinite),
    volumes: candles.map((candle) => Number(candle.volume)).filter(Number.isFinite),
  };
}

function linearSlope(values) {
  const clean = values.filter(Number.isFinite);
  const n = clean.length;

  if (n < 3) return 0;

  const meanX = (n - 1) / 2;
  const meanY = average(clean);

  if (!meanY) return 0;

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < n; index += 1) {
    numerator += (index - meanX) * (clean[index] - meanY);
    denominator += (index - meanX) ** 2;
  }

  if (denominator === 0) return 0;

  return (numerator / denominator / meanY) * 100;
}

function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;

  const trueRanges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const high = Number(candles[index].high);
    const low = Number(candles[index].low);
    const previousClose = Number(candles[index - 1].close);

    if (
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(previousClose)
    ) {
      trueRanges.push(
        Math.max(
          high - low,
          Math.abs(high - previousClose),
          Math.abs(low - previousClose)
        )
      );
    }
  }

  const recent = trueRanges.slice(-period);

  if (recent.length < period) return null;

  return average(recent);
}

function getRecentHighLow(candles, lookback = 30) {
  const recent = candles.slice(-lookback);
  const highs = recent.map((candle) => Number(candle.high)).filter(Number.isFinite);
  const lows = recent.map((candle) => Number(candle.low)).filter(Number.isFinite);

  return {
    high: highs.length ? Math.max(...highs) : null,
    low: lows.length ? Math.min(...lows) : null,
  };
}

function getAssetProfile(market) {
  const symbol = market?.apiSymbol || market?.symbol || "";

  if (symbol === "QQQ") {
    return {
      name: "growth / tech-heavy ETF",
      betaRisk: 9,
      qualityAdjustment: 0,
      sensitivity: "high sensitivity to rates, AI/tech sentiment and earnings expectations",
    };
  }

  if (symbol === "EEM") {
    return {
      name: "emerging markets ETF",
      betaRisk: 13,
      qualityAdjustment: -3,
      sensitivity: "higher sensitivity to USD strength, China risk, commodities and geopolitical headlines",
    };
  }

  if (symbol === "VT") {
    return {
      name: "global equity ETF",
      betaRisk: 5,
      qualityAdjustment: 4,
      sensitivity: "global risk appetite, currency moves and broad equity sentiment",
    };
  }

  return {
    name: "large-cap US equity ETF",
    betaRisk: 4,
    qualityAdjustment: 3,
    sensitivity: "US macro data, earnings breadth, rates and broad risk appetite",
  };
}

function getTimeframeProfile(timeframe) {
  if (["1m", "5m", "15m"].includes(timeframe)) {
    return {
      name: "intraday",
      noisePenalty: 15,
      confidencePenalty: 10,
      entryBufferMultiplier: 0.55,
      note: "Intraday signals are noisy and can reverse quickly.",
    };
  }

  if (["30m", "1H"].includes(timeframe)) {
    return {
      name: "short-term",
      noisePenalty: 9,
      confidencePenalty: 5,
      entryBufferMultiplier: 0.75,
      note: "Short-term signals need confirmation from price and volume.",
    };
  }

  if (timeframe === "1W") {
    return {
      name: "weekly",
      noisePenalty: 2,
      confidencePenalty: 0,
      entryBufferMultiplier: 1.5,
      note: "Weekly signals are slower but usually more meaningful for investors.",
    };
  }

  if (timeframe === "1M") {
    return {
      name: "1-month",
      noisePenalty: 1,
      confidencePenalty: 0,
      entryBufferMultiplier: 1.8,
      note: "1-month signals offer a balanced view between near-term noise and medium-term trend.",
    };
  }

  if (timeframe === "3M") {
    return {
      name: "3-month",
      noisePenalty: 0,
      confidencePenalty: -2,
      entryBufferMultiplier: 2.2,
      note: "3-month signals reduce short-term noise and are well-suited for allocation decisions.",
    };
  }

  if (timeframe === "1Y" || timeframe === "All") {
    return {
      name: "long-term",
      noisePenalty: 0,
      confidencePenalty: -5,
      entryBufferMultiplier: 3.5,
      note: "Long-term monthly signals are slow-moving and best for strategic allocation reviews, not short-term entries.",
    };
  }

  return {
    name: "daily",
    noisePenalty: 4,
    confidencePenalty: 1,
    entryBufferMultiplier: 1,
    note: "Daily signals are usually suitable for swing and allocation decisions.",
  };
}

function analyseSwingStructure(candles) {
  const last20 = getRecentHighLow(candles, 20);
  const prior20 = getRecentHighLow(candles.slice(0, -20), 20);

  if (
    !Number.isFinite(last20.high) ||
    !Number.isFinite(last20.low) ||
    !Number.isFinite(prior20.high) ||
    !Number.isFinite(prior20.low)
  ) {
    return {
      state: "unknown",
      score: 50,
      message: "Swing structure is not available yet.",
    };
  }

  const higherHigh = last20.high > prior20.high;
  const higherLow = last20.low > prior20.low;
  const lowerHigh = last20.high < prior20.high;
  const lowerLow = last20.low < prior20.low;

  if (higherHigh && higherLow) {
    return {
      state: "higher highs and higher lows",
      score: 82,
      message: "Price structure shows higher highs and higher lows.",
    };
  }

  if (lowerHigh && lowerLow) {
    return {
      state: "lower highs and lower lows",
      score: 22,
      message: "Price structure shows lower highs and lower lows.",
    };
  }

  if (higherLow && !higherHigh) {
    return {
      state: "base building",
      score: 62,
      message: "Price is building a higher low, but breakout confirmation is still needed.",
    };
  }

  if (lowerHigh && !lowerLow) {
    return {
      state: "range compression",
      score: 44,
      message: "Price is compressing below a lower high, so upside needs confirmation.",
    };
  }

  return {
    state: "mixed swing structure",
    score: 50,
    message: "Swing structure is mixed.",
  };
}

function analyseTrend(indicators, market) {
  const { closes } = getCandleArrays(market);
  const latest = getLatestCandle(market);

  const lastClose = Number(latest?.close ?? market?.rawPrice);
  const sma20 = Number(indicators?.sma20);
  const sma50 = Number(indicators?.sma50);
  const ema20 = Number(indicators?.ema20);
  const ema50 = Number(indicators?.ema50);

  let score = safeNumber(indicators?.components?.trend, 50);
  const messages = [];

  const slope10 = linearSlope(closes.slice(-10));
  const slope30 = linearSlope(closes.slice(-30));

  if (slope10 > 0.08) score += 5;
  if (slope10 < -0.08) score -= 5;
  if (slope30 > 0.05) score += 5;
  if (slope30 < -0.05) score -= 5;

  if (Number.isFinite(lastClose) && Number.isFinite(sma20)) {
    if (lastClose > sma20) {
      score += 5;
      messages.push("price is above the 20-period average");
    } else {
      score -= 8;
      messages.push("price is below the 20-period average");
    }
  }

  if (Number.isFinite(lastClose) && Number.isFinite(sma50)) {
    if (lastClose > sma50) {
      score += 5;
      messages.push("price is above the 50-period average");
    } else {
      score -= 10;
      messages.push("price is below the 50-period average");
    }
  }

  if (Number.isFinite(sma20) && Number.isFinite(sma50)) {
    messages.push(
      sma20 > sma50
        ? "short-term average is above the longer average"
        : "short-term average is below the longer average"
    );
  }

  if (Number.isFinite(ema20) && Number.isFinite(ema50)) {
    messages.push(
      ema20 > ema50
        ? "EMA structure is constructive"
        : "EMA structure is defensive"
    );
  }

  score = clamp(score, 1, 99);

  return {
    score,
    slope10,
    slope30,
    state:
      score >= 78
        ? "strong uptrend"
        : score >= 62
          ? "constructive trend"
          : score >= 43
            ? "mixed trend"
            : "weak trend",
    message: messages.length
      ? `Trend structure: ${messages.slice(0, 3).join("; ")}.`
      : "Trend structure is not fully available.",
  };
}

function analyseRsi(rsi, trendScore = 50) {
  if (!Number.isFinite(rsi)) {
    return {
      state: "unknown",
      score: 50,
      riskPenalty: 5,
      message: "RSI is unavailable, so momentum quality is less certain.",
    };
  }

  const strongTrend = trendScore >= 70;

  if (rsi >= 84) {
    return {
      state: "extremely overbought",
      score: strongTrend ? 42 : 30,
      riskPenalty: 24,
      message:
        "RSI is extremely stretched. In a strong trend this can persist, but chasing here is high risk.",
    };
  }

  if (rsi >= 76) {
    return {
      state: "overbought",
      score: strongTrend ? 54 : 42,
      riskPenalty: 15,
      message:
        "RSI is overbought, so the setup may be bullish but entry quality is reduced.",
    };
  }

  if (rsi >= 62) {
    return {
      state: "strong momentum",
      score: strongTrend ? 78 : 70,
      riskPenalty: 3,
      message: "RSI shows strong momentum without being fully exhausted.",
    };
  }

  if (rsi >= 50) {
    return {
      state: "constructive",
      score: 76,
      riskPenalty: 0,
      message: "RSI is in a constructive momentum zone.",
    };
  }

  if (rsi >= 42) {
    return {
      state: "neutral",
      score: 56,
      riskPenalty: 4,
      message: "RSI is neutral, so momentum is not giving a strong edge.",
    };
  }

  if (rsi >= 30) {
    return {
      state: "weak",
      score: 36,
      riskPenalty: 12,
      message: "RSI is weak, suggesting momentum has not repaired yet.",
    };
  }

  return {
    state: "oversold",
    score: 43,
    riskPenalty: 16,
    message:
      "RSI is oversold. A bounce is possible, but trend confirmation is needed.",
  };
}

function analyseMacd(macd, market) {
  const { closes } = getCandleArrays(market);

  if (!macd) {
    return {
      state: "unknown",
      score: 50,
      acceleration: 0,
      message: "MACD is unavailable, reducing confirmation quality.",
    };
  }

  const histogram = safeNumber(macd.histogram, 0);
  const line = safeNumber(macd.macd, 0);
  const signal = safeNumber(macd.signal, 0);
  const spread = line - signal;

  let acceleration = 0;

  if (closes.length >= 16) {
    const recentSlope = linearSlope(closes.slice(-8));
    const priorSlope = linearSlope(closes.slice(-16, -8));
    acceleration = recentSlope - priorSlope;
  }

  if (histogram > 0 && line > 0 && spread > 0 && acceleration >= 0) {
    return {
      state: "bullish expansion",
      score: 86,
      acceleration,
      message: "MACD is bullish and price acceleration is supportive.",
    };
  }

  if (histogram > 0 && spread > 0) {
    return {
      state: "bullish crossover",
      score: 73,
      acceleration,
      message: "MACD is above the signal line, giving positive momentum confirmation.",
    };
  }

  if (histogram > 0 && acceleration < 0) {
    return {
      state: "bullish but fading",
      score: 61,
      acceleration,
      message: "MACD remains positive, but recent price acceleration is fading.",
    };
  }

  if (histogram < 0 && line < 0) {
    return {
      state: "bearish pressure",
      score: 22,
      acceleration,
      message: "MACD is bearish and below zero, showing downside pressure.",
    };
  }

  return {
    state: "bearish crossover",
    score: 38,
    acceleration,
    message: "MACD is below the signal line, so momentum confirmation is weak.",
  };
}

function analyseVolume(volumeTrend, priceChange, market) {
  const { volumes } = getCandleArrays(market);
  const latestVolume = volumes[volumes.length - 1];
  const avgVolume20 = average(volumes.slice(-20));
  const relativeVolume =
    latestVolume && avgVolume20 ? latestVolume / avgVolume20 : null;

  if (!Number.isFinite(volumeTrend)) {
    return {
      state: "unknown",
      score: 50,
      riskPenalty: 7,
      relativeVolume,
      message: "Volume trend is unavailable, so conviction is lower.",
    };
  }

  if (volumeTrend >= 50 && priceChange >= 0) {
    return {
      state: "strong bullish confirmation",
      score: 86,
      riskPenalty: 0,
      relativeVolume,
      message: "Price strength is supported by meaningfully stronger volume.",
    };
  }

  if (volumeTrend >= 25 && priceChange >= 0) {
    return {
      state: "bullish confirmation",
      score: 76,
      riskPenalty: 0,
      relativeVolume,
      message: "Rising price is supported by stronger volume.",
    };
  }

  if (volumeTrend >= 35 && priceChange < 0) {
    return {
      state: "bearish distribution",
      score: 23,
      riskPenalty: 16,
      relativeVolume,
      message:
        "Price weakness is happening on stronger volume, which suggests distribution.",
    };
  }

  if (volumeTrend <= -75) {
    return {
      state: "very low participation",
      score: 31,
      riskPenalty: 17,
      relativeVolume,
      message:
        "Volume is extremely low versus average, so the signal has weak confirmation.",
    };
  }

  if (volumeTrend <= -35) {
    return {
      state: "low participation",
      score: 41,
      riskPenalty: 10,
      relativeVolume,
      message: "Volume is below average, reducing conviction in the signal.",
    };
  }

  if (volumeTrend < 0 && priceChange >= 0) {
    return {
      state: "low-conviction rise",
      score: 47,
      riskPenalty: 7,
      relativeVolume,
      message: "Price is rising, but volume confirmation is not strong.",
    };
  }

  return {
    state: "neutral",
    score: 56,
    riskPenalty: 3,
    relativeVolume,
    message: "Volume is not giving a strong confirmation or warning.",
  };
}

function analyseVolatility(volatility, atrPercent) {
  const effectiveVolatility = Number.isFinite(atrPercent)
    ? Math.max(safeNumber(volatility, 0), atrPercent)
    : safeNumber(volatility, null);

  if (!Number.isFinite(effectiveVolatility)) {
    return {
      state: "unknown",
      score: 50,
      riskPenalty: 6,
      effectiveVolatility,
      message: "Volatility is unavailable, so risk estimates are less reliable.",
    };
  }

  if (effectiveVolatility >= 3.4) {
    return {
      state: "very high",
      score: 24,
      riskPenalty: 23,
      effectiveVolatility,
      message: "Volatility is very high; position sizing should be reduced.",
    };
  }

  if (effectiveVolatility >= 2.2) {
    return {
      state: "elevated",
      score: 42,
      riskPenalty: 13,
      effectiveVolatility,
      message: "Volatility is elevated, making the signal less stable.",
    };
  }

  if (effectiveVolatility <= 0.45) {
    return {
      state: "compressed",
      score: 59,
      riskPenalty: 4,
      effectiveVolatility,
      message: "Volatility is compressed; a larger move may follow after a breakout.",
    };
  }

  return {
    state: "controlled",
    score: 75,
    riskPenalty: 0,
    effectiveVolatility,
    message: "Volatility is controlled, improving signal quality.",
  };
}

function detectOverextension({ market, indicators, atrPercent }) {
  const latest = getLatestCandle(market);
  const price = Number(latest?.close ?? market?.rawPrice);
  const ema20 = Number(indicators?.ema20);
  const sma20 = Number(indicators?.sma20);
  const recent = getRecentHighLow(getCandleArrays(market).candles, 30);

  let score = 50;
  const flags = [];

  if (Number.isFinite(price) && Number.isFinite(ema20) && ema20 > 0) {
    const distance = percentChange(ema20, price);

    if (distance > 6) {
      score += 24;
      flags.push(`price is ${distance.toFixed(1)}% above EMA20`);
    } else if (distance > 3) {
      score += 12;
      flags.push(`price is ${distance.toFixed(1)}% above EMA20`);
    } else if (distance < -3) {
      score += 10;
      flags.push(`price is ${Math.abs(distance).toFixed(1)}% below EMA20`);
    }
  }

  if (Number.isFinite(price) && Number.isFinite(sma20) && sma20 > 0) {
    const distance = percentChange(sma20, price);

    if (distance > 6) {
      score += 18;
      flags.push(`price is ${distance.toFixed(1)}% above SMA20`);
    }
  }

  if (Number.isFinite(price) && Number.isFinite(recent.high) && recent.high > 0) {
    const distanceFromHigh = percentChange(recent.high, price);

    if (distanceFromHigh > -0.5) {
      score += 10;
      flags.push("price is very close to the recent high");
    }
  }

  if (Number.isFinite(atrPercent)) {
    if (atrPercent > 2.5) score += 8;
    if (atrPercent < 0.8) score -= 3;
  }

  score = clamp(score, 1, 99);

  return {
    score,
    level:
      score >= 75
        ? "stretched"
        : score >= 58
          ? "moderately stretched"
          : "not stretched",
    flags,
  };
}

function analyseBollingerBands(bb, price) {
  if (!bb || !Number.isFinite(price)) {
    return { score: 50, state: "unknown", squeeze: false, expansion: false, message: "Bollinger Bands unavailable." };
  }
  const { percentB, bandwidth } = bb;
  const squeeze = bandwidth < 4;
  const expansion = bandwidth > 9;
  let score = 50, state = "midrange";
  if (percentB <= 0)              { score = 66; state = "below lower band"; }
  else if (percentB <= 0.2)       { score = 74; state = "near lower band"; }
  else if (percentB >= 1)         { score = 22; state = "above upper band"; }
  else if (percentB >= 0.8)       { score = 36; state = "near upper band"; }
  else if (percentB >= 0.4 && percentB <= 0.6) { score = 60; state = "midrange"; }
  if (squeeze) score = Math.min(score + 8, 99);
  return {
    score, state, percentB, bandwidth, squeeze, expansion,
    message: squeeze
      ? `Bollinger squeeze detected (width ${bandwidth.toFixed(1)}%) — volatility is compressed and an expansion move may be near.`
      : `Price sits at ${(percentB * 100).toFixed(0)}% of the Bollinger channel (width ${bandwidth.toFixed(1)}%).`,
  };
}

function analyseADX(adxData) {
  if (!adxData) {
    return { score: 50, trending: false, bullish: null, strength: "unknown", adx: null, message: "ADX unavailable." };
  }
  const { adx, plusDI, minusDI } = adxData;
  const bullish = plusDI > minusDI;
  const trending = adx >= 20;
  let score = 50, strength = "ranging";
  if (adx >= 40)      { strength = "very strong trend"; score = bullish ? 80 : 20; }
  else if (adx >= 25) { strength = "strong trend";      score = bullish ? 72 : 28; }
  else if (adx >= 20) { strength = "developing trend";  score = bullish ? 62 : 40; }
  else if (adx >= 15) { strength = "weak trend";        score = 50; }
  else                { strength = "ranging";            score = 44; }
  return {
    score, trending, bullish, strength, adx, plusDI, minusDI,
    message: `ADX ${adx.toFixed(1)} — ${strength}, ${bullish ? "bullish" : "bearish"} bias (+DI ${plusDI.toFixed(1)} vs -DI ${minusDI.toFixed(1)}).`,
  };
}

function analyseStochastic(stoch) {
  if (!stoch) return { score: 50, state: "unknown", k: null, d: null, message: "Stochastic unavailable." };
  const { k, d } = stoch;
  const crossingUp = k > d && k < 80;
  let score = 50, state;
  if (k <= 20 && d <= 20)       { score = 74; state = "oversold"; }
  else if (k <= 30)             { score = 63; state = "approaching oversold"; }
  else if (k >= 80 && d >= 80)  { score = 24; state = "overbought"; }
  else if (k >= 70)             { score = 38; state = "approaching overbought"; }
  else if (crossingUp)          { score = 68; state = "bullish cross"; }
  else if (k < d && k > 20)     { score = 36; state = "bearish cross"; }
  else                          { score = 54; state = "neutral"; }
  return { score, state, k, d, message: `Stochastic %K ${k.toFixed(1)} / %D ${d.toFixed(1)} — ${state}.` };
}

function analyseOBV(obvTrend, priceChange) {
  if (!Number.isFinite(obvTrend)) {
    return { score: 50, state: "unknown", message: "OBV trend unavailable." };
  }
  const priceUp = priceChange >= 0;
  let score = 50, state;
  if (priceUp && obvTrend > 2)        { score = 80; state = "strong accumulation"; }
  else if (priceUp && obvTrend > 0)   { score = 67; state = "accumulation"; }
  else if (!priceUp && obvTrend < -2) { score = 20; state = "strong distribution"; }
  else if (!priceUp && obvTrend < 0)  { score = 34; state = "distribution"; }
  else if (!priceUp && obvTrend > 1)  { score = 60; state = "hidden bullish"; }
  else if (priceUp && obvTrend < -1)  { score = 38; state = "hidden bearish"; }
  else                                { score = 52; state = "neutral"; }
  return { score, state, message: `OBV is ${state} (slope ${obvTrend.toFixed(2)}%).` };
}

function analyseMomentum(roc5, roc14) {
  const r5 = Number.isFinite(roc5) ? roc5 : null;
  const r14 = Number.isFinite(roc14) ? roc14 : null;
  if (r5 === null && r14 === null) return { score: 50, state: "unknown", message: "Momentum (ROC) unavailable." };
  const primary = r14 ?? r5;
  let score = 50, state;
  if (primary > 8)       { score = 80; state = "strong upward momentum"; }
  else if (primary > 3)  { score = 67; state = "positive momentum"; }
  else if (primary > 0)  { score = 56; state = "mild positive momentum"; }
  else if (primary > -3) { score = 44; state = "mild negative momentum"; }
  else if (primary > -8) { score = 32; state = "negative momentum"; }
  else                   { score = 18; state = "strong downward momentum"; }
  if (r5 !== null && r14 !== null) {
    if (r5 > r14 && r14 > 0) score = Math.min(score + 8, 99);
    if (r5 < 0 && r14 > 0)   score = Math.max(score - 8, 1);
  }
  return {
    score, state, roc5: r5, roc14: r14,
    message: `14-period ROC: ${r14 !== null ? r14.toFixed(2) + "%" : "N/A"} — ${state}${r5 !== null ? ` (5-period: ${r5.toFixed(2)}%)` : ""}.`,
  };
}

function inferMarketRegime({
  trendAnalysis,
  macdAnalysis,
  rsiAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  swingStructure,
  adxAnalysis,
  momentumAnalysis,
}) {
  const adxScore = adxAnalysis?.score ?? 50;
  const momScore = momentumAnalysis?.score ?? 50;
  const score = clamp(
    trendAnalysis.score * 0.24 +
    macdAnalysis.score * 0.17 +
    rsiAnalysis.score * 0.11 +
    swingStructure.score * 0.12 +
    volatilityAnalysis.score * 0.08 +
    volumeAnalysis.score * 0.08 +
    adxScore * 0.12 +
    momScore * 0.08
  );

  return {
    score,
    stance:
      score >= 74
        ? "risk-on trend"
        : score >= 60
          ? "selective risk-on"
          : score >= 44
            ? "mixed"
            : "risk-off",
  };
}

function calculateEntryQuality({
  trendAnalysis,
  rsiAnalysis,
  macdAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  swingStructure,
  overextension,
  priceChange,
  adxAnalysis,
  bbAnalysis,
  stochAnalysis,
}) {
  let score = 50;

  if (trendAnalysis.score >= 75) score += 16;
  else if (trendAnalysis.score >= 62) score += 9;
  else if (trendAnalysis.score <= 35) score -= 16;

  if (swingStructure.score >= 75) score += 10;
  if (swingStructure.score <= 35) score -= 10;

  if (macdAnalysis.score >= 75) score += 11;
  else if (macdAnalysis.score <= 35) score -= 11;

  if (rsiAnalysis.state === "constructive") score += 12;
  if (rsiAnalysis.state === "strong momentum") score += 8;
  if (rsiAnalysis.state === "overbought") score -= 14;
  if (rsiAnalysis.state === "extremely overbought") score -= 26;
  if (rsiAnalysis.state === "oversold") score -= 5;

  if (volumeAnalysis.state === "strong bullish confirmation") score += 13;
  if (volumeAnalysis.state === "bullish confirmation") score += 9;
  if (volumeAnalysis.state === "very low participation") score -= 16;
  if (volumeAnalysis.state === "low participation") score -= 9;
  if (volumeAnalysis.state === "bearish distribution") score -= 20;

  if (volatilityAnalysis.state === "controlled") score += 8;
  if (volatilityAnalysis.state === "very high") score -= 20;
  if (volatilityAnalysis.state === "elevated") score -= 9;

  if (overextension.level === "stretched") score -= 18;
  if (overextension.level === "moderately stretched") score -= 8;

  if (priceChange > 1.5 && rsiAnalysis.state.includes("overbought")) score -= 10;
  if (priceChange < -1.5 && trendAnalysis.score < 45) score -= 8;

  if (adxAnalysis?.trending && adxAnalysis?.bullish) score += 8;
  if (adxAnalysis?.trending && adxAnalysis?.bullish === false) score -= 12;

  if (bbAnalysis?.state === "near lower band" || bbAnalysis?.state === "below lower band") score += 9;
  if (bbAnalysis?.state === "above upper band") score -= 16;
  if (bbAnalysis?.state === "near upper band") score -= 8;
  if (bbAnalysis?.squeeze) score += 5;

  if (stochAnalysis?.state === "oversold" || stochAnalysis?.state === "bullish cross") score += 8;
  if (stochAnalysis?.state === "overbought" || stochAnalysis?.state === "bearish cross") score -= 10;

  score = clamp(score, 1, 99);

  return {
    score: round(score),
    label: entryLabel(score),
  };
}

function calculateRiskScore({
  rsiAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  trendAnalysis,
  swingStructure,
  overextension,
  assetProfile,
  timeframeProfile,
  market,
  adxAnalysis,
  bbAnalysis,
}) {
  let score = 32;

  score += rsiAnalysis.riskPenalty;
  score += volumeAnalysis.riskPenalty;
  score += volatilityAnalysis.riskPenalty;
  score += assetProfile.betaRisk;
  score += timeframeProfile.noisePenalty;

  if (trendAnalysis.score < 40) score += 10;
  if (swingStructure.score < 40) score += 8;
  if (overextension.level === "stretched") score += 14;
  if (overextension.level === "moderately stretched") score += 6;
  if (trendAnalysis.score > 75 && rsiAnalysis.state === "constructive") score -= 5;
  if (market?.marketOpen === false) score += 3;

  if (adxAnalysis?.trending && adxAnalysis?.bullish === false) score += 8;
  if (adxAnalysis?.strength === "very strong trend" && adxAnalysis?.bullish === false) score += 6;
  if (bbAnalysis?.state === "above upper band") score += 10;
  if (bbAnalysis?.expansion) score += 4;

  score = clamp(score, 1, 99);

  return {
    score: round(score),
    label: riskLabel(score),
  };
}

function calculateConfidence({
  market,
  indicators,
  trendAnalysis,
  rsiAnalysis,
  macdAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  swingStructure,
  timeframeProfile,
  adxAnalysis,
  stochAnalysis,
  momentumAnalysis,
}) {
  const candles = Array.isArray(market?.candles) ? market.candles.length : 0;
  let score = 42;

  if (candles >= 110) score += 20;
  else if (candles >= 75) score += 15;
  else if (candles >= 45) score += 9;
  else score -= 12;

  const componentScores = [
    trendAnalysis.score,
    rsiAnalysis.score,
    macdAnalysis.score,
    volumeAnalysis.score,
    volatilityAnalysis.score,
    swingStructure.score,
    adxAnalysis?.score ?? 50,
    stochAnalysis?.score ?? 50,
    momentumAnalysis?.score ?? 50,
  ];

  const bullishVotes = componentScores.filter((value) => value >= 60).length;
  const bearishVotes = componentScores.filter((value) => value <= 40).length;

  if (bullishVotes >= 5 || bearishVotes >= 5) score += 16;
  else if (bullishVotes >= 4 || bearishVotes >= 4) score += 10;
  else if (bullishVotes === 3 || bearishVotes === 3) score += 5;
  else score -= 5;

  if (indicators?.components) score += 8;
  if (volumeAnalysis.state === "very low participation") score -= 13;
  if (rsiAnalysis.state === "extremely overbought") score -= 11;
  if (volatilityAnalysis.state === "very high") score -= 13;
  if (market?.marketOpen === false) score -= 4;
  if (adxAnalysis?.trending) score += 5;
  if (indicators?.divergence && indicators.divergence !== "none") score -= 8;

  score -= timeframeProfile.confidencePenalty;
  score = clamp(score, 5, 95);

  return {
    score: round(score),
    label: confidenceLabel(score),
  };
}

function getEntryEstimate({
  market,
  indicators,
  timeframeProfile,
  signal,
  rsiAnalysis,
  volumeAnalysis,
  entry,
  regime,
}) {
  const { candles } = getCandleArrays(market);
  const latest = getLatestCandle(market);
  const price = Number(latest?.close ?? market?.rawPrice);

  if (!Number.isFinite(price) || price <= 0 || !candles.length) {
    return {
      label: "No entry estimate",
      zone: null,
      trigger: "Not enough price data to estimate an entry.",
      invalidation: "Not available.",
      text: "Entry estimate unavailable until more candle data is loaded.",
    };
  }

  const atr = calculateATR(candles, 14);
  const recent20 = getRecentHighLow(candles, 20);
  const recent50 = getRecentHighLow(candles, 50);

  const ema20 = Number(indicators?.ema20);
  const sma20 = Number(indicators?.sma20);
  const sma50 = Number(indicators?.sma50);

  const swingHigh = Number.isFinite(recent50.high) ? recent50.high : recent20.high;
  const swingLow = Number.isFinite(recent50.low) ? recent50.low : recent20.low;
  const swingRange =
    Number.isFinite(swingHigh) && Number.isFinite(swingLow)
      ? swingHigh - swingLow
      : null;

  const fib382 =
    Number.isFinite(swingHigh) && Number.isFinite(swingRange)
      ? swingHigh - swingRange * 0.382
      : null;

  const fib50 =
    Number.isFinite(swingHigh) && Number.isFinite(swingRange)
      ? swingHigh - swingRange * 0.5
      : null;

  const atrPullback =
    Number.isFinite(atr)
      ? price - atr * timeframeProfile.entryBufferMultiplier
      : null;

  const candidates = [
    { name: "EMA20 pullback", value: ema20, weight: 1.2 },
    { name: "SMA20 pullback", value: sma20, weight: 1.0 },
    { name: "ATR pullback", value: atrPullback, weight: 1.1 },
    { name: "38.2% retracement", value: fib382, weight: 0.9 },
    { name: "50% retracement", value: fib50, weight: 0.75 },
  ].filter((item) => Number.isFinite(item.value) && item.value > 0);

  const belowPriceCandidates = candidates.filter((item) => item.value < price);

  let preferred = null;

  if (belowPriceCandidates.length) {
    if (rsiAnalysis.state.includes("overbought")) {
      preferred = [...belowPriceCandidates].sort(
        (a, b) =>
          Math.abs(percentChange(price, a.value) + 2.5) -
          Math.abs(percentChange(price, b.value) + 2.5)
      )[0];
    } else {
      preferred = [...belowPriceCandidates].sort(
        (a, b) =>
          Math.abs(percentChange(price, a.value) + 1.2) -
          Math.abs(percentChange(price, b.value) + 1.2)
      )[0];
    }
  }

  const breakoutLevel =
    Number.isFinite(recent20.high) && recent20.high > price
      ? recent20.high
      : Number.isFinite(recent50.high)
        ? recent50.high
        : null;

  const stopCandidates = [
    Number.isFinite(sma50) ? sma50 : null,
    Number.isFinite(swingLow) ? swingLow : null,
    Number.isFinite(atr) ? price - atr * 1.8 : null,
  ].filter((value) => Number.isFinite(value) && value > 0 && value < price);

  const stopReference = stopCandidates.length
    ? Math.max(...stopCandidates)
    : Number.isFinite(atr)
      ? price - atr * 2
      : price * 0.95;

  const stopDistance = percentChange(price, stopReference);

  if (signal === SIGNALS.strongBuy || signal === SIGNALS.buy) {
    const stretched =
      rsiAnalysis.state.includes("overbought") ||
      entry.label === "Wait" ||
      volumeAnalysis.state.includes("low");

    if (stretched && preferred) {
      const pullbackPercent = percentChange(price, preferred.value);

      return {
        label: "Pullback entry preferred",
        zone: {
          price: roundTo(preferred.value, 2),
          percentFromNow: roundTo(pullbackPercent, 2),
          reason: preferred.name,
        },
        trigger:
          `Preferred extra-buy zone is around ${formatPrice(preferred.value)} ` +
          `(${formatPercent(pullbackPercent)} from current price), ideally with RSI cooling and MACD staying positive.`,
        invalidation:
          `Reassess if price breaks below ${formatPrice(stopReference)} ` +
          `(${formatPercent(stopDistance)} from current price).`,
        text:
          `Better extra-buy estimate: around ${formatPrice(preferred.value)}, roughly ` +
          `${Math.abs(pullbackPercent).toFixed(2)}% below current price, based on ${preferred.name}.`,
      };
    }

    if (breakoutLevel && entry.score >= 60 && regime.stance.includes("risk-on")) {
      const breakoutPercent = percentChange(price, breakoutLevel);

      return {
        label: "Breakout confirmation entry",
        zone: {
          price: roundTo(breakoutLevel, 2),
          percentFromNow: roundTo(breakoutPercent, 2),
          reason: "recent high breakout",
        },
        trigger:
          `Extra cash can be considered on a confirmed move above ${formatPrice(breakoutLevel)} ` +
          `(${formatPercent(breakoutPercent)}), preferably with volume above average.`,
        invalidation:
          `Reassess if price falls back below ${formatPrice(stopReference)} ` +
          `(${formatPercent(stopDistance)} from current price).`,
        text:
          `Extra-buy confirmation improves above ${formatPrice(breakoutLevel)}, but avoid chasing without volume confirmation.`,
      };
    }

    return {
      label: "Gradual extra entry acceptable",
      zone: {
        price: roundTo(price, 2),
        percentFromNow: 0,
        reason: "current price acceptable",
      },
      trigger:
        "Current price is acceptable only for a small gradual extra entry, not an aggressive lump sum.",
      invalidation:
        `Reassess if price breaks below ${formatPrice(stopReference)} ` +
        `(${formatPercent(stopDistance)} from current price).`,
      text:
        "Extra entry quality is acceptable, but scaling in gradually is better than adding a large amount immediately.",
    };
  }

  if (signal === SIGNALS.hold) {
    if (breakoutLevel) {
      const breakoutPercent = percentChange(price, breakoutLevel);

      return {
        label: "Wait for breakout or pullback",
        zone: {
          price: roundTo(breakoutLevel, 2),
          percentFromNow: roundTo(breakoutPercent, 2),
          reason: "confirmation level",
        },
        trigger:
          `Wait for either a confirmed breakout above ${formatPrice(breakoutLevel)} ` +
          `(${formatPercent(breakoutPercent)}) or a cleaner pullback into support.`,
        invalidation:
          `Avoid adding extra if price breaks below ${formatPrice(stopReference)}.`,
        text:
          `No clear extra-buy edge yet. Confirmation improves above ${formatPrice(breakoutLevel)}; risk increases below ${formatPrice(stopReference)}.`,
      };
    }

    return {
      label: "Wait",
      zone: null,
      trigger: "Wait for trend, MACD and volume to align before adding extra cash.",
      invalidation:
        `Avoid adding extra if price breaks below ${formatPrice(stopReference)}.`,
      text: "No clear extra-buy estimate because the model is mixed.",
    };
  }

  return {
    label: "Avoid extra entry",
    zone: null,
    trigger:
      "Avoid adding extra cash until price recovers above short-term moving averages and MACD improves.",
    invalidation:
      "A recovery above moving averages plus positive MACD would improve the technical picture.",
    text: "The model is not supportive of adding extra cash right now.",
  };
}

function buildExtraInvestmentSuggestion({
  market,
  signal,
  confidence,
  entry,
  risk,
  regime,
  rsiAnalysis,
  trendAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  entryEstimate,
}) {
  const apiSymbol = market?.apiSymbol || "";

  const isCoreFund = ["SPY", "VT"].includes(apiSymbol);
  const isHigherRiskFund = ["QQQ", "EEM"].includes(apiSymbol);

  const bullishSignal = signal === SIGNALS.strongBuy || signal === SIGNALS.buy;
  const neutralSignal = signal === SIGNALS.hold;
  const bearishSignal = signal === SIGNALS.sell || signal === SIGNALS.strongSell;

  const stretched =
    rsiAnalysis?.state?.includes("overbought") ||
    entry?.label === "Wait" ||
    entry?.label === "Poor" ||
    entryEstimate?.label?.includes("Pullback");

  const highRisk =
    risk?.score >= 65 ||
    volatilityAnalysis?.state === "very high";

  // Whether the asset has good long-term fundamentals regardless of today’s signal
  const goodLongTermAsset =
    isCoreFund &&
    (trendAnalysis?.score ?? 0) >= 60 &&
    (regime?.score ?? 0) >= 55;

  let verdict = "Do not add extra today";
  let suggestionTone = "neutral";
  let extraAction = "I would not add extra cash today.";
  let suggestedExtraPercent = 0;

  if (bullishSignal && !stretched && !highRisk && (confidence?.score ?? 0) >= 65) {
    verdict = "Extra investment is reasonable today";
    suggestionTone = "positive";
    suggestedExtraPercent = isHigherRiskFund ? 25 : 40;
    extraAction =
      `I would consider investing a small-to-medium extra amount today, around ${suggestedExtraPercent}% of the spare cash you were thinking of adding.`;
  } else if (bullishSignal && stretched) {
    verdict = "Do not chase with extra money";
    suggestionTone = "neutral";
    suggestedExtraPercent = 0;
    extraAction =
      "I would not add extra cash today because the entry looks stretched.";
  } else if (bullishSignal && highRisk) {
    verdict = "Only a very small extra entry";
    suggestionTone = "neutral";
    suggestedExtraPercent = isHigherRiskFund ? 10 : 20;
    extraAction =
      `I would only consider a small extra amount, around ${suggestedExtraPercent}% of spare cash, because risk is elevated.`;
  } else if (neutralSignal && goodLongTermAsset) {
    verdict = "No extra today";
    suggestionTone = "neutral";
    suggestedExtraPercent = 0;
    extraAction =
      "I would wait before adding extra money because the setup is not strong enough.";
  } else if (neutralSignal) {
    verdict = "Wait before adding extra";
    suggestionTone = "neutral";
    suggestedExtraPercent = 0;
    extraAction =
      "The setup is mixed, so I would keep extra cash aside.";
  } else if (bearishSignal && goodLongTermAsset) {
    verdict = "No extra today";
    suggestionTone = "negative";
    suggestedExtraPercent = 0;
    extraAction =
      "The long-term case may still be fine, but today’s signal is not attractive enough for extra money.";
  } else {
    verdict = "Avoid extra investment today";
    suggestionTone = "negative";
    suggestedExtraPercent = 0;
    extraAction =
      "I would not add extra cash today. The technical setup is not strong enough.";
  }

  let entryText = "";

  if (typeof entryEstimate?.zone?.percentFromNow === "number" && entryEstimate.zone.percentFromNow < 0) {
    entryText =
      `A better extra-buy zone is roughly ${Math.abs(entryEstimate.zone.percentFromNow).toFixed(2)}% lower.`;
  } else if (typeof entryEstimate?.zone?.percentFromNow === "number" && entryEstimate.zone.percentFromNow > 0) {
    entryText =
      `A better confirmation zone is roughly +${entryEstimate.zone.percentFromNow.toFixed(2)}% higher with volume confirmation.`;
  } else {
    entryText = "There is no clear discount entry zone right now.";
  }

  let reason = "";

  if (bullishSignal && stretched) {
    reason =
      "The fund may still be bullish, but the current price is not attractive enough to justify extra cash.";
  } else if (bullishSignal && highRisk) {
    reason =
      "The signal is constructive, but risk is high enough that extra buying should be limited.";
  } else if (bullishSignal) {
    reason =
      "Trend, momentum and regime are aligned enough to justify considering extra exposure.";
  } else if (neutralSignal) {
    reason =
      "The model does not show enough edge to justify adding extra money today.";
  } else {
    reason =
      "The model is defensive, so extra cash should wait for a cleaner setup.";
  }

  const oneLine = `${verdict}: ${extraAction} ${entryText}`;

  return {
    verdict,
    tone: suggestionTone,
    suggestedExtraPercent,
    oneLine,
    reason,
    entryText,
  };
}

function buildReasons({
  trendAnalysis,
  rsiAnalysis,
  macdAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  swingStructure,
  overextension,
  regime,
  assetProfile,
  timeframeProfile,
  entryEstimate,
  adxAnalysis,
  bbAnalysis,
  stochAnalysis,
  obvAnalysis,
  momentumAnalysis,
  divergenceSignal,
}) {
  const reasons = [
    trendAnalysis.message,
    adxAnalysis?.message,
    swingStructure.message,
    macdAnalysis.message,
    momentumAnalysis?.message,
    rsiAnalysis.message,
    bbAnalysis?.message,
    stochAnalysis?.message,
    volumeAnalysis.message,
    obvAnalysis?.message,
    volatilityAnalysis.message,
    overextension.flags.length
      ? `Overextension flag: ${overextension.flags[0]}.`
      : "No major overextension flag from price distance.",
    divergenceSignal && divergenceSignal !== "none"
      ? `${divergenceSignal === "bearish" ? "Bearish" : "Bullish"} RSI-price divergence detected — treat as a reversal warning.`
      : null,
    `Current inferred regime is ${regime.stance}.`,
    `The asset behaves like a ${assetProfile.name}, with ${assetProfile.sensitivity}.`,
    timeframeProfile.note,
    entryEstimate?.text,
  ];

  return [...new Set(reasons)].filter(Boolean).slice(0, 10);
}

function buildActionPlan({
  signal,
  entry,
  risk,
  rsiAnalysis,
  trendAnalysis,
  regime,
  entryEstimate,
}) {
  if (signal === SIGNALS.strongBuy || signal === SIGNALS.buy) {
    const shouldWait =
      entry.score < 60 ||
      rsiAnalysis.state.includes("overbought") ||
      entryEstimate?.label?.includes("Pullback");

    return {
      primary: shouldWait
        ? "Bullish bias, but avoid chasing"
        : "Bullish bias with acceptable entry quality",
      entry:
        entryEstimate?.trigger ||
        (shouldWait
          ? "Prefer a pullback, consolidation, or renewed volume confirmation before adding aggressively."
          : "Scaling in gradually is more sensible than entering the full position at once."),
      invalidation:
        entryEstimate?.invalidation ||
        (trendAnalysis.score >= 60
          ? "Reassess if price loses key moving-average support or MACD turns negative."
          : "Reassess quickly if the trend score fails to improve."),
      sizing:
        risk.score >= 70
          ? "Use smaller position size because risk is elevated."
          : "Normal position sizing may be acceptable if it fits the user risk profile.",
    };
  }

  if (signal === SIGNALS.hold) {
    return {
      primary: "No clear edge",
      entry:
        entryEstimate?.trigger ||
        "Wait for either a confirmed breakout with volume or a cleaner pullback entry.",
      invalidation:
        entryEstimate?.invalidation ||
        "A strong break below moving averages would turn the setup defensive.",
      sizing: "Avoid increasing exposure until the model shows stronger alignment.",
    };
  }

  return {
    primary: regime.stance === "risk-off" ? "Defensive bias" : "Weak technical setup",
    entry:
      entryEstimate?.trigger ||
      "Avoid new long exposure until trend and momentum repair.",
    invalidation:
      entryEstimate?.invalidation ||
      "A recovery above moving averages plus positive MACD would improve the setup.",
    sizing: "Reduce tactical risk or stay in cash until confirmation improves.",
  };
}

function buildInsight({
  market,
  timeframe,
  signal,
  finalScore,
  confidence,
  entry,
  risk,
  reasons,
  actionPlan,
  regime,
  entryEstimate,
}) {
  const name = market?.symbol || "This market";
  const topReason = reasons[0] || "Data quality is still limited.";

  let stance = "Wait for confirmation";

  if (signal === SIGNALS.strongBuy) {
    stance = entry.score < 65
      ? "Strong trend, stretched entry"
      : "High-quality bullish setup";
  } else if (signal === SIGNALS.buy) {
    stance = entry.score < 60
      ? "Bullish, but wait for entry"
      : "Constructive bullish setup";
  } else if (signal === SIGNALS.hold) {
    stance = "Mixed setup";
  } else if (signal === SIGNALS.sell) {
    stance = "Defensive setup";
  } else {
    stance = "High-risk bearish setup";
  }

  const entrySentence = entryEstimate?.text ? ` ${entryEstimate.text}` : "";

  return {
    title: "Decision engine",
    stance,
    body:
      `${name} scores ${round(finalScore)}/100 on the ${timeframe} view. ` +
      `${actionPlan.primary}. ${topReason}${entrySentence}`,
    risk: `${risk.label} risk · ${confidence.label} · ${regime.stance}`,
  };
}

function buildFactors({
  trendAnalysis,
  swingStructure,
  rsiAnalysis,
  macdAnalysis,
  volumeAnalysis,
  volatilityAnalysis,
  overextension,
  entry,
  risk,
  confidence,
  regime,
  adxAnalysis,
  bbAnalysis,
  stochAnalysis,
  obvAnalysis,
  momentumAnalysis,
}) {
  return [
    { label: "Trend", value: round(trendAnalysis.score), note: trendAnalysis.state },
    { label: "ADX", value: round(adxAnalysis.score), note: adxAnalysis.strength },
    { label: "Structure", value: round(swingStructure.score), note: swingStructure.state },
    { label: "MACD", value: round(macdAnalysis.score), note: macdAnalysis.state },
    { label: "Momentum", value: round(momentumAnalysis.score), note: momentumAnalysis.state },
    { label: "RSI", value: round(rsiAnalysis.score), note: rsiAnalysis.state },
    { label: "Stoch", value: round(stochAnalysis.score), note: stochAnalysis.state },
    { label: "BB", value: round(bbAnalysis.score), note: bbAnalysis.state },
    { label: "Volume", value: round(volumeAnalysis.score), note: volumeAnalysis.state },
    { label: "OBV", value: round(obvAnalysis.score), note: obvAnalysis.state },
    { label: "Volatility", value: round(volatilityAnalysis.score), note: volatilityAnalysis.state },
    { label: "Extension", value: 100 - round(overextension.score), note: overextension.level },
    { label: "Entry", value: entry.score, note: entry.label },
    { label: "Risk", value: 100 - risk.score, note: `${risk.label} risk` },
    { label: "Regime", value: round(regime.score), note: regime.stance },
    { label: "Confidence", value: confidence.score, note: confidence.label },
  ];
}

export function buildDecision({ market, timeframe = "1D", news = null, macro = null }) {
  const indicators = market?.indicators;

  if (!indicators) {
    return {
      score: 50,
      signal: SIGNALS.hold,
      confidence: 15,
      confidenceLabel: "Very low confidence",
      micro: "Waiting for enough candle data",
      entry: { score: 30, label: "Wait" },
      risk: { score: 55, label: "Moderate" },
      regime: { score: 50, stance: "unknown" },
      factors: [],
      reasons: [
        "The model needs candles before it can calculate trend, RSI, MACD, volume and volatility.",
      ],
      actionPlan: {
        primary: "Waiting for data",
        entry: "Load market data first.",
        invalidation: "Not available yet.",
        sizing: "Do not act on incomplete data.",
      },
      insight: {
        title: "Decision engine",
        stance: "Waiting",
        body:
          "Load more candle data before acting. The model needs enough history to calculate RSI, MACD, trend, volume and volatility properly.",
        risk: "Very low confidence",
      },
      extraInvestmentSuggestion: {
        verdict: "No extra investment yet",
        tone: "neutral",
        oneLine: "No extra investment yet: wait for market data before adding extra cash.",
        suggestedExtraPercent: 0,
      },
      diagnostics: {
        technicalBase: 50,
        riskDrag: 0,
        lowConfidenceDrag: 0,
        overextensionDrag: 0,
        newsScore: 50,
        macroScore: 50,
        atr: null,
        atrPercent: null,
        entryEstimate: null,
      },
    };
  }

  const assetProfile = getAssetProfile(market);
  const timeframeProfile = getTimeframeProfile(timeframe);
  const priceChange = safeNumber(market?.rawChange, 0);
  const { candles } = getCandleArrays(market);
  const latest = getLatestCandle(market);
  const latestPrice = Number(latest?.close ?? market?.rawPrice);

  const atr = calculateATR(candles, 14);
  const atrPercent =
    Number.isFinite(atr) && Number.isFinite(latestPrice) && latestPrice > 0
      ? (atr / latestPrice) * 100
      : null;

  const trendAnalysis = analyseTrend(indicators, market);
  const swingStructure = analyseSwingStructure(candles);
  const rsiAnalysis = analyseRsi(indicators.rsi, trendAnalysis.score);
  const macdAnalysis = analyseMacd(indicators.macd, market);
  const volumeAnalysis = analyseVolume(indicators.volumeTrend, priceChange, market);
  const volatilityAnalysis = analyseVolatility(indicators.volatility, atrPercent);
  const overextension = detectOverextension({ market, indicators, atrPercent });
  const bbAnalysis = analyseBollingerBands(indicators.bb, latestPrice);
  const adxAnalysis = analyseADX(indicators.adx);
  const stochAnalysis = analyseStochastic(indicators.stoch);
  const obvAnalysis = analyseOBV(indicators.obvTrend, priceChange);
  const momentumAnalysis = analyseMomentum(indicators.roc5, indicators.roc14);
  const divergenceSignal = indicators.divergence || "none";
  const divergenceAdjustment = divergenceSignal === "bearish" ? -14 : divergenceSignal === "bullish" ? 10 : 0;

  const regime = inferMarketRegime({
    trendAnalysis,
    macdAnalysis,
    rsiAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    swingStructure,
    adxAnalysis,
    momentumAnalysis,
  });

  const entry = calculateEntryQuality({
    trendAnalysis,
    rsiAnalysis,
    macdAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    swingStructure,
    overextension,
    priceChange,
    adxAnalysis,
    bbAnalysis,
    stochAnalysis,
  });

  const risk = calculateRiskScore({
    rsiAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    trendAnalysis,
    swingStructure,
    overextension,
    assetProfile,
    timeframeProfile,
    market,
    adxAnalysis,
    bbAnalysis,
  });

  const confidence = calculateConfidence({
    market,
    indicators,
    trendAnalysis,
    rsiAnalysis,
    macdAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    swingStructure,
    timeframeProfile,
    adxAnalysis,
    stochAnalysis,
    momentumAnalysis,
  });

  const technicalBase = safeNumber(indicators.score, market?.score ?? 50);
  const newsScore = news?.score ?? 50;
  const macroScore = macro?.score ?? 50;

  let finalScore =
    technicalBase * 0.10 +
    trendAnalysis.score * 0.14 +
    adxAnalysis.score * 0.08 +
    swingStructure.score * 0.08 +
    macdAnalysis.score * 0.10 +
    momentumAnalysis.score * 0.06 +
    rsiAnalysis.score * 0.07 +
    bbAnalysis.score * 0.06 +
    stochAnalysis.score * 0.05 +
    volumeAnalysis.score * 0.05 +
    obvAnalysis.score * 0.05 +
    volatilityAnalysis.score * 0.05 +
    entry.score * 0.06 +
    regime.score * 0.03 +
    assetProfile.qualityAdjustment +
    newsScore * 0.01 +
    macroScore * 0.01;

  const riskDrag = Math.max(0, risk.score - 55) * 0.28;
  const lowConfidenceDrag = Math.max(0, 52 - confidence.score) * 0.20;
  const overextensionDrag = Math.max(0, overextension.score - 65) * 0.18;

  finalScore = finalScore - riskDrag - lowConfidenceDrag - overextensionDrag + divergenceAdjustment;

  if (rsiAnalysis.state === "extremely overbought" && finalScore > 76) finalScore = 76;
  if (rsiAnalysis.state === "overbought" && entry.score < 55 && finalScore > 72) finalScore = 72;
  if (volumeAnalysis.state === "very low participation" && finalScore > 72) finalScore = 72;
  if (volatilityAnalysis.state === "very high" && finalScore > 66) finalScore = 66;
  if (adxAnalysis.trending && !adxAnalysis.bullish && finalScore > 55) finalScore = 55;
  if (bbAnalysis.state === "above upper band" && finalScore > 70) finalScore = 70;
  if (divergenceSignal === "bearish" && finalScore > 68) finalScore = 68;
  if (confidence.score < 35 && finalScore > 58) finalScore = 58;
  if (trendAnalysis.score < 40 && finalScore > 55) finalScore = 55;
  if (swingStructure.score < 35 && finalScore > 52) finalScore = 52;

  finalScore = clamp(finalScore, 1, 99);
  const signal = scoreToSignal(finalScore);

  const entryEstimate = getEntryEstimate({
    market,
    indicators,
    timeframeProfile,
    signal,
    rsiAnalysis,
    volumeAnalysis,
    entry,
    regime,
  });

  const extraInvestmentSuggestion = buildExtraInvestmentSuggestion({
    market,
    signal,
    confidence,
    entry,
    risk,
    regime,
    rsiAnalysis,
    trendAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    entryEstimate,
  });

  const reasons = buildReasons({
    trendAnalysis,
    rsiAnalysis,
    macdAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    swingStructure,
    overextension,
    regime,
    assetProfile,
    timeframeProfile,
    entryEstimate,
    adxAnalysis,
    bbAnalysis,
    stochAnalysis,
    obvAnalysis,
    momentumAnalysis,
    divergenceSignal,
  });

  const actionPlan = buildActionPlan({
    signal,
    entry,
    risk,
    rsiAnalysis,
    trendAnalysis,
    regime,
    entryEstimate,
  });

  const insight = buildInsight({
    market,
    timeframe,
    signal,
    finalScore,
    confidence,
    entry,
    risk,
    reasons,
    actionPlan,
    regime,
    entryEstimate,
  });

  const factors = buildFactors({
    trendAnalysis,
    swingStructure,
    rsiAnalysis,
    macdAnalysis,
    volumeAnalysis,
    volatilityAnalysis,
    overextension,
    entry,
    risk,
    confidence,
    regime,
    adxAnalysis,
    bbAnalysis,
    stochAnalysis,
    obvAnalysis,
    momentumAnalysis,
  });

  const micro = `${confidence.label} · Entry: ${entry.label} · Risk: ${risk.label}`;

  return {
    score: round(finalScore),
    signal,
    confidence: confidence.score,
    confidenceLabel: confidence.label,
    micro,
    entry,
    risk,
    regime,
    factors,
    reasons,
    actionPlan,
    insight,
    extraInvestmentSuggestion,
    diagnostics: {
      technicalBase: round(technicalBase),
      riskDrag: Math.round(riskDrag * 10) / 10,
      lowConfidenceDrag: Math.round(lowConfidenceDrag * 10) / 10,
      overextensionDrag: Math.round(overextensionDrag * 10) / 10,
      newsScore,
      macroScore,
      atr: Number.isFinite(atr) ? roundTo(atr, 4) : null,
      atrPercent: Number.isFinite(atrPercent) ? roundTo(atrPercent, 2) : null,
      entryEstimate,
    },
  };
}