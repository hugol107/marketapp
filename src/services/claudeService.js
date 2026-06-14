const API_BASE = import.meta.env.VITE_API_URL || "";

export async function fetchClaudeAnalysis({ systemPrompt, userMessage, onDone, onError }) {
  try {
    const res = await fetch(`${API_BASE}/api/claude-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, userMessage }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    onDone(data.text || "");
  } catch (err) {
    onError(err.message || "Analysis failed. Try again.");
  }
}
