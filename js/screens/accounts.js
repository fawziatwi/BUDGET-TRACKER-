import { db, uid } from '../db.js';
import { store, subscribe, notify, fmtMoney } from '../state.js';
import { progressBar } from '../charts.js';
import { openSheet, toast, escapeHtml } from '../ui.js';

const TYPES = [
  { id: 'checking', label: 'Checking', icon: '🏦' },
  { id: 'savings', label: 'Savings', icon: '💎' },
  { id: 'credit_card', label: 'Credit Card', icon: '💳' },
  { id: 'cash', label: 'Cash', icon: '💵' },
];

export async function renderAccounts(root) {
  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
    container.querySelector('#add-account').addEventListener('click', () => openAccountForm());
    container.querySelectorAll('.list-item[data-acc-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const a = store.accounts.find((x) => x.id === el.dataset.accId);
        if (a) openAccountForm(a);
      });
    });
  }

  const unsub = subscribe(paint);
  paint();
  return unsub;
}

function buildHtml() {
  const netWorth = store.accounts.reduce((s, a) => s + a.balance, 0);

  return `
    <div class="page-title">Accounts</div>
    <div class="card">
      <div class="card-title">Total Net Position</div>
      <div class="hero-amount">${fmtMoney(netWorth)}</div>
    </div>

    ${store.accounts.map((a) => {
      const type = TYPES.find((t) => t.id === a.type) || TYPES[0];
      const isCard = a.type === 'credit_card';
      const owed = isCard ? Math.max(0, -a.balance) : 0;
      const utilization = isCard && a.creditLimit ? owed / a.creditLimit : 0;
      return `
        <div class="card list-item" data-acc-id="${a.id}" style="cursor:pointer;border-bottom:none">
          <div style="width:100%">
            <div class="row">
              <span class="hstack"><span class="icon-badge" style="background:${a.color}26">${type.icon}</span>
                <span class="item-title">${escapeHtml(a.name)}</span></span>
              <span class="item-amount ${a.balance < 0 ? '' : 'positive'}">${fmtMoney(a.balance)}</span>
            </div>
            ${isCard ? `
              <div style="margin-top:10px">${progressBar(utilization, { color: utilization > 0.8 ? 'var(--red)' : utilization > 0.5 ? 'var(--orange)' : 'var(--green)' })}</div>
              <div class="item-sub" style="margin-top:6px">${fmtMoney(owed)} owed of ${fmtMoney(a.creditLimit || 0)} limit</div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('')}

    <button class="btn btn-primary btn-block" id="add-account" style="margin-top:6px">+ Add Account</button>
  `;
}

function openAccountForm(account = null) {
  const isEdit = !!account;
  let selectedType = account?.type || 'checking';

  const html = `
    <div class="sheet-title">${isEdit ? 'Edit Account' : 'Add Account'}</div>
    <div class="field-label">Name</div>
    <input class="field" id="af-name" placeholder="e.g. Chase Checking" value="${escapeHtml(account?.name || '')}" />
    <div class="field-label">Type</div>
    <div class="chip-row" id="af-types">
      ${TYPES.map((t) => `<button type="button" class="chip ${t.id === selectedType ? 'selected' : ''}" data-type="${t.id}">${t.icon} ${t.label}</button>`).join('')}
    </div>
    <div class="field-label">Current Balance ${isEdit ? '' : ''}</div>
    <input class="field" id="af-balance" inputmode="decimal" placeholder="$0.00" value="${account ? (account.balance / 100).toFixed(2) : ''}" />
    <div id="af-limit-wrap" style="${selectedType === 'credit_card' ? '' : 'display:none'}">
      <div class="field-label">Credit Limit</div>
      <input class="field" id="af-limit" inputmode="decimal" placeholder="$0.00" value="${account?.creditLimit ? (account.creditLimit / 100).toFixed(2) : ''}" />
    </div>
    <button class="btn btn-primary" id="af-save">${isEdit ? 'Save Changes' : 'Add Account'}</button>
    ${isEdit ? '<button class="btn btn-secondary btn-block" id="af-delete" style="margin-top:10px">Delete Account</button>' : ''}
  `;

  openSheet(html, {
    onMount(sheetEl, close) {
      sheetEl.querySelector('#af-types').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-type]');
        if (!btn) return;
        selectedType = btn.dataset.type;
        sheetEl.querySelectorAll('#af-types .chip').forEach((b) => b.classList.toggle('selected', b === btn));
        sheetEl.querySelector('#af-limit-wrap').style.display = selectedType === 'credit_card' ? '' : 'none';
      });

      sheetEl.querySelector('#af-save').addEventListener('click', async () => {
        const name = sheetEl.querySelector('#af-name').value.trim();
        if (!name) { toast('Enter a name'); return; }
        const balanceRaw = parseFloat(sheetEl.querySelector('#af-balance').value.replace(/[^0-9.-]/g, '')) || 0;
        const limitRaw = parseFloat(sheetEl.querySelector('#af-limit')?.value.replace(/[^0-9.]/g, '') || '0') || 0;
        const record = {
          id: account?.id || uid(),
          name,
          type: selectedType,
          balance: Math.round(balanceRaw * 100),
          creditLimit: selectedType === 'credit_card' ? Math.round(limitRaw * 100) : undefined,
          color: account?.color || TYPES.find((t) => t.id === selectedType)?.color || '#007aff',
        };
        await db.put('accounts', record);
        const idx = store.accounts.findIndex((a) => a.id === record.id);
        if (idx >= 0) store.accounts[idx] = record; else store.accounts.push(record);
        notify();
        toast(isEdit ? 'Account updated' : 'Account added');
        close();
      });

      const del = sheetEl.querySelector('#af-delete');
      if (del) {
        del.addEventListener('click', async () => {
          const hasTxs = store.transactions.some((t) => t.accountId === account.id);
          if (hasTxs) { toast('Delete or reassign this account\'s transactions first'); return; }
          await db.delete('accounts', account.id);
          store.accounts = store.accounts.filter((a) => a.id !== account.id);
          notify();
          toast('Account deleted');
          close();
        });
      }
    },
  });
}
