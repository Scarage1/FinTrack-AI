import { groupByCategory, monthFromTimestamp } from "./utils.js";

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function buildBudgetAlerts(monthExpenses, budgets) {
  const byCategory = groupByCategory(monthExpenses);

  return budgets
    .map((b) => {
      const spent = byCategory[b.category] || 0;
      const ratio = b.limit > 0 ? spent / b.limit : 0;
      if (ratio >= 1) return `Budget exceeded for ${b.category}: ₹${spent} / ₹${b.limit}`;
      if (ratio >= 0.8) return `You have used ${Math.round(ratio * 100)}% of your ${b.category} budget`;
      return null;
    })
    .filter(Boolean);
}

export function buildSmartInsights(currentMonthExpenses, previousMonthExpenses) {
  const insights = [];

  if (currentMonthExpenses.length > 0) {
    const weekendSpend = currentMonthExpenses
      .filter((e) => isWeekend(new Date(e.timestamp)))
      .reduce((sum, e) => sum + e.amount, 0);
    const totalSpend = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const weekendRatio = totalSpend > 0 ? weekendSpend / totalSpend : 0;

    if (weekendRatio >= 0.35) {
      insights.push(`Weekend spending is ${Math.round(weekendRatio * 100)}% of total this month`);
    }

    const topMerchant = [...currentMonthExpenses]
      .map((e) => e.description.split(" ")[0])
      .reduce((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const top = Object.entries(topMerchant).sort((a, b) => b[1] - a[1])[0];
    if (top) insights.push(`Top merchant keyword this month: ${top[0]}`);
  }

  const currentTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const previousTotal = previousMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  if (previousTotal > 0) {
    const change = ((currentTotal - previousTotal) / previousTotal) * 100;
    const direction = change >= 0 ? "increased" : "decreased";
    insights.push(`Total spending ${direction} by ${Math.abs(change).toFixed(1)}% vs last month`);
  }

  return insights;
}

export function getPreviousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthlyTotalsFromAllExpenses(expenses) {
  const byMonth = expenses.reduce((acc, e) => {
    const month = monthFromTimestamp(e.timestamp);
    acc[month] = (acc[month] || 0) + e.amount;
    return acc;
  }, {});

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, total]) => total);
}
