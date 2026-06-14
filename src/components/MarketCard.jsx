import { ArrowLeft, ArrowRight, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { tone } from "../lib/formatters";

function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 88;
  const H = 30;
  const coords = points.map((v, i) => [
    (i / (points.length - 1)) * W,
    H - ((v - min) / range) * H * 0.85 - H * 0.08,
  ]);
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="card-sparkline"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "#18e28a" : "#ff4d6d"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function stop(action) {
  return (event) => {
    event.stopPropagation();
    action();
  };
}

export default function MarketCard({ market, signal, layoutItem, active, editMode, index, total, onClick, onMove, onSize, onHide }) {
  const nextSize = layoutItem.size === "s" ? "m" : layoutItem.size === "m" ? "l" : "s";
  const sizeLabel = layoutItem.size === "s" ? "Small" : layoutItem.size === "m" ? "Medium" : "Large";

  return (
    <button
      onClick={onClick}
      className={`market-card size-${layoutItem.size} ${active ? "active" : ""} ${market.accent} ${editMode ? "editing" : ""}`}
    >
      {editMode && (
        <div className="edit-bubble">
          <button title="Move left" disabled={index === 0} onClick={stop(() => onMove(-1))}><ArrowLeft size={14} /></button>
          <button title="Resize" onClick={stop(() => onSize(nextSize))}>{layoutItem.size === "l" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          <button title="Hide" onClick={stop(onHide)}><EyeOff size={14} /></button>
          <button title="Move right" disabled={index === total - 1} onClick={stop(() => onMove(1))}><ArrowRight size={14} /></button>
        </div>
      )}

      <div>
        <div className="card-topline">
          <span className="market-symbol">
            {market.symbol}
            <span className="market-ticker"> · {market.apiSymbol}</span>
          </span>
          <span className="market-tag">{market.tag}</span>
        </div>
        <div className="market-price">{market.price}</div>
      </div>

      <Sparkline points={market.chart} />

      <div className="card-bottomline">
        <span className={`pill ${tone(market.change)}`}>{market.change}</span>
        <span className={`signal ${tone(signal)}`}>{signal}</span>
      </div>

      {editMode && <span className="size-chip">{sizeLabel}</span>}
    </button>
  );
}
