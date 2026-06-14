import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

app.get("/api/market-data", async (req, res) => {
  const params = new URLSearchParams(req.query);
  const endpoint = params.get("endpoint") || "quote";
  params.delete("endpoint");
  params.set("apikey", process.env.TWELVE_DATA_API_KEY);

  try {
    const response = await fetch(`${TWELVE_DATA_BASE}/${endpoint}?${params.toString()}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/claude-proxy", async (req, res) => {
  const { systemPrompt, userMessage } = req.body;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        stream: false,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Claude API error" });
    }

    res.json({ text: data.content?.[0]?.text || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
