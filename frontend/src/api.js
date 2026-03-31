const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || "request failed";
    throw new Error(message);
  }
  return data;
}

export async function register(payload) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return parse(res);
}

export async function login(payload) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return parse(res);
}

export async function logoutSession(refreshToken) {
  if (!refreshToken) return;
  const res = await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok && res.status !== 401) {
    throw new Error("failed to logout session");
  }
}

export async function getExpenses(query, token, options = {}) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const res = await fetch(`${BASE}/expenses?${params.toString()}`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function exportExpensesCsv(query, token) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });

  const res = await fetch(`${BASE}/expenses/export.csv?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!res.ok) {
    let message = "failed to export csv";
    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // ignore parse error for non-json responses
    }
    throw new Error(message);
  }

  return res.blob();
}

export async function addExpense(payload, token) {
  const res = await fetch(`${BASE}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });
  return parse(res);
}

export async function deleteExpense(id, token) {
  const res = await fetch(`${BASE}/expenses/${id}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!res.ok) throw new Error("failed to delete expense");
}

export async function getAnalytics(month, token, options = {}) {
  const res = await fetch(`${BASE}/analytics/monthly?month=${month}`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function getPrediction(month, token, options = {}) {
  const res = await fetch(`${BASE}/prediction?month=${month}`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function getInsights(month, token, options = {}) {
  const res = await fetch(`${BASE}/insights?month=${month}`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function getAnomalies(month, token, options = {}) {
  const res = await fetch(`${BASE}/anomalies?month=${month}`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function getBudgets(token, options = {}) {
  const res = await fetch(`${BASE}/budgets`, {
    headers: authHeaders(token),
    signal: options.signal
  });
  return parse(res);
}

export async function upsertBudget(payload, token) {
  const res = await fetch(`${BASE}/budgets`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });
  return parse(res);
}
