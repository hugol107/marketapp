import { useRef, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { fetchClaudeAnalysis } from "../services/claudeService";
import { buildMarketContext, parseAnalysisResponse, SYSTEM_PROMPT } from "../lib/claudePrompt";

export default function ClaudePanel({ market, decision, timeframe }) {
  const [phase, setPhase] = useState("idle"); // idle | thinking | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const cooldownRef = useRef(0);

  async function runAnalysis() {
    const now = Date.now();
    if (now - cooldownRef.current < 30_000) return;
    cooldownRef.current = now;

    setPhase("thinking");
    setResult(null);
    setErrorMsg("");

    await fetchClaudeAnalysis({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: buildMarketContext(market, decision, timeframe),
      onDone: (text) => {
        setResult(parseAnalysisResponse(text));
        setPhase("done");
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setPhase("error");
      },
    });
  }

  if (phase === "idle") {
    return (
      <div className="claude-panel claude-idle">
        <button className="claude-trigger" onClick={runAnalysis}>
          <Sparkles size={15} />
          Ask AI — should I add more?
        </button>
      </div>
    );
  }

  if (phase === "thinking") {
    return (
      <div className="claude-panel claude-thinking">
        <div className="claude-panel-head">
          <span><Sparkles size={12} /> AI Analysis</span>
        </div>
        <div className="claude-dots">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="claude-panel claude-error">
        <AlertCircle size={15} />
        <span>{errorMsg}</span>
        <button onClick={runAnalysis}>
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="claude-panel claude-done">
        <div className="claude-panel-head">
          <span><Sparkles size={12} /> AI Analysis</span>
          <button onClick={runAnalysis} title="Refresh analysis">
            <RefreshCw size={12} />
          </button>
        </div>

        <div className={`claude-verdict ${result.verdictTone}`}>
          {result.verdict}
          {result.confidence && <small>{result.confidence} confidence</small>}
        </div>

        {result.reasons.length > 0 && (
          <div className="claude-reasons">
            {result.reasons.map((r, i) => (
              <div key={i} className="claude-reason">{r}</div>
            ))}
          </div>
        )}

        {result.entry && (
          <div className="claude-meta">
            <span>Entry</span>
            <p>{result.entry}</p>
          </div>
        )}

        {result.risk && (
          <div className="claude-meta">
            <span>Risk</span>
            <p>{result.risk}</p>
          </div>
        )}

        {result.analysis && (
          <div className="claude-analysis">
            {result.analysis}
          </div>
        )}
      </div>
    );
  }

  return null;
}
