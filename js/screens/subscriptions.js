import { db, uid } from '../db.js';
import { store, subscribe, notify, fmtMoney, categoryById, todayStr } from '../state.js';
import { detectRecurring } from '../smart.js';
import { openSheet, toast, escapeHtml } from '../ui.js';
import { processDueSubscriptions } from '../autopay.js';

const CADENCES = [
  { id: 'Weekly', days: 7 },
  { id: 'Monthly', days: 30 },
  { id: 'Quarterly', days: 90 },
  { id: 'Yearly', days: 365 },
];

function monthlyEquivalent(amount, cadenceDays) {
  return Math.round((amount / cadenceDays) * 30);
}

export async function renderSubscriptions(root) {
  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
    container.querySelector('#add-sub').addEventListener('click', () => openSubForm());
    container.querySelectorAll('.list-item[data-sub-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const s = store.subscriptions.find((x) => x.id === el.dataset.subId);
        if (s) openSubForm(s);
      });
    });
  }

  const unsub = subscribe(paint);
  paint();
  return unsub;
}

function buildHtml() {
  const detected = detectRecurring(store.transactions);
  const manual = store.subscriptions;
  const all = [
    ...detected.map((d) => ({ ...d, source: 'detected' })),
    ...manual.map((m) => ({ ...m, cadenceDays: CADENCES.find((c) => c.id === m.cadence)?.days || 30, source: 'manual' })),
  ].sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

  const monthlyTotal = all.reduce((s, r) => s + monthlyEquivalent(Math.abs(r.amount), r.cadenceDays), 0);

  return `
    <div class="page-title">Subscriptions</div>

    <div class="card">
      <div class="card-title">Estimated Monthly Cost</div>
      <div class="hero-amount">${fmtMoney(-monthlyTotal)}</div>
      <div class="item-sub">${all.length} recurring charge${all.length === 1 ? '' : 's'}</div>
    </div>

    ${all.length ? all.map((r) => {
      const cat = categoryById(r.category);
      return `
      <div class="card list-item ${r.source === 'manual' ? '' : ''}" ${r.source === 'manual' ? `data-sub-id="${r.id}" style="cursor:pointer;border-bottom:none"` : 'style="border-bottom:none"'}>
        <div class="icon-badge" style="background:${cat.color}26">${cat.icon}</div>
        <div style="flex:1">
          <div class="item-title">${escapeHtml(r.merchant)}</div>
          <div class="item-sub">${r.cadence} · Next ${new Date(r.nextDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            ${r.source === 'detected' ? ' · auto-detected' : ''}
            ${r.priceIncrease ? ' · <span style="color:var(--red)">price increased</span>' : ''}
          </div>
        </div>
        <div class="item-amount">${fmtMoney(-Math.abs(r.amount))}</div>
      </div>
    `;
    }).join('') : `
      <div class="empty-state">
        <div class="emoji">🔁</div>
        <div>No subscriptions yet. They'll show up automatically once we spot repeating charges, or add one manually.</div>
      </div>
    `}

    <button class="btn btn-primary btn-block" id="add-sub" style="margin-top:6px">+ Add Subscription</button>
  `;
}

function openSubForm(sub = null) {
  const isEdit = !!sub;
  const categories = store.categories;
  const accounts = store.accounts;
  let selectedCat = sub?.category || categories.find((c) => c.id === 'subscriptions')?.id || categories[0]?.id;
  let selectedAccount = sub?.accountId || accounts[0]?.id;
  let selectedCadence = sub?.cadence || 'Monthly';

  const html = `
    <div class="sheet-title">${isEdit ? 'Edit Subscription' : 'Add Subscription'}</div>
    <div class="field-label">Name</div>
    <input class="field" id="sf-name" placeholder="e.g. Netflix" value="${escapeHtml(sub?.merchant || '')}" />
    <div class="field-label">Amount</div>
    <input class="field" id="sf-amount" inputmode="decimal" placeholder="$0.00" value="${sub ? (Math.abs(sub.amount) / 100).toFixed(2) : ''}" />
    <div class="field-label">Billing Cycle</div>
    <div class="segmented" id="sf-cadence">
      ${CADENCES.map((c) => `<button data-cadence="${c.id}" class="${c.id === selectedCadence ? 'active' : ''}">${c.id}</button>`).join('')}
    </div>
    <div class="field-label">Next Charge Date</div>
    <input class="field" id="sf-date" type="date" value="${sub?.nextDate || todayStr()}" />
    <div class="item-sub" style="margin-top:-8px;margin-bottom:14px">On this date we'll automatically log the transaction and deduct it from the account below — no need to enter it by hand.</div>
    <div class="field-label">Category</div>
    <div class="chip-row" id="sf-cats">
      ${categories.map((c) => `<button type="button" class="chip ${c.id === selectedCat ? 'selected' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
    <div class="field-label">Account</div>
    <div class="chip-row" id="sf-accounts">
      ${accounts.map((a) => `<button type="button" class="chip ${a.id === selectedAccount ? 'selected' : ''}" data-acc="${a.id}">${escapeHtml(a.name)}</button>`).join('')}
    </div>
    <button class="btn btn-primary" id="sf-save">${isEdit ? 'Save Changes' : 'Add Subscription'}</button>
    ${isEdit ? '<button class="btn btn-secondary btn-block" id="sf-delete" style="margin-top:10px">Delete</button>' : ''}
  `;

  openSheet(html, {
    onMount(sheetEl, close) {
      sheetEl.querySelector('#sf-cadence').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cadence]');
        if (!btn) return;
        selectedCadence = btn.dataset.cadence;
        sheetEl.querySelectorAll('#sf-cadence button').forEach((b) => b.classList.toggle('active', b === btn));
      });
      sheetEl.querySelector('#sf-cats').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cat]');
        if (!btn) return;
        selectedCat = btn.dataset.cat;
        sheetEl.querySelectorAll('#sf-cats .chip').forEach((b) => b.classList.toggle('selected', b === btn));
      });
      sheetEl.querySelector('#sf-accounts').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-acc]');
        if (!btn) return;
        selectedAccount = btn.dataset.acc;
        sheetEl.querySelectorAll('#sf-accounts .chip').forEach((b) => b.classList.toggle('selected', b === btn));
      });

      sheetEl.querySelector('#sf-save').addEventListener('click', async () => {
        const name = sheetEl.querySelector('#sf-name').value.trim();
        const raw = parseFloat(sheetEl.querySelector('#sf-amount').value.replace(/[^0-9.]/g, ''));
        if (!name) { toast('Enter a name'); return; }
        if (!raw || raw <= 0) { toast('Enter an amount'); return; }
        const record = {
          id: sub?.id || uid(),
          merchant: name,
          amount: -Math.round(raw * 100),
          cadence: selectedCadence,
          nextDate: sheetEl.querySelector('#sf-date').value,
          category: selectedCat,
          accountId: selectedAccount,
          source: 'manual',
        };
        await db.put('subscriptions', record);
        const idx = store.subscriptions.findIndex((s) => s.id === record.id);
        if (idx >= 0) store.subscriptions[idx] = record; else store.subscriptions.push(record);
        notify();
        close();
        const created = await processDueSubscriptions();
        if (!created.length) toast(isEdit ? 'Subscription updated' : 'Subscription added');
      });

      const del = sheetEl.querySelector('#sf-delete');
      if (del) {
        del.addEventListener('click', async () => {
          await db.delete('subscriptions', sub.id);
          store.subscriptions = store.subscriptions.filter((s) => s.id !== sub.id);
          notify();
          toast('Subscription deleted');
          close();
        });
      }
    },
  });
}
