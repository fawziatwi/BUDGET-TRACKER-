import { store, subscribe, fmtMoney, categoryById, monthKey } from '../state.js';
import { donutChart, barChart, lineChart } from '../charts.js';
import { detectAnomalies } from '../smart.js';
import { escapeHtml, relativeDate } from '../ui.js';

export async function renderInsights(root) {
  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
  }

  const unsub = subscribe(paint);
  paint();
  return unsub;
}

function lastNMonths(n, ref = new Date()) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    arr.push(new Date(ref.getFullYear(), ref.getMonth() - i, 1));
  }
  return arr;
}

function buildHtml() {
  const now = new Date();
  const months = lastNMonths(6, now);

  const monthlySpend = months.map((d) => {
    const key = monthKey(d);
    const total = store.transactions
      .filter((t) => t.amount < 0 && monthKey(t.date) === key)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), value: total / 100 };
  });

  const thisKey = monthKey(now);
  const thisMonthTxs = store.transactions.filter((t) => t.amount < 0 && monthKey(t.date) === thisKey);
  const byCategory = new Map();
  for (const t of thisMonthTxs) byCategory.set(t.category, (byCategory.get(t.category) || 0) + Math.abs(t.amount));
  const segments = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([catId, value]) => ({ ...categoryById(catId), value }));
  const totalThisMonth = segments.reduce((s, seg) => s + seg.value, 0);

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = monthKey(lastMonthDate);
  const lastMonthTotal = store.transactions
    .filter((t) => t.amount < 0 && monthKey(t.date) === lastKey)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const momDelta = lastMonthTotal > 0 ? ((totalThisMonth - lastMonthTotal) / lastMonthTotal) * 100 : null;

  const anomalyIds = new Set(detectAnomalies(store.transactions));
  const anomalies = store.transactions
    .filter((t) => anomalyIds.has(t.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return `
    <div class="page-title">Insights</div>

    <div class="card">
      <div class="card-title">Spending Trend (6 months)</div>
      ${barChart(monthlySpend.map((m) => ({ label: m.label, value: m.value })), { width: 320, height: 130 })}
    </div>

    <div class="card">
      <div class="row">
        <div class="card-title" style="margin-bottom:0">This Month by Category</div>
        ${momDelta !== null ? `<span class="pill ${momDelta > 0 ? 'red' : 'green'}">${momDelta > 0 ? '+' : ''}${Math.round(momDelta)}% vs last mo.</span>` : ''}
      </div>
      <div class="row" style="margin-top:12px;align-items:center">
        ${donutChart(segments, { size: 140, thickness: 20 })}
        <div class="legend" style="flex-direction:column;align-items:flex-start;flex:1;margin-left:12px;margin-top:0">
          ${segments.slice(0, 6).map((s) => `
            <div class="legend-item">
              <span class="legend-dot" style="background:${s.color}"></span>
              <span>${s.icon} ${escapeHtml(s.name)} · ${fmtMoney(-s.value)} (${totalThisMonth ? Math.round((s.value / totalThisMonth) * 100) : 0}%)</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${!segments.length ? '<div class="empty-state"><div class="emoji">📊</div><div>No spending logged this month yet.</div></div>' : ''}
    </div>

    <div class="card">
      <div class="card-title">Unusual Transactions</div>
      ${anomalies.length ? anomalies.map((t) => {
        const cat = categoryById(t.category);
        return `
        <div class="list-item">
          <div class="icon-badge" style="background:${cat.color}26">⚠️</div>
          <div style="flex:1">
            <div class="item-title">${escapeHtml(t.merchant)}</div>
            <div class="item-sub">${relativeDate(t.date)} · higher than usual for ${cat.name}</div>
          </div>
          <div class="item-amount">${fmtMoney(t.amount)}</div>
        </div>
      `;
      }).join('') : '<div class="item-sub" style="padding:8px 0">Nothing unusual lately — spending looks consistent.</div>'}
    </div>
  `;
}
