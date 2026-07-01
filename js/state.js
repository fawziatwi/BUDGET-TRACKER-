// Minimal pub-sub store so screens can react to data changes without a framework.
const listeners = new Set();

export const store = {
  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  subscriptions: [],
  merchantCategoryMap: [],
  settings: {},
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(store);
}

export function fmtMoney(cents, currencySymbol = store.settings.currencySymbol || '$') {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents) / 100;
  return `${sign}${currencySymbol}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function categoryById(id) {
  return store.categories.find((c) => c.id === id) || { name: 'Other', icon: '📦', color: '#98989d' };
}

export function accountById(id) {
  return store.accounts.find((a) => a.id === id);
}

export function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
