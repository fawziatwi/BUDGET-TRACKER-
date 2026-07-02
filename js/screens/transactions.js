import { store, subscribe, fmtMoney, categoryById } from '../state.js';
import { escapeHtml } from '../ui.js';
import { openTransactionForm } from './transactionForm.js';

export async function renderTransactions(root) {
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '+';
  fab.addEventListener('click', () => openTransactionForm());
  document.body.appendChild(fab);

  const container = document.createElement('div');
  container.className = 'screen screen--fab';
  root.appendChild(container);

  let search = '';
  let activeCategory = 'all';

  function paint() {
    container.innerHTML = buildHtml(search, activeCategory);
    wireEvents();
  }

  function wireEvents() {
    const searchInput = container.querySelector('#search');
    searchInput.value = search;
    searchInput.addEventListener('input', (e) => {
      search = e.target.value;
      const caret = e.target.selectionStart;
      paint();
      const el = container.querySelector('#search');
      el.focus();
      el.setSelectionRange(caret, caret);
    });

    container.querySelector('#cat-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cat]');
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      paint();
    });

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

function buildHtml(search, activeCategory) {
  const q = search.trim().toLowerCase();
  let txs = [...store.transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
  if (q) txs = txs.filter((t) => t.merchant.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
  if (activeCategory !== 'all') txs = txs.filter((t) => t.category === activeCategory);

  const groups = new Map();
  for (const t of txs) {
    const label = new Date(t.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(t);
  }

  const usedCategoryIds = new Set(store.transactions.map((t) => t.category));
  const filterCats = store.categories.filter((c) => usedCategoryIds.has(c.id));

  return `
    <div class="page-title">Activity</div>
    <input class="search-bar" id="search" placeholder="Search transactions" />
    <div class="chip-row" id="cat-filters">
      <button type="button" class="chip ${activeCategory === 'all' ? 'selected' : ''}" data-cat="all">All</button>
      ${filterCats.map((c) => `<button type="button" class="chip ${activeCategory === c.id ? 'selected' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
    ${txs.length ? [...groups.entries()].map(([label, items]) => `
      <div class="card">
        <div class="card-title">${label}</div>
        ${items.map(txRow).join('')}
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <div>No transactions found.</div>
      </div>
    `}
  `;
}

function txRow(t) {
  const cat = categoryById(t.category);
  return `
    <div class="list-item" data-id="${t.id}" style="cursor:pointer">
      <div class="icon-badge" style="background:${cat.color}26">${cat.icon}</div>
      <div style="flex:1">
        <div class="item-title">${escapeHtml(t.merchant)}</div>
        <div class="item-sub">${cat.name}${t.note ? ' · ' + escapeHtml(t.note) : ''} ${t.method === 'cash' ? '· 💵 cash' : ''}</div>
      </div>
      <div class="item-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${fmtMoney(t.amount)}</div>
    </div>
  `;
}
