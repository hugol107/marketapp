import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

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
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        max_tokens: 1400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[NVIDIA] status:", response.status, "body:", JSON.stringify(data));
      return res.status(response.status).json({ error: data?.detail || data?.message || data?.error || "NVIDIA API error" });
    }

    res.json({ text: data.choices?.[0]?.message?.content || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
