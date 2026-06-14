import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Crown,
  Star,
  TrendingUp,
  TrendingDown,
  BarChart3,
  SlidersHorizontal,
  RotateCcw,
  RefreshCw,
  Home,
  Compass,
} from "lucide-react";
import "./App.css";

import { tone } from "./lib/formatters";
import { calculateIndicators, getTrendLabel } from "./lib/marketAnalysis";
import { buildDecision } from "./lib/decisionEngine";
import {
  CHART_REFRESH_MS,
  MANUAL_REFRESH_COOLDOWN_MS,
  QUOTE_REFRESH_MS,
  buildNextMarkets,
  fetchTwelveDataMarketSnapshot,
  intervalMap,
} from "./services/twelveDataService";
import {
  investorQuestions,
  getInvestorProfile,
  buildPortfolioModel,
  getImplementationPlan,
  getPortfolioRules,
  getInvestmentAmount,
  formatMoney,
  buildAllocationAmounts,
  buildScenarioEstimate,
} from "./lib/investorProfile";
import MarketCard from "./components/MarketCard";
import Chart from "./components/Chart";
import PortfolioPie from "./components/PortfolioPie";
import ClaudePanel from "./components/ClaudePanel";

const marketConfig = [
  { symbol: "S&P 500", apiSymbol: "SPY", tag: "US", accent: "green" },
  { symbol: "All World ETF", apiSymbol: "VT", tag: "GLOBAL", accent: "cyan" },
  { symbol: "Nasdaq", apiSymbol: "QQQ", tag: "TECH", accent: "purple" },
  { symbol: "EIMI", apiSymbol: "EEM", tag: "EM", accent: "orange" },
];

const defaultMarketData = marketConfig.map((market) => ({
  ...market,
  price: "--",
  change: "--",
  score: 50,
  signal: "Hold",
  marketOpen: null,
  chart: [],
  candles: [],
  indicators: null,
}));

const defaultLayout = marketConfig.map((market) => ({
  symbol: market.symbol,
  visible: true,
  size: "m",
}));

const timeframes = ["1D", "1W", "1M", "3M", "1Y", "All"];

const SYMBOL_MIGRATIONS = { "EMEI": "EIMI", "Emerging Markets": "EIMI" };

function getSavedLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem("hugo-market-layout"));
    if (Array.isArray(saved)) {
      return saved.map((item) => ({ ...item, symbol: SYMBOL_MIGRATIONS[item.symbol] ?? item.symbol }));
    }
  } catch {
    return defaultLayout;
  }
  return defaultLayout;
}

export default function App() {
  const [selected, setSelected] = useState("S&P 500");
  const [timeframe, setTimeframe] = useState("1D");
  const [query, setQuery] = useState("");
  const [watchlisted, setWatchlisted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activePage, setActivePage] = useState("home");
  const [testStep, setTestStep] = useState(0);
  const [testAnswers, setTestAnswers] = useState({});
  const [markets, setMarkets] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("hugo-market-cache"));
      if (Array.isArray(cached)) {
        return cached.map((m) => ({ ...m, symbol: SYMBOL_MIGRATIONS[m.symbol] ?? m.symbol }));
      }
    } catch {
      // keep default data
    }
    return defaultMarketData;
  });
  const [layout, setLayout] = useState(getSavedLayout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => localStorage.getItem("hugo-market-updated") || "");
  const [chartCache, setChartCache] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hugo-chart-cache")) || {};
    } catch {
      return {};
    }
  });
  const lastFetchRef = useRef(0);

  const orderedVisibleLayout = layout.filter((item) => item.visible);
  const hiddenLayout = layout.filter((item) => !item.visible);
  const visibleSearchMarkets = markets.filter((m) => m.symbol.toLowerCase().includes(query.toLowerCase()));
  const market = useMemo(() => markets.find((m) => m.symbol === selected) || markets[0], [markets, selected]);
  const allDecisions = useMemo(
    () => Object.fromEntries(markets.map((m) => [m.symbol, buildDecision({ market: m, timeframe })])),
    [markets, timeframe]
  );
  const decision = allDecisions[selected] || buildDecision({ market, timeframe });
  const direction = tone(market.change);
  const trendLabel = getTrendLabel(market.indicators);
  const trendDirection = tone(trendLabel);
  const currentInterval = intervalMap[timeframe] || "1day";
  const marketStatusText = loading ? "Updating" : market.marketOpen === true ? "Market Open" : market.marketOpen === false ? "Market Closed" : "Live Data";
  const marketStatusClass = loading ? "spin-dot" : market.marketOpen === true ? "green-dot" : market.marketOpen === false ? "red-dot" : "blue-dot";

  useEffect(() => {
    localStorage.setItem("hugo-market-layout", JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    loadMarketData(false);
    const interval = window.setInterval(() => loadMarketData(false), QUOTE_REFRESH_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, timeframe]);

  async function loadMarketData(force = false) {
    const now = Date.now();
    const cacheKey = `${selected}-${timeframe}`;
    const cachedCandles = chartCache[cacheKey];
    const quoteCacheTime = Number(localStorage.getItem("hugo-market-cache-ts") || 0);
    const hasQuoteCache = markets.some((item) => item.price !== "--");
    const shouldFetchQuotes = force || !hasQuoteCache || now - quoteCacheTime > QUOTE_REFRESH_MS;
    const shouldFetchChart = force || !cachedCandles || now - cachedCandles.timestamp > CHART_REFRESH_MS;

    if (force && now - lastFetchRef.current < MANUAL_REFRESH_COOLDOWN_MS) {
      setError("Manual refresh is limited to once per minute to protect your free API credits.");
      return;
    }

    if (!shouldFetchQuotes && !shouldFetchChart) return;
    lastFetchRef.current = now;

    if (cachedCandles?.candles?.length) {
      setMarkets((current) => current.map((item) => {
        if (item.symbol !== selected) return item;
        const recalculated = calculateIndicators(cachedCandles.candles, item.rawChange);
        return {
          ...item,
          candles: cachedCandles.candles,
          chart: cachedCandles.candles.map((candle) => candle.close),
          indicators: recalculated,
          score: recalculated.score,
          signal: recalculated.signal,
        };
      }));
    }

    setLoading(true);
    setError("");

    try {
      const { quoteResponse, selectedCandles } = await fetchTwelveDataMarketSnapshot({
        marketConfig,
        selected,
        currentInterval,
        cachedCandles,
        shouldFetchQuotes,
        shouldFetchChart,
      });

      if (selectedCandles.length) {
        const nextChartCache = {
          ...chartCache,
          [cacheKey]: { candles: selectedCandles, timestamp: now },
        };
        setChartCache(nextChartCache);
        localStorage.setItem("hugo-chart-cache", JSON.stringify(nextChartCache));
      }

      const nextMarkets = buildNextMarkets({
        marketConfig,
        markets,
        selected,
        quoteResponse,
        selectedCandles,
      });

      setMarkets(nextMarkets);
      localStorage.setItem("hugo-market-cache", JSON.stringify(nextMarkets));
      if (shouldFetchQuotes) localStorage.setItem("hugo-market-cache-ts", String(now));

      const updatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastUpdated(updatedAt);
      localStorage.setItem("hugo-market-updated", updatedAt);
    } catch (err) {
      setError(`${err.message || "Could not load market data"}. Showing cached data if available.`);
    } finally {
      setLoading(false);
    }
  }

  function updateLayout(symbol, update) {
    setLayout((current) => current.map((item) => item.symbol === symbol ? { ...item, ...update } : item));
  }

  function moveCard(symbol, directionAmount) {
    setLayout((current) => {
      const next = [...current];
      const index = next.findIndex((item) => item.symbol === symbol);
      const target = index + directionAmount;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function resetLayout() {
    setLayout(defaultLayout);
    setSelected("S&P 500");
  }

  const investorProfile = getInvestorProfile(testAnswers);
  const portfolioModel = buildPortfolioModel(investorProfile.name);
  const investmentAmount = getInvestmentAmount(testAnswers);
  const allocationAmounts = buildAllocationAmounts(portfolioModel, investmentAmount);
  const scenarioEstimate = buildScenarioEstimate(investorProfile.name, investmentAmount);
  const implementationPlan = getImplementationPlan(investorProfile.name);
  const portfolioRules = getPortfolioRules(investorProfile.name);

  return (
    <div className="app-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="orb orb-three" />

      <aside className="sidebar">
        <button className={`side-logo ${activePage === "home" ? "active" : ""}`} onClick={() => setActivePage("home")}>
          <Crown size={24} />
        </button>

        <nav className="side-nav">
          <button className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("home")}>
            <Home size={21} />
            <span>Home</span>
          </button>
          <button className={activePage === "explore" ? "active" : ""} onClick={() => setActivePage("explore")}>
            <Compass size={21} />
            <span>Explore</span>
          </button>
        </nav>
      </aside>

      {activePage === "home" ? (
        <main className="dashboard">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon"><Crown size={22} /></div>
            <div>
              <h1>HUGO</h1>
              <p>Market Analysis</p>
            </div>
          </div>

          <div className="top-actions">
            <div className="status-pill">
              <span className={marketStatusClass} />
              {marketStatusText}
              {lastUpdated && <small>{lastUpdated}</small>}
            </div>

            <div className="search-wrap">
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search markets" />
              {query && (
                <div className="search-menu">
                  {visibleSearchMarkets.map((m) => (
                    <button key={m.symbol} onClick={() => { setSelected(m.symbol); setQuery(""); }}>
                      <span>{m.symbol}</span>
                      <b className={tone(allDecisions[m.symbol]?.signal || m.signal)}>{allDecisions[m.symbol]?.signal || m.signal}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="refresh-btn" title="Manual refresh: max once per minute" onClick={() => loadMarketData(true)} disabled={loading}>
              <RefreshCw size={18} className={loading ? "spinning" : ""} />
            </button>

            <button className={`edit-toggle ${editMode ? "on" : ""}`} onClick={() => setEditMode(!editMode)}>
              <SlidersHorizontal size={18} />
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
          </div>
        )}

        <section className={`market-grid ${editMode ? "edit-mode" : ""}`}>
          {orderedVisibleLayout.map((item, index) => {
            const itemMarket = markets.find((m) => m.symbol === item.symbol) || defaultMarketData[0];
            return (
              <MarketCard
                key={item.symbol}
                market={itemMarket}
                signal={allDecisions[item.symbol]?.signal || itemMarket.signal}
                layoutItem={item}
                active={item.symbol === selected}
                editMode={editMode}
                index={index}
                total={orderedVisibleLayout.length}
                onClick={() => setSelected(item.symbol)}
                onMove={(amount) => moveCard(item.symbol, amount)}
                onSize={(size) => updateLayout(item.symbol, { size })}
                onHide={() => {
                  updateLayout(item.symbol, { visible: false });
                  if (selected === item.symbol) setSelected(orderedVisibleLayout.find((x) => x.symbol !== item.symbol)?.symbol || "S&P 500");
                }}
              />
            );
          })}

          {editMode && hiddenLayout.length > 0 && (
            <div className="hidden-dock">
              <span>Hidden</span>
              {hiddenLayout.map((item) => (
                <button key={item.symbol} onClick={() => updateLayout(item.symbol, { visible: true })}>{item.symbol}</button>
              ))}
            </div>
          )}

          {editMode && (
            <button className="reset-layout" onClick={resetLayout}>
              <RotateCcw size={15} /> Reset
            </button>
          )}
        </section>

        <section className="main-panel">
          <div className="hero-card">
            <div className="hero-top">
              <div>
                <div className="asset-line">
                  <h2>{market.symbol}</h2>
                  <span>{market.apiSymbol}</span>
                </div>
                <div className="price-row">
                  <strong>{market.price}</strong>
                  <em className={direction}>
                    {direction === "positive" ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {market.change}
                  </em>
                </div>
              </div>

              <button onClick={() => setWatchlisted(!watchlisted)} className={`watch-btn ${watchlisted ? "on" : ""}`}>
                <Star size={20} fill={watchlisted ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="score-zone">
              <div className={`score-ring ${tone(decision.signal)}`} style={{ "--score": `${decision.score}%` }}>
                <div>
                  <b>{decision.score}</b>
                  <small>/100</small>
                </div>
              </div>
              <div>
                <p className="label">Decision</p>
                <h3 className={tone(decision.signal)}>{decision.signal}</h3>
                <p className="micro">{decision.micro}</p>
              </div>
            </div>

            <div className="ai-box">
              <div className="ai-box-head">
                <span>{decision.insight.title}</span>
                <b className={tone(decision.insight.stance)}>{decision.insight.stance}</b>
              </div>
              <p>{decision.insight.body}</p>

              <div className="decision-chips">
                <span>Confidence <b>{decision.confidence}%</b></span>
                <span>Entry <b>{decision.entry.label}</b></span>
                <span>Risk <b>{decision.risk.label}</b></span>
                <span>Regime <b>{decision.regime.stance}</b></span>
              </div>

              {decision.reasons.length > 0 && (
                <div className="factor-list">
                  {decision.reasons.slice(0, 3).map((reason) => (
                    <div key={reason}>{reason}</div>
                  ))}
                </div>
              )}

              <small>{decision.insight.risk}</small>

            </div>

            <ClaudePanel
              key={market.symbol}
              market={market}
              decision={decision}
              timeframe={timeframe}
            />

            {decision.extraInvestmentSuggestion && (
              <div className={`monthly-suggestion ${decision.extraInvestmentSuggestion.tone}`}>
                <span>Extra cash</span>
                <p>{decision.extraInvestmentSuggestion.oneLine}</p>
              </div>
            )}
          </div>

          <div className="mini-panel chart-card merged-chart">
            <div className="section-title">
              <h3>Chart</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {market.marketOpen === true && <span className="live-badge">LIVE</span>}
                <span className={trendDirection}>{trendLabel}</span>
              </div>
            </div>

            <div className="timeframe-grid chart-timeframes">
              {timeframes.map((t) => (
                <button key={t} onClick={() => setTimeframe(t)} className={timeframe === t ? "selected" : ""}>{t}</button>
              ))}
            </div>

            <Chart chart={market.chart} direction={direction} timeframe={timeframe} />
          </div>

          <div className="mini-panel summary-card">
            <div className="section-title">
              <h3>Factors</h3>
              <BarChart3 size={18} />
            </div>
            <div className="factor-bars">
              {decision.factors.map((f) => {
                const barTone = f.value >= 65 ? "positive" : f.value >= 45 ? "neutral" : "negative";
                return (
                  <div key={f.label} className="factor-bar-row">
                    <span className="factor-bar-label">{f.label}</span>
                    <div className="factor-bar-track">
                      <div className={`factor-bar-fill ${barTone}`} style={{ width: `${f.value}%` }} />
                    </div>
                    <b className={`factor-bar-value ${barTone}`}>{f.value}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </main>
      ) : (
        <main className="dashboard explore-page">
          <section className="investor-test-card">
            <div className="test-header">
              <div>
                <span>Explore</span>
                <h2>Investor Profile Test</h2>
                <p>Answer 10 quick questions. The result will suggest the type of stocks, ETFs, or funds that may fit your profile.</p>
              </div>
              <button
                className="restart-test"
                onClick={() => {
                  setTestStep(0);
                  setTestAnswers({});
                }}
              >
                <RotateCcw size={16} /> Restart
              </button>
            </div>

            {testStep < investorQuestions.length ? (
              <div className="question-layout">
                <div className="question-panel">
                  <div className="progress-row">
                    <b>Question {testStep + 1} / {investorQuestions.length}</b>
                    <span>{Math.round((Object.keys(testAnswers).length / investorQuestions.length) * 100)}%</span>
                  </div>
                  <div className="progress-track">
                    <div style={{ width: `${(Object.keys(testAnswers).length / investorQuestions.length) * 100}%` }} />
                  </div>

                  <h3>{investorQuestions[testStep].title}</h3>
                  <p>{investorQuestions[testStep].subtitle}</p>

                  <div className="answer-grid">
                    {investorQuestions[testStep].options.map((option) => {
                      const selectedAnswer = testAnswers[investorQuestions[testStep].id]?.label === option.label;
                      return (
                        <button
                          key={option.label}
                          className={selectedAnswer ? "selected" : ""}
                          onClick={() => {
                            const question = investorQuestions[testStep];
                            const nextAnswers = {
                              ...testAnswers,
                              [question.id]: option,
                            };
                            setTestAnswers(nextAnswers);
                            if (testStep < investorQuestions.length - 1) {
                              setTestStep(testStep + 1);
                            } else {
                              setTestStep(investorQuestions.length);
                            }
                          }}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="test-nav-row">
                    <button disabled={testStep === 0} onClick={() => setTestStep(testStep - 1)}>Back</button>
                    <button
                      disabled={!testAnswers[investorQuestions[testStep].id]}
                      onClick={() => setTestStep(Math.min(testStep + 1, investorQuestions.length))}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="profile-preview">
                  <span>Live profile</span>
                  <h3>{getInvestorProfile(testAnswers).name}</h3>
                  <div className="profile-score-ring" style={{ "--score": `${getInvestorProfile(testAnswers).score}%` }}>
                    <b>{getInvestorProfile(testAnswers).score}</b>
                    <small>/100</small>
                  </div>
                  <p>{getInvestorProfile(testAnswers).risk}</p>
                </div>
              </div>
            ) : (
              <div className="result-layout structured-result">
                <div className="result-main professional-result-main">
                  <span>Your profile</span>
                  <h3>{investorProfile.name}</h3>

                  <div className="result-score-row">
                    <div className="profile-score-ring big" style={{ "--score": `${investorProfile.score}%` }}>
                      <b>{investorProfile.score}</b>
                      <small>/100</small>
                    </div>
                    <div className="profile-summary-box">
                      <p className="result-risk">{investorProfile.risk}</p>
                      <p>{investorProfile.allocation}</p>
                    </div>
                  </div>

                  <div className="explore-section-card">
                    <div className="section-mini-title">Target portfolio structure</div>
                    <PortfolioPie segments={portfolioModel} />

                    <div className="allocation-money-card">
                      <div className="allocation-money-head">
                        <span>Estimated initial allocation</span>
                        <b>{investmentAmount ? formatMoney(investmentAmount) : "No amount selected"}</b>
                      </div>
                      <div className="allocation-money-list">
                        {allocationAmounts.map((segment) => (
                          <div key={segment.label}>
                            <span>{segment.label}</span>
                            <b>{segment.money ? formatMoney(segment.money) : "--"}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="explore-section-card scenario-card">
                    <div className="section-mini-title">Illustrative 5-year scenario</div>
                    <div className="scenario-grid">
                      <div>
                        <span>Conservative</span>
                        <b>{scenarioEstimate.conservative ? formatMoney(scenarioEstimate.conservative) : "--"}</b>
                        <small>{Math.round(scenarioEstimate.conservativeRate * 100)}%/yr</small>
                      </div>
                      <div>
                        <span>Base case</span>
                        <b>{scenarioEstimate.base ? formatMoney(scenarioEstimate.base) : "--"}</b>
                        <small>{Math.round(scenarioEstimate.baseRate * 1000) / 10}%/yr</small>
                      </div>
                      <div>
                        <span>Optimistic</span>
                        <b>{scenarioEstimate.optimistic ? formatMoney(scenarioEstimate.optimistic) : "--"}</b>
                        <small>{Math.round(scenarioEstimate.optimisticRate * 100)}%/yr</small>
                      </div>
                    </div>
                    <p>Illustrative only — not a forecast. Real returns can be much better or worse, especially over short periods.</p>
                  </div>

                  <div className="two-column-explore">
                    <div className="explore-section-card">
                      <div className="section-mini-title">Implementation plan</div>
                      <div className="bullet-grid">
                        {implementationPlan.map((item) => (
                          <div key={item} className="bullet-card">{item}</div>
                        ))}
                      </div>
                    </div>

                    <div className="explore-section-card">
                      <div className="section-mini-title">Portfolio rules</div>
                      <div className="bullet-grid">
                        {portfolioRules.map((item) => (
                          <div key={item} className="bullet-card">{item}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="result-side recommendation-panel">
                  <h4>Recommended universe</h4>
                  <div className="recommendation-groups">
                    {investorProfile.recommendationGroups.map((group) => (
                      <div className="recommendation-group" key={group.title}>
                        <h5>{group.title}</h5>
                        <div className="recommendation-list">
                          {group.items.map((item) => (
                            <div className="recommendation-item" key={`${group.title}-${item.ticker}`}>
                              <div>
                                <b>{item.ticker}</b>
                                <span>{item.name}</span>
                              </div>
                              <p>{item.why}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="explore-note-box">
                    <h5>Professional note</h5>
                    <p>{investorProfile.note}</p>
                    <small>Educational only, not financial advice. Check fees, valuation, risk, taxes, currency exposure, diversification and your personal circumstances.</small>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
