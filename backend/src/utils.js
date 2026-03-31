export function normalizeMonth(month) {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthFromTimestamp(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function autoCategory(description = "") {
  const text = description.toLowerCase();
  if (/(swiggy|zomato|restaurant|cafe|food)/.test(text)) return "Food";
  if (/(uber|ola|metro|flight|bus|travel|taxi)/.test(text)) return "Travel";
  if (/(electricity|internet|rent|bill|recharge|gas)/.test(text)) return "Bills";
  if (/(amazon|flipkart|shopping|mall)/.test(text)) return "Shopping";
  if (/(movie|netflix|spotify|game|entertainment)/.test(text)) return "Entertainment";
  return "Others";
}

export function groupByCategory(expenses) {
  return expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
}

export function groupByDay(expenses) {
  const map = expenses.reduce((acc, e) => {
    const d = new Date(e.timestamp);
    const day = String(d.getDate()).padStart(2, "0");
    acc[day] = (acc[day] || 0) + e.amount;
    return acc;
  }, {});
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, amount]) => ({ day, amount }));
}

export function linearRegressionForecast(monthlyTotals) {
  if (monthlyTotals.length === 0) return 0;
  if (monthlyTotals.length === 1) return Math.round(monthlyTotals[0]);

  const n = monthlyTotals.length;
  const x = monthlyTotals.map((_, i) => i + 1);
  const y = monthlyTotals;
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (x[i] - xMean) * (y[i] - yMean);
    den += (x[i] - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const nextX = n + 1;
  return Math.max(0, Math.round(intercept + slope * nextX));
}
