// Turns a manually-added subscription's "next charge date" into a real,
// automatic action: once that date arrives, log a transaction for it,
// deduct it from the account, and roll the date forward to the next cycle.
// Auto-detected subscriptions (derived from real transaction history) are
// untouched here — they already represent real, already-logged charges.
import { db, uid } from './db.js';
import { store, notify, fmtMoney, toDateStr, todayStr } from './state.js';
import { toast } from './ui.js';

export function advanceDate(dateStr, cadence) {
  const d = new Date(dateStr + 'T00:00:00');
  switch (cadence) {
    case 'Weekly': d.setDate(d.getDate() + 7); break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
    case 'Monthly':
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return toDateStr(d);
}

async function chargeSubscription(sub, date) {
  const account = store.accounts.find((a) => a.id === sub.accountId);
  if (!account) return null;

  const tx = {
    id: uid(),
    accountId: sub.accountId,
    date,
    amount: sub.amount,
    merchant: sub.merchant,
    category: sub.category,
    note: '',
    method: account.type === 'cash' ? 'cash' : 'card',
    autoLogged: true,
  };
  account.balance += tx.amount;
  await db.put('transactions', tx);
  await db.put('accounts', account);
  store.transactions.push(tx);
  return tx;
}

// Processes every manual subscription whose next charge date has arrived,
// creating one transaction per missed cycle (capped so bad data can't loop
// forever). Returns the list of transactions it created.
export async function processDueSubscriptions() {
  const today = todayStr();
  const created = [];

  for (const sub of store.subscriptions) {
    if (!sub.nextDate || sub.paused) continue;
    let guard = 0;
    while (sub.nextDate <= today && guard < 24) {
      guard++;
      const tx = await chargeSubscription(sub, sub.nextDate);
      if (!tx) break;
      created.push(tx);
      sub.nextDate = advanceDate(sub.nextDate, sub.cadence);
    }
    await db.put('subscriptions', sub);
  }

  if (created.length) {
    notify();
    if (created.length === 1) {
      toast(`${created[0].merchant} auto-logged: ${fmtMoney(created[0].amount)}`);
    } else {
      const total = created.reduce((sum, t) => sum + t.amount, 0);
      toast(`${created.length} subscriptions auto-logged (${fmtMoney(total)})`);
    }
  }
  return created;
}

// Manually fires a single subscription's charge right now (e.g. the user
// tapping "Log now" on a subscription card), regardless of its stored next
// date. Logs today's transaction and resets the cycle to start from today,
// so the automatic due-date check never double-charges it later.
export async function logSubscriptionNow(subId) {
  const sub = store.subscriptions.find((s) => s.id === subId);
  if (!sub) return null;

  const today = todayStr();
  const tx = await chargeSubscription(sub, today);
  if (!tx) {
    toast('That account no longer exists');
    return null;
  }

  sub.nextDate = advanceDate(today, sub.cadence);
  await db.put('subscriptions', sub);

  notify();
  toast(`${sub.merchant} logged: ${fmtMoney(tx.amount)}`);
  return tx;
}
