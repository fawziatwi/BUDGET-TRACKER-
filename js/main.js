import { db, uid } from './db.js';
import { store, notify } from './state.js';
import { seedIfEmpty } from './seed.js';
import { registerRoute, initRouter, navigate, currentPath } from './router.js';

import { renderDashboard } from './screens/dashboard.js';
import { renderTransactions } from './screens/transactions.js';
import { renderBudgets } from './screens/budgets.js';
import { renderSubscriptions } from './screens/subscriptions.js';
import { renderAccounts } from './screens/accounts.js';
import { renderInsights } from './screens/insights.js';
import { renderSettings } from './screens/settings.js';

const TABS = [
  { path: '/dashboard', icon: '🏠', label: 'Home' },
  { path: '/transactions', icon: '📋', label: 'Activity' },
  { path: '/budgets', icon: '🎯', label: 'Budgets' },
  { path: '/subscriptions', icon: '🔁', label: 'Subs' },
  { path: '/insights', icon: '📊', label: 'Insights' },
  { path: '/more', icon: '⚙️', label: 'More' },
];

async function seedDefaultAccounts() {
  const existing = await db.getAll('accounts');
  if (existing.length) return;
  const defaults = [
    { id: uid(), name: 'Cash', type: 'cash', balance: 0, color: '#34c759' },
    { id: uid(), name: 'Checking', type: 'checking', balance: 0, color: '#007aff' },
    { id: uid(), name: 'Savings', type: 'savings', balance: 0, color: '#5ac8fa' },
    { id: uid(), name: 'Credit Card', type: 'credit_card', balance: 0, creditLimit: 500000, color: '#ff3b30' },
  ];
  await db.bulkPut('accounts', defaults);
}

async function loadStore() {
  const [accounts, transactions, categories, budgets, subscriptions, merchantCategoryMap, settingsRows] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('transactions'),
    db.getAll('categories'),
    db.getAll('budgets'),
    db.getAll('subscriptions'),
    db.getAll('merchantCategoryMap'),
    db.getAll('settings'),
  ]);
  store.accounts = accounts;
  store.transactions = transactions;
  store.categories = categories;
  store.budgets = budgets;
  store.subscriptions = subscriptions;
  store.merchantCategoryMap = merchantCategoryMap;
  store.settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
}

function renderTabBar() {
  const bar = document.createElement('div');
  bar.className = 'tab-bar';
  bar.innerHTML = `<div class="tab-bar-inner">${TABS.map((t) => `
    <button class="tab-btn" data-path="${t.path}">
      <span class="tab-icon">${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `).join('')}</div>`;

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-path]');
    if (btn) navigate(btn.dataset.path);
  });

  function updateActive() {
    const base = '/' + currentPath().split('/')[1];
    bar.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.path === base));
  }
  document.addEventListener('routechange', updateActive);
  updateActive();
  document.body.appendChild(bar);
}

async function main() {
  await seedIfEmpty(db);
  await seedDefaultAccounts();
  await loadStore();

  registerRoute('/dashboard', renderDashboard);
  registerRoute('/transactions', renderTransactions);
  registerRoute('/budgets', renderBudgets);
  registerRoute('/subscriptions', renderSubscriptions);
  registerRoute('/accounts', renderAccounts);
  registerRoute('/insights', renderInsights);
  registerRoute('/more', renderSettings);
  registerRoute('/settings', renderSettings);

  const app = document.getElementById('app');
  initRouter(app);
  renderTabBar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

main();
