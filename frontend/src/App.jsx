import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  addExpense,
  deleteExpense,
  exportExpensesCsv,
  getAnomalies,
  getAnalytics,
  getBudgets,
  getExpenses,
  getInsights,
  login,
  getPrediction,
  register,
  upsertBudget
} from "./api";

const COLORS = ["#0070f3", "#7928ca", "#10b981", "#f5a623", "#e00000", "#333333"];
const TrendAndDistributionCharts = lazy(() => import("./TrendAndDistributionCharts"));
const CategorySpendBarChart = lazy(() => import("./CategorySpendBarChart"));

function getOrCreateGuestCredentials() {
  if (typeof window === "undefined") {
    return { email: "guest@fintrack.app", password: "Guest@12345" };
  }

  const EMAIL_KEY = "expense_guest_email";
  const PASSWORD_KEY = "expense_guest_password";

  let email = localStorage.getItem(EMAIL_KEY) || "";
  let password = localStorage.getItem(PASSWORD_KEY) || "";

  if (!email || !password) {
    const seed = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    email = `guest_${seed}@fintrack.app`;
    password = `Guest@${seed}Aa`;
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(PASSWORD_KEY, password);
  }

  return { email, password };
}

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("expense_token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("expense_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [showLanding, setShowLanding] = useState(true);
  const [bootstrappingSession, setBootstrappingSession] = useState(() => !localStorage.getItem("expense_token"));
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [month, setMonth] = useState(currentMonthString());
  const [expenses, setExpenses] = useState([]);
  const [expenseMeta, setExpenseMeta] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [analytics, setAnalytics] = useState({ total: 0, byCategory: {}, dailyTrend: [] });
  const [prediction, setPrediction] = useState({ message: "" });
  const [insights, setInsights] = useState({ alerts: [], insights: [] });
  const [anomalies, setAnomalies] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [error, setError] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState(70000);
  const [expenseFilters, setExpenseFilters] = useState({
    page: 1,
    limit: 8,
    search: "",
    category: "",
    sortBy: "timestamp",
    sortOrder: "desc"
  });
  const [searchDraft, setSearchDraft] = useState("");

  const [form, setForm] = useState({ amount: "", description: "", paymentMethod: "UPI" });
  const [budgetForm, setBudgetForm] = useState({ category: "Food", limit: "" });
  const loadAbortRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const guestCredentials = useMemo(() => getOrCreateGuestCredentials(), []);

  const chartLoadingFallback = (
    <div className="card chart">
      <h2>Loading chart...</h2>
      <p className="muted">Preparing visualization</p>
    </div>
  );

  async function loadAll() {
    if (!token) return;
    if (loadAbortRef.current) {
      loadAbortRef.current.abort();
    }
    const controller = new AbortController();
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    loadAbortRef.current = controller;

    try {
      setError("");
      const [exp, an, pred, ins, bud, anom] = await Promise.all([
        getExpenses({ month, ...expenseFilters }, token, { signal: controller.signal }),
        getAnalytics(month, token, { signal: controller.signal }),
        getPrediction(month, token, { signal: controller.signal }),
        getInsights(month, token, { signal: controller.signal }),
        getBudgets(token, { signal: controller.signal }),
        getAnomalies(month, token, { signal: controller.signal })
      ]);
      if (requestId !== loadRequestIdRef.current) return;
      setExpenses(exp.items || []);
      setExpenseMeta({
        page: exp.page || 1,
        limit: exp.limit || expenseFilters.limit,
        total: exp.total || 0,
        totalPages: exp.totalPages || 1
      });
      setAnalytics(an);
      setPrediction(pred);
      setInsights(ins);
      setBudgets(bud);
      setAnomalies(anom.anomalies || []);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e.message);
      if (String(e.message).toLowerCase().includes("token") || String(e.message).toLowerCase().includes("bearer")) {
        localStorage.removeItem("expense_token");
        localStorage.removeItem("expense_refresh_token");
        localStorage.removeItem("expense_user");
        setToken("");
        setUser(null);
      }
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    loadAll();
  }, [month, token, expenseFilters]);

  useEffect(() => {
    return () => {
      if (loadAbortRef.current) {
        loadAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (token) {
      setBootstrappingSession(false);
      return;
    }

    let cancelled = false;

    async function ensureGuestSession() {
      setBootstrappingSession(true);
      try {
        let payload;
        try {
          payload = await register({
            name: "Guest User",
            email: guestCredentials.email,
            password: guestCredentials.password
          });
        } catch (registerError) {
          const message = String(registerError?.message || "").toLowerCase();
          if (!message.includes("exists")) throw registerError;
          payload = await login({ email: guestCredentials.email, password: guestCredentials.password });
        }

        if (cancelled) return;
        localStorage.setItem("expense_token", payload.token);
        localStorage.setItem("expense_refresh_token", payload.refreshToken || "");
        localStorage.setItem("expense_user", JSON.stringify(payload.user));
        setToken(payload.token);
        setUser(payload.user);
        setError("");
      } catch (sessionError) {
        if (!cancelled) {
          setError(sessionError?.message || "Unable to start guest session");
        }
      } finally {
        if (!cancelled) {
          setBootstrappingSession(false);
        }
      }
    }

    ensureGuestSession();
    return () => {
      cancelled = true;
    };
  }, [token, guestCredentials]);

  const pieData = useMemo(
    () =>
      Object.entries(analytics.byCategory || {}).map(([name, value]) => ({
        name,
        value: Number(value)
      })),
    [analytics.byCategory]
  );

  const savings = Math.max(0, Number(monthlyIncome || 0) - Number(analytics.total || 0));
  const savingsRate = monthlyIncome > 0 ? Math.round((savings / monthlyIncome) * 100) : 0;
  const confidencePercent = prediction.confidence == null
    ? null
    : (Number(prediction.confidence) <= 1 ? Number(prediction.confidence) * 100 : Number(prediction.confidence));
  const budgetUtilization =
    budgets.length > 0
      ? Math.round(
          (Object.values(analytics.byCategory || {}).reduce((a, b) => a + Number(b), 0) /
            budgets.reduce((a, b) => a + Number(b.limit), 0)) *
            100
        )
      : 0;

  async function onAddExpense(e) {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    try {
      await addExpense(
        {
          amount: Number(form.amount),
          description: form.description,
          paymentMethod: form.paymentMethod
        },
        token
      );
      setForm({ amount: "", description: "", paymentMethod: "UPI" });
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onDelete(id) {
    try {
      await deleteExpense(id, token);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  function updateExpenseFilter(key, value) {
    setExpenseFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setExpenseFilters((prev) => {
        if (prev.search === searchDraft) return prev;
        return { ...prev, search: searchDraft, page: 1 };
      });
    }, 250);

    return () => clearTimeout(handle);
  }, [searchDraft]);

  function goToPage(nextPage) {
    setExpenseFilters((prev) => ({ ...prev, page: nextPage }));
  }

  async function onExportCsv() {
    try {
      const { page, limit, ...filters } = expenseFilters;
      const blob = await exportExpensesCsv({ month, ...filters }, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  async function onSaveBudget(e) {
    e.preventDefault();
    if (!budgetForm.limit) return;
    try {
      await upsertBudget({ category: budgetForm.category, limit: Number(budgetForm.limit) }, token);
      setBudgetForm((prev) => ({ ...prev, limit: "" }));
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  const isDashboardTab = activeTab === "Dashboard";
  const isAnalyticsTab = activeTab === "Analytics";
  const isBudgetsTab = activeTab === "Budgets";
  const isPredictionsTab = activeTab === "Predictions";
  const isInsightsTab = activeTab === "Insights";

  if (showLanding) {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="landing-brand">FinTrack AI</div>
          <nav className="landing-nav">
            <button className="hero-btn-primary" style={{ padding: "10px 20px" }} onClick={() => setShowLanding(false)}>
              Go to Dashboard
            </button>
          </nav>
        </header>

        <main>
          <section className="landing-hero">
            <div className="hero-content">
              <div className="badge">AI-Powered Finance v2.0</div>
              <h1>Automate your wealth tracking.</h1>
              <p className="hero-subtitle">
                Instantly categorize spending, detect anomalies, and forecast your financial future with enterprise-grade machine learning models built for personal finance.
              </p>
              <div className="hero-actions">
                <button className="hero-btn-primary" onClick={() => setShowLanding(false)}>Start Tracking Free</button>
                <button className="hero-btn-secondary" onClick={() => setShowLanding(false)}>View Live Demo</button>
              </div>
              <div className="hero-features">
                <span>✓ ML Categorization</span>
                <span>✓ Spend Forecast</span>
                <span>✓ Smart Alerts</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="mockup-window">
                <div className="mockup-header">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="mockup-body">
                  <div className="mockup-sidebar"></div>
                  <div className="mockup-content">
                    <div className="mockup-kpi-row">
                      <div className="mockup-kpi"></div>
                      <div className="mockup-kpi"></div>
                      <div className="mockup-kpi"></div>
                    </div>
                    <div className="mockup-chart"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-features-grid">
            <div className="feature-card">
              <div className="feature-icon">🧠</div>
              <h2>Smart Categorization</h2>
              <p>Our ML model automatically sorts your transactions into intuitive categories accurately over time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h2>Predictive Insights</h2>
              <p>Forecast your month-end balance and get intelligent recommendations on to cut unnecessary spending.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚨</div>
              <h2>Anomaly Detection</h2>
              <p>Get instant alerts when the system detects unusual spending patterns using z-score outlier algorithms.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!token || bootstrappingSession) {
    return (
      <div className="shell auth-wrap">
        <main>
          <div className="card auth-card">
            <h1>Starting dashboard...</h1>
            <p>Preparing guest session and loading your workspace.</p>
            {error ? <p className="error">{error}</p> : null}
            <button type="button" className="ghost" onClick={() => window.location.reload()} style={{ marginTop: "12px" }}>
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">FinTrack AI</div>
        {["Dashboard", "Analytics", "Budgets", "Predictions", "Insights"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`menu-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </aside>

      <main className="main">
        <header>
          <div>
            <h1>Welcome back, {user?.name || "User"}</h1>
            <p className="muted">Smart personal finance decision engine</p>
          </div>
          <div className="header-actions">
            <input aria-label="Select month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="ghost" onClick={() => setShowLanding(true)}>
              Home
            </button>
          </div>
        </header>

        {error ? <div className="card error">{error}</div> : null}

        {(isDashboardTab || isAnalyticsTab || isPredictionsTab) && (
          <section className="grid four kpi">
          <div className="stat stat-a">
            <h2>Total Spent</h2>
            <p>₹{analytics.total || 0}</p>
          </div>
          <div className="stat stat-b">
            <h2>Est. Savings</h2>
            <p>₹{savings}</p>
          </div>
          <div className="stat stat-c">
            <h2>Savings Rate</h2>
            <p>{savingsRate}%</p>
          </div>
          <div className="stat stat-d">
            <h2>Prediction</h2>
            <p>₹{prediction.predictedMonthTotal || 0}</p>
          </div>
          </section>
        )}

        {(isDashboardTab || isAnalyticsTab) && (
          <Suspense fallback={<section className="grid two">{chartLoadingFallback}{chartLoadingFallback}</section>}>
            <TrendAndDistributionCharts analytics={analytics} pieData={pieData} colors={COLORS} />
          </Suspense>
        )}

        {(isDashboardTab || isBudgetsTab) && (
          <section className="grid two">
          <div className="card">
            <h2 className="card-title">Quick Add Expense</h2>
            <form onSubmit={onAddExpense} className="stack">
              <input
                aria-label="Amount"
                type="number"
                min="1"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <input
                aria-label="Description"
                placeholder="Description (e.g. Swiggy dinner)"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <select
                aria-label="Payment method"
                value={form.paymentMethod}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              >
                <option>UPI</option>
                <option>Card</option>
                <option>Cash</option>
                <option>NetBanking</option>
              </select>
              <button type="submit">Add Expense</button>
            </form>
          </div>

          <div className="card">
            <h2 className="card-title">Budget + Income Control</h2>
            <div className="stack">
              <input
                aria-label="Monthly income"
                type="number"
                min="0"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value || 0))}
                placeholder="Monthly income"
              />
              <form onSubmit={onSaveBudget} className="stack">
                <select
                  aria-label="Budget category"
                  value={budgetForm.category}
                  onChange={(e) => setBudgetForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option>Food</option>
                  <option>Travel</option>
                  <option>Bills</option>
                  <option>Shopping</option>
                  <option>Entertainment</option>
                  <option>Others</option>
                </select>
                <input
                  aria-label="Budget limit"
                  type="number"
                  min="1"
                  placeholder="Monthly limit"
                  value={budgetForm.limit}
                  onChange={(e) => setBudgetForm((prev) => ({ ...prev, limit: e.target.value }))}
                />
                <button type="submit">Save Budget</button>
              </form>
              <div className="progress-wrap">
                <span>Budget utilization</span>
                <div className="progress">
                  <div style={{ width: `${Math.min(100, budgetUtilization)}%` }} />
                </div>
                <small>{Number.isFinite(budgetUtilization) ? budgetUtilization : 0}% used</small>
              </div>
            </div>
          </div>
          </section>
        )}

        {isBudgetsTab && (
          <section className="card">
            <h2 className="card-title">Saved Budgets</h2>
            {budgets.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((budget) => (
                    <tr key={budget.id}>
                      <td>{budget.category}</td>
                      <td>₹{budget.limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No budgets saved yet for this account.</p>
            )}
          </section>
        )}

        {(isDashboardTab || isAnalyticsTab || isInsightsTab) && (
          <section className="grid two">
            {(isDashboardTab || isAnalyticsTab) && (
              <Suspense fallback={chartLoadingFallback}>
                <CategorySpendBarChart pieData={pieData} />
              </Suspense>
            )}
            {(isDashboardTab || isInsightsTab) && (
              <div className="card split-card">
                <div>
                  <h2 className="card-title">Smart Alerts</h2>
                  <div className="alert-list">
                    {insights.alerts?.length ? (
                      insights.alerts.map((a, i) => (
                        <div key={i} className="list-item alert-item">
                          <span className="icon alert-icon">⚠️</span>
                          <span className="item-text">{a}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No alerts at this time.</div>
                    )}
                  </div>
                </div>

                <div className="mt-large">
                  <h2 className="card-title">Behavioral Insights</h2>
                  <div className="insight-list">
                    {insights.insights?.length ? (
                      insights.insights.map((i, idx) => (
                        <div key={idx} className="list-item insight-item">
                          <span className="icon insight-icon">💡</span>
                          <span className="item-text">{i}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">Not enough data for insights.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {isPredictionsTab && (
          <section className="card">
            <h2 className="card-title">Spend Forecast & Prediction Details</h2>
            <div className="prediction-grid">
              <div className="prediction-card main-prediction">
                <h3>Predicted Month Total</h3>
                <div className="prediction-value">₹{prediction.predictedMonthTotal || 0}</div>
                <div className="prediction-message">{prediction.message || "No prediction message available"}</div>
              </div>
              <div className="prediction-details">
                <div className="detail-item">
                  <span className="detail-label">Confidence</span>
                  <span className={`detail-value badge-pill ${(confidencePercent ?? 0) > 80 ? "high" : "medium"}`}>
                    {confidencePercent != null ? `${confidencePercent.toFixed(2)}%` : "n/a"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Reason Code</span>
                  <span className="detail-value">{prediction.reasonCode || "n/a"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Model Version</span>
                  <span className="detail-value">{prediction.modelVersion || "n/a"}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {(isDashboardTab || isAnalyticsTab || isInsightsTab) && (
          <section className="card">
            <h2 className="card-title">Anomaly Detection (z-score)</h2>
            <div className="anomaly-list">
              {anomalies.length ? (
                anomalies.map((a) => (
                  <div key={a.id} className="anomaly-item">
                    <div className="anomaly-header">
                      <span className="anomaly-amount">₹{a.amount}</span>
                      <span className="anomaly-category badge-pill">{a.category}</span>
                    </div>
                    <div className="anomaly-body">
                      <span className="anomaly-desc">{a.description}</span>
                      <span className="anomaly-date">{new Date(a.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="anomaly-reason">
                      <span className="reason-label">Flagged:</span> {a.reason}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No anomalies detected for this month. Your spending is perfectly typical.</div>
              )}
            </div>
          </section>
        )}

        {(isDashboardTab || isPredictionsTab) && (
          <section className="card">
          <h2 className="card-title">Recent Expenses</h2>
          <div className="table-toolbar">
            <input
              aria-label="Search expenses"
              placeholder="Search description/category"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
            <select
              aria-label="Filter category"
              value={expenseFilters.category}
              onChange={(e) => updateExpenseFilter("category", e.target.value)}
            >
              <option value="">All categories</option>
              <option>Food</option>
              <option>Travel</option>
              <option>Bills</option>
              <option>Shopping</option>
              <option>Entertainment</option>
              <option>Others</option>
            </select>
            <select
              aria-label="Sort field"
              value={expenseFilters.sortBy}
              onChange={(e) => updateExpenseFilter("sortBy", e.target.value)}
            >
              <option value="timestamp">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
            <select
              aria-label="Sort order"
              value={expenseFilters.sortOrder}
              onChange={(e) => updateExpenseFilter("sortOrder", e.target.value)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <button className="ghost" type="button" onClick={onExportCsv}>
              Export CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Category</th>
                <th>Description</th>
                <th>Method</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>₹{e.amount}</td>
                  <td>{e.category}</td>
                  <td>{e.description}</td>
                  <td>{e.paymentMethod}</td>
                  <td>{new Date(e.timestamp).toLocaleDateString()}</td>
                  <td>
                    <button className="danger" onClick={() => onDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pager">
            <button
              className="ghost"
              disabled={expenseMeta.page <= 1}
              onClick={() => goToPage(Math.max(1, expenseMeta.page - 1))}
            >
              Previous
            </button>
            <span>
              Page {expenseMeta.page} of {expenseMeta.totalPages} • {expenseMeta.total} items
            </span>
            <button
              className="ghost"
              disabled={expenseMeta.page >= expenseMeta.totalPages}
              onClick={() => goToPage(Math.min(expenseMeta.totalPages, expenseMeta.page + 1))}
            >
              Next
            </button>
          </div>
          </section>
        )}
      </main>
    </div>
  );
}
