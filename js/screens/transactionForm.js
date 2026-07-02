import { db, uid } from '../db.js';
import { store, notify, todayStr } from '../state.js';
import { openSheet, toast, escapeHtml } from '../ui.js';
import { suggestCategory, learnedEntry } from '../smart.js';

export function openTransactionForm({ transaction = null } = {}) {
  const isEdit = !!transaction;
  const categories = store.categories;
  const accounts = store.accounts;
  const recentMerchants = [...new Set(store.transactions.map((t) => t.merchant).filter(Boolean))].slice(0, 30);

  let kind = transaction ? (transaction.amount >= 0 ? 'income' : 'expense') : 'expense';
  let selectedCategory = transaction?.category || null;
  let selectedAccount = transaction?.accountId || accounts[0]?.id || null;

  const html = `
    <div class="sheet-title">${isEdit ? 'Edit Transaction' : 'Add Transaction'}</div>
    <input class="amount-input" id="tf-amount" inputmode="decimal" placeholder="$0.00"
      value="${transaction ? (Math.abs(transaction.amount) / 100).toFixed(2) : ''}" />
    <div class="segmented" id="tf-kind">
      <button data-kind="expense" class="${kind === 'expense' ? 'active' : ''}">Expense</button>
      <button data-kind="income" class="${kind === 'income' ? 'active' : ''}">Income</button>
    </div>
    <div class="field-label">Merchant / Description</div>
    <input class="field" id="tf-merchant" list="tf-merchant-list" placeholder="e.g. Starbucks"
      value="${escapeHtml(transaction?.merchant || '')}" />
    <datalist id="tf-merchant-list">
      ${recentMerchants.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('')}
    </datalist>
    <div class="field-label">Category</div>
    <div class="chip-row" id="tf-categories">
      ${categories.map((c) => `<button type="button" class="chip" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
    <div class="field-label">Account</div>
    <div class="chip-row" id="tf-accounts">
      ${accounts.map((a) => `<button type="button" class="chip" data-acc="${a.id}">${{ cash: '💵', credit_card: '💳', savings: '💎' }[a.type] || '🏦'} ${escapeHtml(a.name)}</button>`).join('')}
    </div>
    <div class="field-label">Date</div>
    <input class="field" id="tf-date" type="date" value="${(transaction?.date || todayStr())}" />
    <div class="field-label">Note (optional)</div>
    <input class="field" id="tf-note" placeholder="Add a note" value="${escapeHtml(transaction?.note || '')}" />
    <button class="btn btn-primary" id="tf-save">${isEdit ? 'Save Changes' : 'Add Transaction'}</button>
    ${isEdit ? '<button class="btn btn-secondary btn-block" id="tf-delete" style="margin-top:10px">Delete</button>' : ''}
  `;

  openSheet(html, {
    onMount(sheetEl, close) {
      const amountInput = sheetEl.querySelector('#tf-amount');
      amountInput.focus();

      sheetEl.querySelector('#tf-kind').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-kind]');
        if (!btn) return;
        kind = btn.dataset.kind;
        sheetEl.querySelectorAll('#tf-kind button').forEach((b) => b.classList.toggle('active', b === btn));
      });

      function selectCategory(id) {
        selectedCategory = id;
        sheetEl.querySelectorAll('#tf-categories .chip').forEach((b) => b.classList.toggle('selected', b.dataset.cat === id));
      }
      if (selectedCategory) selectCategory(selectedCategory);
      sheetEl.querySelector('#tf-categories').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cat]');
        if (btn) selectCategory(btn.dataset.cat);
      });

      function selectAccount(id) {
        selectedAccount = id;
        sheetEl.querySelectorAll('#tf-accounts .chip').forEach((b) => b.classList.toggle('selected', b.dataset.acc === id));
      }
      if (selectedAccount) selectAccount(selectedAccount);
      sheetEl.querySelector('#tf-accounts').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-acc]');
        if (btn) selectAccount(btn.dataset.acc);
      });

      const merchantInput = sheetEl.querySelector('#tf-merchant');
      merchantInput.addEventListener('change', () => {
        if (selectedCategory) return;
        const suggestion = suggestCategory(merchantInput.value, store.merchantCategoryMap);
        if (suggestion) selectCategory(suggestion);
      });

      sheetEl.querySelector('#tf-save').addEventListener('click', async () => {
        const rawAmount = parseFloat(amountInput.value.replace(/[^0-9.]/g, ''));
        if (!rawAmount || rawAmount <= 0) { toast('Enter an amount'); return; }
        if (!selectedAccount) { toast('Select an account'); return; }
        const category = selectedCategory || 'other';
        const merchant = merchantInput.value.trim() || (kind === 'income' ? 'Income' : 'Other');
        const cents = Math.round(rawAmount * 100) * (kind === 'income' ? 1 : -1);
        const date = sheetEl.querySelector('#tf-date').value || todayStr();
        const note = sheetEl.querySelector('#tf-note').value.trim();

        const record = {
          id: transaction?.id || uid(),
          accountId: selectedAccount,
          date,
          amount: cents,
          merchant,
          category,
          note,
          method: accounts.find((a) => a.id === selectedAccount)?.type === 'cash' ? 'cash' : 'card',
        };

        // Adjust account balance: remove old effect if editing, apply new.
        const account = accounts.find((a) => a.id === selectedAccount);
        if (isEdit && transaction.accountId === selectedAccount) {
          account.balance = account.balance - transaction.amount + cents;
        } else {
          if (isEdit) {
            const oldAccount = accounts.find((a) => a.id === transaction.accountId);
            if (oldAccount) {
              oldAccount.balance -= transaction.amount;
              await db.put('accounts', oldAccount);
            }
          }
          account.balance += cents;
        }
        await db.put('accounts', account);
        await db.put('transactions', record);
        await db.put('merchantCategoryMap', learnedEntry(merchant, category));

        if (isEdit) {
          const idx = store.transactions.findIndex((t) => t.id === record.id);
          if (idx >= 0) store.transactions[idx] = record;
        } else {
          store.transactions.push(record);
        }
        const mIdx = store.merchantCategoryMap.findIndex((m) => m.merchant === learnedEntry(merchant, category).merchant);
        const entry = learnedEntry(merchant, category);
        if (mIdx >= 0) store.merchantCategoryMap[mIdx] = entry; else store.merchantCategoryMap.push(entry);

        notify();
        toast(isEdit ? 'Transaction updated' : 'Transaction added');
        close();
      });

      const deleteBtn = sheetEl.querySelector('#tf-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const account = accounts.find((a) => a.id === transaction.accountId);
          if (account) {
            account.balance -= transaction.amount;
            await db.put('accounts', account);
          }
          await db.delete('transactions', transaction.id);
          store.transactions = store.transactions.filter((t) => t.id !== transaction.id);
          notify();
          toast('Transaction deleted');
          close();
        });
      }
    },
  });
}
