import { emaSeries } from "../lib/marketAnalysis";

// How many candles back each label covers (matches intervalMap candle sizes)
const PERIOD_WINDOW = { "1D": 1, "1W": 1, "1M": 21, "3M": 63, "1Y": 12, "All": 0 };

export default function Chart({ chart, direction, timeframe = "1D" }) {
  const points = chart.length >= 2 ? chart : [10, 12, 11, 15, 14, 18, 17, 20, 18, 22, 21, 24, 23];

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 360;
  const H = 140;

  function toX(i) { return (i / (points.length - 1)) * W; }
  function toY(v) { return H - 18 - ((v - min) / range) * 95; }

  const coords = points.map((v, i) => [toX(i), toY(v)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${W} ${H} L0 ${H} Z`;
  const color = points[points.length - 1] >= points[0] ? "#18e28a" : "#ff4d6d";

  // EMA20 overlay — only when enough data
  let ema20Path = null;
  if (points.length >= 20) {
    const series = emaSeries(points, 20);
    const offset = points.length - series.length;
    const emaCoords = series.map((v, i) => [toX(i + offset), toY(v)]);
    ema20Path = emaCoords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  }

  // Period return — scoped to the selected timeframe, not the full candle history
  const n = PERIOD_WINDOW[timeframe] ?? 0;
  const fromIdx = n === 0 ? 0 : Math.max(0, points.length - 1 - n);
  const periodReturn = points.length >= 2
    ? ((points[points.length - 1] - points[fromIdx]) / points[fromIdx] * 100).toFixed(2)
    : null;

  // Last point for live dot
  const [dotX, dotY] = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#chartFill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {ema20Path && (
        <path
          d={ema20Path}
          fill="none"
          stroke="rgba(203,213,225,0.38)"
          strokeWidth="1.4"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}

      {/* Animated live dot */}
      <circle cx={dotX} cy={dotY} r="6" fill={color} opacity="0.18" className="chart-dot-glow" />
      <circle cx={dotX} cy={dotY} r="3.2" fill={color} className="chart-dot" />

      {/* Period return label */}
      {periodReturn !== null && (
        <text
          x="8" y="18"
          fill={color}
          fontSize="11"
          fontWeight="900"
          fontFamily="Inter, ui-sans-serif, sans-serif"
          opacity="0.9"
        >
          {Number(periodReturn) >= 0 ? "+" : ""}{periodReturn}%
        </text>
      )}

      {/* EMA20 legend */}
      {ema20Path && (
        <text
          x={W - 4} y={H - 5}
          fill="rgba(148,163,184,0.55)"
          fontSize="9"
          fontWeight="700"
          fontFamily="Inter, ui-sans-serif, sans-serif"
          textAnchor="end"
        >
          EMA20
        </text>
      )}
    </svg>
  );
}
