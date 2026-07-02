import { daysInMonth, monthKey, toDateStr } from './state.js';
import { CATEGORY_KEYWORDS } from './seed.js';

function normalizeMerchant(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

// --- Category auto-suggestion -------------------------------------------------
export function suggestCategory(merchant, merchantCategoryMap) {
  const norm = normalizeMerchant(merchant);
  if (!norm) return null;
  const learned = merchantCategoryMap.find((m) => m.merchant === norm);
  if (learned) return learned.categoryId;
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => norm.includes(kw))) return categoryId;
  }
  return null;
}

export function learnedEntry(merchant, categoryId) {
  return { merchant: normalizeMerchant(merchant), categoryId };
}

// --- Recurring / subscription detection ---------------------------------------
// Groups expense transactions by normalized merchant, looks for 2+ occurrences
// with roughly consistent amount and interval, and classifies the cadence.
export function detectRecurring(transactions) {
  const expenses = transactions.filter((t) => t.amount < 0 && t.merchant);
  const groups = new Map();
  for (const t of expenses) {
    const key = normalizeMerchant(t.merchant);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const results = [];
  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;
    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

    const amounts = txs.map((t) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = amounts.every((a) => Math.abs(a - avgAmount) / avgAmount < 0.15);
    if (!amountVariance) continue;

    const intervals = [];
    for (let i = 1; i < txs.length; i++) {
      intervals.push((new Date(txs[i].date) - new Date(txs[i - 1].date)) / 86400000);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalConsistent = intervals.every((iv) => Math.abs(iv - avgInterval) < Math.max(4, avgInterval * 0.25));
    if (!intervalConsistent) continue;

    let cadence = null;
    if (avgInterval >= 5 && avgInterval <= 9) cadence = { label: 'Weekly', days: 7 };
    else if (avgInterval >= 25 && avgInterval <= 35) cadence = { label: 'Monthly', days: 30 };
    else if (avgInterval >= 85 && avgInterval <= 95) cadence = { label: 'Quarterly', days: 90 };
    else if (avgInterval >= 350 && avgInterval <= 380) cadence = { label: 'Yearly', days: 365 };
    else continue;

    const last = txs[txs.length - 1];
    const first = txs[0];
    const nextDate = new Date(new Date(last.date).getTime() + cadence.days * 86400000);
    const priceIncrease = amounts[amounts.length - 1] > amounts[0] * 1.05;

    results.push({
      merchant: last.merchant,
      normalizedMerchant: key,
      category: last.category,
      accountId: last.accountId,
      amount: Math.round(avgAmount),
      cadence: cadence.label,
      cadenceDays: cadence.days,
      occurrences: txs.length,
      lastDate: last.date,
      nextDate: toDateStr(nextDate),
      priceIncrease,
      firstAmount: amounts[0],
      lastAmount: amounts[amounts.length - 1],
      transactionIds: txs.map((t) => t.id),
    });
  }
  return results.sort((a, b) => b.amount - a.amount);
}

// --- Budget pacing --------------------------------------------------------------
export function budgetPacing(budget, transactions, referenceDate = new Date()) {
  const key = monthKey(referenceDate);
  const spent = transactions
    .filter((t) => t.category === budget.categoryId && t.amount < 0 && monthKey(t.date) === key)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const today = referenceDate.getDate();
  const totalDays = daysInMonth(referenceDate);
  // Early in the month a single purchase would otherwise get extrapolated wildly
  // (e.g. day 1 / 1 day * 31 days); floor the divisor so projections stay sane.
  const projected = totalDays > 0 ? Math.round((spent / Math.max(today, 5)) * totalDays) : spent;

  const expectedByToday = (budget.monthlyLimit / totalDays) * today;
  let pace = 'on-track';
  if (spent > budget.monthlyLimit) pace = 'over';
  else if (spent > expectedByToday * 1.1) pace = 'ahead'; // spending faster than budget allows
  else pace = 'on-track';

  return {
    spent,
    limit: budget.monthlyLimit,
    projected,
    pctUsed: budget.monthlyLimit > 0 ? Math.min(1.5, spent / budget.monthlyLimit) : 0,
    pace,
    remaining: budget.monthlyLimit - spent,
  };
}

// --- Anomaly detection ------------------------------------------------------------
export function detectAnomalies(transactions) {
  const byCategory = new Map();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category).push(Math.abs(t.amount));
  }
  const avgByCategory = new Map();
  for (const [cat, amounts] of byCategory) {
    avgByCategory.set(cat, amounts.reduce((a, b) => a + b, 0) / amounts.length);
  }
  return transactions
    .filter((t) => {
      if (t.amount >= 0) return false;
      const avg = avgByCategory.get(t.category);
      const sampleSize = byCategory.get(t.category)?.length || 0;
      return avg && sampleSize >= 3 && Math.abs(t.amount) > avg * 2;
    })
    .map((t) => t.id);
}

// --- Cash flow forecast --------------------------------------------------------
export function cashFlowForecast(accounts, transactions, referenceDate = new Date()) {
  const key = monthKey(referenceDate);
  const today = referenceDate.getDate();
  const totalDays = daysInMonth(referenceDate);
  const daysLeft = totalDays - today;

  return accounts.map((acc) => {
    const monthTxs = transactions.filter((t) => t.accountId === acc.id && monthKey(t.date) === key);
    const netThisMonth = monthTxs.reduce((sum, t) => sum + t.amount, 0);
    const dailyRate = today > 0 ? netThisMonth / today : 0;
    const projectedEndOfMonth = acc.balance + Math.round(dailyRate * daysLeft);
    return { accountId: acc.id, projectedEndOfMonth, dailyRate };
  });
}

// --- Insight sentence generator -------------------------------------------------
export function generateInsights({ transactions, categories, referenceDate = new Date() }) {
  const insights = [];
  const thisKey = monthKey(referenceDate);
  const lastMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const lastKey = monthKey(lastMonthDate);
  const today = referenceDate.getDate();

  const spendByCat = (key, cutoffDay) => {
    const map = new Map();
    for (const t of transactions) {
      if (t.amount >= 0 || monthKey(t.date) !== key) continue;
      if (cutoffDay && new Date(t.date).getDate() > cutoffDay) continue;
      map.set(t.category, (map.get(t.category) || 0) + Math.abs(t.amount));
    }
    return map;
  };

  const thisMonth = spendByCat(thisKey, null);
  const lastMonthSameWindow = spendByCat(lastKey, today);

  let biggestDelta = null;
  for (const [cat, amount] of thisMonth) {
    const prev = lastMonthSameWindow.get(cat) || 0;
    if (prev < 500) continue; // ignore noise under $5
    const pctChange = ((amount - prev) / prev) * 100;
    if (!biggestDelta || Math.abs(pctChange) > Math.abs(biggestDelta.pctChange)) {
      biggestDelta = { cat, pctChange, amount, prev };
    }
  }
  if (biggestDelta && Math.abs(biggestDelta.pctChange) >= 15) {
    const catName = categories.find((c) => c.id === biggestDelta.cat)?.name || biggestDelta.cat;
    const dir = biggestDelta.pctChange > 0 ? 'up' : 'down';
    insights.push(`${catName} is ${dir} ${Math.abs(Math.round(biggestDelta.pctChange))}% vs. the same point last month.`);
  }

  const totalThisMonth = [...thisMonth.values()].reduce((a, b) => a + b, 0);
  if (totalThisMonth > 0) {
    const topCat = [...thisMonth.entries()].sort((a, b) => b[1] - a[1])[0];
    const catName = categories.find((c) => c.id === topCat[0])?.name || topCat[0];
    const pct = Math.round((topCat[1] / totalThisMonth) * 100);
    insights.push(`${catName} is your biggest spend this month at ${pct}% of total spending.`);
  }

  return insights;
}
