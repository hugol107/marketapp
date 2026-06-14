import { useRef, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { streamClaudeAnalysis } from "../services/claudeService";
import { buildMarketContext, parseAnalysisResponse, SYSTEM_PROMPT } from "../lib/claudePrompt";

export default function ClaudePanel({ market, decision, timeframe, claudeApiKey, onSaveKey }) {
  const [phase, setPhase] = useState("idle"); // idle | key-entry | thinking | done | error
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const cooldownRef = useRef(0);

  async function runAnalysis(key) {
    const now = Date.now();
    if (now - cooldownRef.current < 30_000) return;
    cooldownRef.current = now;

    setPhase("thinking");
    setStreamText("");
    setResult(null);
    setErrorMsg("");

    await streamClaudeAnalysis({
      apiKey: key,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: buildMarketContext(market, decision, timeframe),
      onChunk: (text) => setStreamText(text),
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

  function handleTrigger() {
    if (!claudeApiKey) {
      setPhase("key-entry");
      return;
    }
    runAnalysis(claudeApiKey);
  }

  function handleSaveAndRun() {
    const clean = keyInput.trim();
    if (!clean) return;
    onSaveKey(clean);
    setKeyInput("");
    runAnalysis(clean);
  }

  if (phase === "idle") {
    return (
      <div className="claude-panel claude-idle">
        <button className="claude-trigger" onClick={handleTrigger}>
          <Sparkles size={15} />
          Ask AI — should I add more?
        </button>
      </div>
    );
  }

  if (phase === "key-entry") {
    return (
      <div className="claude-panel claude-key-entry">
        <p>Enter your Anthropic API key to enable AI analysis</p>
        <div className="claude-key-row">
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveAndRun()}
            placeholder="sk-ant-..."
            type="password"
            autoFocus
          />
          <button onClick={handleSaveAndRun}>Connect</button>
        </div>
        <small>Get yours at <b>console.anthropic.com</b> · Stored locally only</small>
      </div>
    );
  }

  if (phase === "thinking") {
    return (
      <div className="claude-panel claude-thinking">
        <div className="claude-panel-head">
          <span><Sparkles size={12} /> AI Analysis</span>
        </div>
        {streamText ? (
          <div className="claude-stream">
            {streamText}<span className="claude-cursor">▎</span>
          </div>
        ) : (
          <div className="claude-dots">
            <span /><span /><span />
          </div>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="claude-panel claude-error">
        <AlertCircle size={15} />
        <span>{errorMsg}</span>
        <button onClick={() => claudeApiKey ? runAnalysis(claudeApiKey) : setPhase("key-entry")}>
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
          <button onClick={() => runAnalysis(claudeApiKey)} title="Refresh analysis">
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
      </div>
    );
  }

  return null;
}
