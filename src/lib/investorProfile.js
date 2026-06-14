export const investorQuestions = [
  {
    id: "age",
    title: "How old are you?",
    subtitle: "Age helps estimate your time horizon and ability to recover from market drops.",
    options: [
      { label: "Under 25", score: 5 },
      { label: "25–34", score: 5 },
      { label: "35–44", score: 4 },
      { label: "45–54", score: 3 },
      { label: "55+", score: 2 },
    ],
  },
  {
    id: "horizon",
    title: "When do you need this money?",
    subtitle: "Longer time horizons usually allow more risk.",
    options: [
      { label: "Less than 1 year", score: 1 },
      { label: "1–3 years", score: 2 },
      { label: "3–7 years", score: 3 },
      { label: "7–15 years", score: 4 },
      { label: "15+ years", score: 5 },
    ],
  },
  {
    id: "goal",
    title: "What is your main goal?",
    subtitle: "This helps separate capital preservation, growth, income, and speculation.",
    options: [
      { label: "Protect my savings", score: 1 },
      { label: "Steady long-term growth", score: 3 },
      { label: "Build wealth aggressively", score: 5 },
      { label: "Generate passive income", score: 2 },
      { label: "Find high-upside opportunities", score: 5 },
    ],
  },
  {
    id: "drop",
    title: "Your portfolio falls 20%. What do you do?",
    subtitle: "Your emotional reaction to losses is one of the biggest risk indicators.",
    options: [
      { label: "Sell immediately", score: 1 },
      { label: "Sell part of it", score: 2 },
      { label: "Do nothing", score: 3 },
      { label: "Buy more gradually", score: 4 },
      { label: "Buy aggressively", score: 5 },
    ],
  },
  {
    id: "experience",
    title: "How much investing experience do you have?",
    subtitle: "More experience may allow more complex products, but only with discipline.",
    options: [
      { label: "None", score: 1 },
      { label: "A little", score: 2 },
      { label: "A few years", score: 3 },
      { label: "Experienced", score: 4 },
      { label: "Very experienced", score: 5 },
    ],
  },
  {
    id: "income",
    title: "How stable is your income?",
    subtitle: "Stable income can make market volatility easier to handle.",
    options: [
      { label: "Unstable", score: 1 },
      { label: "Somewhat unstable", score: 2 },
      { label: "Stable", score: 3 },
      { label: "Very stable", score: 4 },
      { label: "High and very stable", score: 5 },
    ],
  },
  {
    id: "emergency",
    title: "Do you have an emergency fund?",
    subtitle: "Investing is riskier if you may need the money suddenly.",
    options: [
      { label: "No", score: 1 },
      { label: "Less than 1 month", score: 2 },
      { label: "1–3 months", score: 3 },
      { label: "3–6 months", score: 4 },
      { label: "6+ months", score: 5 },
    ],
  },
  {
    id: "style",
    title: "Which style sounds most like you?",
    subtitle: "This helps recommend broad funds, factor ETFs, or more active ideas.",
    options: [
      { label: "Simple global ETF portfolio", score: 2 },
      { label: "Balanced ETFs and quality stocks", score: 3 },
      { label: "Growth and technology exposure", score: 4 },
      { label: "High-risk tactical opportunities", score: 5 },
      { label: "Income and lower volatility", score: 2 },
    ],
  },
  {
    id: "drawdown",
    title: "What yearly loss could you tolerate?",
    subtitle: "Higher tolerated drawdown means higher risk capacity.",
    options: [
      { label: "0–5%", score: 1 },
      { label: "5–10%", score: 2 },
      { label: "10–20%", score: 3 },
      { label: "20–35%", score: 4 },
      { label: "35%+", score: 5 },
    ],
  },
  {
    id: "amount",
    title: "How much are you planning to invest initially?",
    subtitle: "This does not drive your risk profile, but it helps translate the portfolio pie into real money amounts.",
    options: [
      { label: "Under £1,000", score: 3, amount: 750 },
      { label: "£1,000–£5,000", score: 3, amount: 3000 },
      { label: "£5,000–£20,000", score: 3, amount: 12500 },
      { label: "£20,000–£100,000", score: 3, amount: 50000 },
      { label: "£100,000+", score: 3, amount: 100000 },
    ],
  },
  {
    id: "leverage",
    title: "How do you feel about leverage?",
    subtitle: "Leverage can multiply gains, but also losses. It is not suitable for everyone.",
    options: [
      { label: "Avoid completely", score: 1 },
      { label: "Only understand it", score: 2 },
      { label: "Maybe small tactical use", score: 3 },
      { label: "Comfortable with strict limits", score: 4 },
      { label: "Actively interested", score: 5 },
    ],
  },
];

export function getInvestorProfile(answers) {
  const riskQuestionIds = investorQuestions
    .filter((q) => q.id !== "amount")
    .map((q) => q.id);
  const answered = Object.entries(answers)
    .filter(([id]) => riskQuestionIds.includes(id))
    .map(([, item]) => item);
  const total = answered.reduce((sum, item) => sum + item.score, 0);
  const max = riskQuestionIds.length * 5;
  const score = answered.length ? Math.round((total / max) * 100) : 0;

  if (score < 35) {
    return {
      name: "Defensive Investor",
      score,
      risk: "Low risk",
      allocation: "Capital protection first: cash, short-duration bonds, conservative income funds, and small diversified equity exposure.",
      ideas: ["Money-market funds", "Short-term bond ETFs", "Dividend-quality funds", "Small global ETF allocation"],
      recommendationGroups: [
        {
          title: "Core funds",
          items: [
            { ticker: "SGOV / BIL", name: "Short Treasury bill ETFs", why: "Cash-like parking area with lower price volatility." },
            { ticker: "SHY / VGSH", name: "Short-term Treasury ETFs", why: "Lower duration bond exposure for conservative investors." },
            { ticker: "BND / AGG", name: "Broad bond ETFs", why: "Diversified fixed-income core." },
            { ticker: "VT / ACWI", name: "Small global equity allocation", why: "Broad market exposure without single-stock concentration." },
          ],
        },
        {
          title: "Stock watchlist",
          items: [
            { ticker: "JNJ", name: "Johnson & Johnson", why: "Defensive healthcare exposure." },
            { ticker: "PG", name: "Procter & Gamble", why: "Consumer staples profile with resilient demand." },
            { ticker: "KO", name: "Coca-Cola", why: "Defensive global consumer brand." },
            { ticker: "BRK.B", name: "Berkshire Hathaway", why: "Diversified holding company, less single-product risk." },
          ],
        },
        {
          title: "Avoid / limit",
          items: [
            { ticker: "2x / 3x ETFs", name: "Leveraged ETFs", why: "Usually unsuitable for low-risk profiles." },
            { ticker: "Small caps", name: "Speculative single stocks", why: "Higher volatility and drawdown risk." },
          ],
        },
      ],
      note: "Focus on protecting capital first. Avoid leverage and avoid concentrated single-stock positions.",
    };
  }

  if (score < 60) {
    return {
      name: "Balanced Investor",
      score,
      risk: "Medium risk",
      allocation: "A diversified ETF core with some bonds and selective quality equity exposure.",
      ideas: ["All World ETF", "S&P 500 ETF", "Investment-grade bond ETF", "Quality/dividend ETF"],
      recommendationGroups: [
        {
          title: "Core funds",
          items: [
            { ticker: "VT / ACWI", name: "Global all-world equity ETF", why: "One-fund global diversification." },
            { ticker: "VOO / IVV / SPY", name: "S&P 500 ETF", why: "Large-cap US core exposure." },
            { ticker: "BND / AGG", name: "Broad bond ETF", why: "Balances equity volatility." },
            { ticker: "SCHD / VIG", name: "Dividend quality ETF", why: "Quality/income tilt without only chasing growth." },
          ],
        },
        {
          title: "Stock watchlist",
          items: [
            { ticker: "MSFT", name: "Microsoft", why: "Quality mega-cap with cloud/software exposure." },
            { ticker: "AAPL", name: "Apple", why: "Large-cap consumer technology exposure." },
            { ticker: "BRK.B", name: "Berkshire Hathaway", why: "Diversified business exposure." },
            { ticker: "COST", name: "Costco", why: "Quality retail compounder profile." },
          ],
        },
        {
          title: "Satellite ideas",
          items: [
            { ticker: "QQQ", name: "Nasdaq 100 ETF", why: "Small growth tilt if risk budget allows." },
            { ticker: "QUAL", name: "Quality factor ETF", why: "Screens for stronger balance sheets and profitability." },
          ],
        },
      ],
      note: "A diversified ETF core is likely suitable. Add risk gradually rather than chasing short-term momentum.",
    };
  }

  if (score < 80) {
    return {
      name: "Growth Investor",
      score,
      risk: "High risk",
      allocation: "Mostly equities, global ETFs, US tech exposure, and selective thematic or factor funds.",
      ideas: ["All World ETF", "Nasdaq 100 ETF", "S&P 500 ETF", "Quality growth stocks"],
      recommendationGroups: [
        {
          title: "Core growth funds",
          items: [
            { ticker: "VT / ACWI", name: "Global equity ETF", why: "Keeps the portfolio diversified while staying equity-led." },
            { ticker: "VOO / IVV", name: "S&P 500 ETF", why: "Broad US large-cap growth engine." },
            { ticker: "QQQ / QQQM", name: "Nasdaq 100 ETF", why: "Growth and technology tilt." },
            { ticker: "VUG / SCHG", name: "US growth ETF", why: "Broader growth exposure beyond only Nasdaq." },
          ],
        },
        {
          title: "Stock watchlist",
          items: [
            { ticker: "MSFT", name: "Microsoft", why: "Cloud, AI, enterprise software exposure." },
            { ticker: "NVDA", name: "NVIDIA", why: "AI infrastructure leader, but volatile." },
            { ticker: "GOOGL", name: "Alphabet", why: "Search, cloud, AI and advertising exposure." },
            { ticker: "AMZN", name: "Amazon", why: "Cloud plus consumer platform exposure." },
            { ticker: "META", name: "Meta", why: "Digital ads, AI infrastructure and platform scale." },
          ],
        },
        {
          title: "Rules for this profile",
          items: [
            { ticker: "Max 5–10%", name: "Single-stock cap", why: "Avoid one winner or loser dominating the portfolio." },
            { ticker: "Buy dips", name: "Entry discipline", why: "Growth assets can be excellent but painful if chased." },
          ],
        },
      ],
      note: "You may tolerate volatility, but position sizing matters. Use technical signals as timing support, not as the whole decision.",
    };
  }

  return {
    name: "Aggressive / Tactical Investor",
    score,
    risk: "Very high risk",
    allocation: "High equity exposure, tactical ideas, growth sectors, and only carefully limited leverage if fully understood.",
    ideas: ["Nasdaq 100 ETF", "Growth stocks", "Sector ETFs", "Small tactical leveraged exposure"],
    recommendationGroups: [
      {
        title: "Core aggressive funds",
        items: [
          { ticker: "QQQ / QQQM", name: "Nasdaq 100 ETF", why: "High-growth US mega-cap tech exposure." },
          { ticker: "VUG / SCHG", name: "US growth ETF", why: "Growth exposure with more diversification than one stock." },
          { ticker: "SMH", name: "Semiconductor ETF", why: "AI and chip-cycle exposure, high volatility." },
          { ticker: "ARKK", name: "Innovation ETF", why: "Speculative growth basket, only as a small satellite." },
        ],
      },
      {
        title: "Stock watchlist",
        items: [
          { ticker: "NVDA", name: "NVIDIA", why: "High-upside AI infrastructure, but very volatile." },
          { ticker: "TSLA", name: "Tesla", why: "High-beta growth/innovation exposure." },
          { ticker: "AMD", name: "AMD", why: "AI/chip exposure with cyclical risk." },
          { ticker: "PLTR", name: "Palantir", why: "High-growth data/AI software profile." },
          { ticker: "CRWD", name: "CrowdStrike", why: "Cybersecurity growth exposure." },
        ],
      },
      {
        title: "Leverage / tactical",
        items: [
          { ticker: "QLD / SSO", name: "2x ETFs", why: "Only for tactical use with strict stop-loss and small sizing." },
          { ticker: "TQQQ / UPRO", name: "3x ETFs", why: "Extremely risky; avoid holding casually or long-term." },
          { ticker: "Cash rule", name: "Keep dry powder", why: "Aggressive profiles still need liquidity for drawdowns." },
        ],
      },
    ],
    note: "You appear comfortable with risk. Leverage should still be limited, planned, and never used without a maximum loss rule.",
  };
}

export function buildPortfolioModel(profileName) {
  if (profileName === "Defensive Investor") {
    return [
      { label: "Cash / Money Market", value: 25, color: "#67e8f9" },
      { label: "Short Bonds", value: 35, color: "#60a5fa" },
      { label: "Broad Bonds", value: 20, color: "#818cf8" },
      { label: "Global Equity", value: 15, color: "#18e28a" },
      { label: "Dividend / Quality", value: 5, color: "#fbbf24" },
    ];
  }
  if (profileName === "Balanced Investor") {
    return [
      { label: "Global Equity", value: 30, color: "#18e28a" },
      { label: "US Large Cap", value: 20, color: "#22c55e" },
      { label: "Bonds", value: 25, color: "#60a5fa" },
      { label: "Dividend / Quality", value: 10, color: "#fbbf24" },
      { label: "Growth Tilt", value: 10, color: "#a78bfa" },
      { label: "Cash", value: 5, color: "#94a3b8" },
    ];
  }
  if (profileName === "Growth Investor") {
    return [
      { label: "Global Equity", value: 25, color: "#18e28a" },
      { label: "US Large Cap", value: 20, color: "#22c55e" },
      { label: "Nasdaq / Growth", value: 20, color: "#a78bfa" },
      { label: "Quality Stocks", value: 15, color: "#fbbf24" },
      { label: "Sector ETFs", value: 10, color: "#f97316" },
      { label: "Cash", value: 10, color: "#94a3b8" },
    ];
  }
  return [
    { label: "US Growth / Nasdaq", value: 25, color: "#a78bfa" },
    { label: "Global Equity", value: 20, color: "#18e28a" },
    { label: "Sector / Thematic", value: 15, color: "#f97316" },
    { label: "Growth Stocks", value: 20, color: "#f43f5e" },
    { label: "Tactical / Leveraged", value: 5, color: "#eab308" },
    { label: "Cash", value: 15, color: "#94a3b8" },
  ];
}

export function getImplementationPlan(profileName) {
  if (profileName === "Defensive Investor") {
    return [
      "Build the bond and cash foundation first before adding equity risk.",
      "Use broad ETFs instead of concentrated single-stock positions.",
      "Keep 6+ months of expenses outside the portfolio.",
      "Review quarterly, but avoid frequent trading.",
    ];
  }
  if (profileName === "Balanced Investor") {
    return [
      "Use global ETFs as the core and add quality stocks only as satellites.",
      "Keep bonds or cash as dry powder for market drawdowns.",
      "Add gradually instead of investing everything after a strong rally.",
      "Rebalance when an allocation drifts more than 5–10%.",
    ];
  }
  if (profileName === "Growth Investor") {
    return [
      "Keep a diversified ETF core, then add growth exposure around it.",
      "Limit single stocks so one position cannot dominate the portfolio.",
      "Use technical signals for entry timing, not as the full investment thesis.",
      "Keep cash available for volatility and pullbacks.",
    ];
  }
  return [
    "Separate long-term core investments from tactical trades.",
    "Define maximum loss before entering any leveraged or high-beta position.",
    "Avoid holding leveraged ETFs casually through major drawdowns.",
    "Take profits or reduce risk when RSI and momentum become stretched.",
  ];
}

export function getPortfolioRules(profileName) {
  if (profileName === "Defensive Investor") {
    return [
      "No leverage.",
      "No single stock above 3–5% of portfolio.",
      "Prioritize liquidity and capital protection.",
      "Equity exposure should be broad and diversified.",
    ];
  }
  if (profileName === "Balanced Investor") {
    return [
      "Keep the majority in diversified ETFs.",
      "Single stocks should stay below 5–8% each.",
      "Use bonds/cash to control volatility.",
      "Avoid adding risk after emotional market moves.",
    ];
  }
  if (profileName === "Growth Investor") {
    return [
      "Single stocks should normally stay below 8–10% each.",
      "Growth exposure needs a clear reason and exit rule.",
      "Do not confuse a strong company with a good entry price.",
      "Use position sizing to survive volatility.",
    ];
  }
  return [
    "Leveraged exposure should stay small and tactical.",
    "Never average down without a predefined plan.",
    "Cut risk quickly when the thesis breaks.",
    "Keep a non-leveraged core so the portfolio can survive mistakes.",
  ];
}

export function getInvestmentAmount(answers) {
  return answers.amount?.amount || 0;
}

export function formatMoney(value) {
  if (!value) return "--";
  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
}

export function buildAllocationAmounts(segments, amount) {
  return segments.map((segment) => ({
    ...segment,
    money: amount ? Math.round((amount * segment.value) / 100) : 0,
  }));
}

export function getScenarioAssumptions(profileName) {
  if (profileName === "Defensive Investor") {
    return { conservative: 0.02, base: 0.035, optimistic: 0.055, years: 5 };
  }
  if (profileName === "Balanced Investor") {
    return { conservative: 0.025, base: 0.055, optimistic: 0.085, years: 5 };
  }
  if (profileName === "Growth Investor") {
    return { conservative: 0.015, base: 0.075, optimistic: 0.12, years: 5 };
  }
  return { conservative: -0.02, base: 0.095, optimistic: 0.16, years: 5 };
}

export function buildScenarioEstimate(profileName, amount) {
  const assumptions = getScenarioAssumptions(profileName);
  const compound = (rate) => amount * (1 + rate) ** assumptions.years;
  return {
    years: assumptions.years,
    conservativeRate: assumptions.conservative,
    baseRate: assumptions.base,
    optimisticRate: assumptions.optimistic,
    conservative: amount ? Math.round(compound(assumptions.conservative)) : 0,
    base: amount ? Math.round(compound(assumptions.base)) : 0,
    optimistic: amount ? Math.round(compound(assumptions.optimistic)) : 0,
  };
}
