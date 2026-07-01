import { store, subscribe, fmtMoney, categoryById, monthKey } from '../state.js';
import { progressRing, progressBar } from '../charts.js';
import { generateInsights, budgetPacing, detectRecurring } from '../smart.js';
import { relativeDate, escapeHtml } from '../ui.js';
import { navigate } from '../router.js';
import { openTransactionForm } from './transactionForm.js';

export async function renderDashboard(root) {
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '+';
  fab.addEventListener('click', () => openTransactionForm());
  document.body.appendChild(fab);

  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
    container.querySelectorAll('.list-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const tx = store.transactions.find((t) => t.id === el.dataset.id);
        if (tx) openTransactionForm({ transaction: tx });
      });
    });
  }

  const unsub = subscribe(paint);
  paint();

  return () => {
    unsub();
    fab.remove();
  };
}

function buildHtml() {
  const now = new Date();
  const thisKey = monthKey(now);

  const netWorth = store.accounts.reduce((sum, a) => sum + a.balance, 0);
  const cashLike = store.accounts.filter((a) => a.type !== 'credit_card').reduce((s, a) => s + a.balance, 0);
  const debt = store.accounts.filter((a) => a.type === 'credit_card').reduce((s, a) => s + Math.max(0, -a.balance), 0);

  const monthTxs = store.transactions.filter((t) => monthKey(t.date) === thisKey);
  const spend = monthTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spendPct = income > 0 ? spend / income : (spend > 0 ? 1 : 0);

  const insights = generateInsights({ transactions: store.transactions, categories: store.categories, referenceDate: now });

  const budgetRows = store.budgets
    .map((b) => ({ b, pacing: budgetPacing(b, store.transactions, now), cat: categoryById(b.categoryId) }))
    .sort((a, c) => c.pacing.pctUsed - a.pacing.pctUsed)
    .slice(0, 3);

  const recurring = detectRecurring(store.transactions)
    .concat(store.subscriptions.map((s) => ({ ...s, amount: s.amount })))
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
    .slice(0, 3);

  const recentTxs = [...store.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return `
    <div class="page-title">Home</div>

    <div class="card hero">
      <div class="card-title">Net Position</div>
      <div class="hero-amount">${fmtMoney(netWorth)}</div>
      <div class="hstack" style="margin-top:8px; flex-wrap:wrap; gap:8px;">
        <span class="pill gray">💰 ${fmtMoney(cashLike)} available</span>
        ${debt > 0 ? `<span class="pill red">💳 ${fmtMoney(debt)} owed</span>` : ''}
      </div>
    </div>

    ${insights.length ? `
      <div class="insight-callout">
        <span>💡</span>
        <span>${insights.map(escapeHtml).join(' ')}</span>
      </div>
    ` : ''}

    <div class="card">
      <div class="row">
        <div>
          <div class="card-title">This Month</div>
          <div style="font-size:22px;font-weight:700">${fmtMoney(-spend)}</div>
          <div class="item-sub">spent of ${income > 0 ? fmtMoney(income) + ' income' : 'no income logged'}</div>
        </div>
        ${progressRing(spendPct, { size: 76, thickness: 9, color: spendPct > 1 ? 'var(--red)' : 'var(--accent)' })}
      </div>
    </div>

    ${budgetRows.length ? `
      <div class="card">
        <div class="row">
          <div class="card-title" style="margin-bottom:0">Budget Pace</div>
          <button class="link-btn" onclick="window.__nav('/budgets')">See All</button>
        </div>
        <div class="stack" style="margin-top:10px">
          ${budgetRows.map(({ b, pacing, cat }) => `
            <div>
              <div class="row" style="margin-top:0">
                <span class="item-title">${cat.icon} ${escapeHtml(cat.name)}</span>
                <span class="item-sub">${fmtMoney(-pacing.spent)} / ${fmtMoney(b.monthlyLimit)}</span>
              </div>
              ${progressBar(pacing.pctUsed, { color: pacing.pace === 'over' ? 'var(--red)' : pacing.pace === 'ahead' ? 'var(--orange)' : 'var(--green)' })}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${recurring.length ? `
      <div class="card">
        <div class="row">
          <div class="card-title" style="margin-bottom:0">Upcoming Subscriptions</div>
          <button class="link-btn" onclick="window.__nav('/subscriptions')">See All</button>
        </div>
        <div class="stack" style="margin-top:10px">
          ${recurring.map((r) => `
            <div class="list-item">
              <div class="icon-badge" style="background:rgba(175,82,222,0.15)">🔁</div>
              <div style="flex:1">
                <div class="item-title">${escapeHtml(r.merchant)}</div>
                <div class="item-sub">Next ${new Date(r.nextDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              </div>
              <div class="item-amount">${fmtMoney(-Math.abs(r.amount))}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div class="row">
        <div class="card-title" style="margin-bottom:0">Recent Activity</div>
        <button class="link-btn" onclick="window.__nav('/transactions')">See All</button>
      </div>
      <div style="margin-top:4px">
        ${recentTxs.length ? recentTxs.map(txRow).join('') : `
          <div class="empty-state">
            <div class="emoji">🧾</div>
            <div>No transactions yet. Tap + to add your first one.</div>
          </div>
        `}
      </div>
    </div>
  `;
}

function txRow(t) {
  const cat = categoryById(t.category);
  return `
    <div class="list-item" data-id="${t.id}" style="cursor:pointer">
      <div class="icon-badge" style="background:${cat.color}26">${cat.icon}</div>
      <div style="flex:1">
        <div class="item-title">${escapeHtml(t.merchant)}</div>
        <div class="item-sub">${relativeDate(t.date)} · ${cat.name}</div>
      </div>
      <div class="item-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${fmtMoney(t.amount)}</div>
    </div>
  `;
}

window.__nav = navigate;
