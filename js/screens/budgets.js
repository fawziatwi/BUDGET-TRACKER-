import { db, uid } from '../db.js';
import { store, subscribe, notify, fmtMoney, categoryById } from '../state.js';
import { progressBar } from '../charts.js';
import { budgetPacing } from '../smart.js';
import { openSheet, toast, escapeHtml } from '../ui.js';

export async function renderBudgets(root) {
  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
    container.querySelector('#add-budget').addEventListener('click', () => openBudgetForm());
    container.querySelectorAll('.list-item[data-budget-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const b = store.budgets.find((x) => x.id === el.dataset.budgetId);
        if (b) openBudgetForm(b);
      });
    });
  }

  const unsub = subscribe(paint);
  paint();
  return unsub;
}

function buildHtml() {
  const now = new Date();
  const rows = store.budgets
    .map((b) => ({ b, pacing: budgetPacing(b, store.transactions, now), cat: categoryById(b.categoryId) }))
    .sort((a, c) => c.pacing.pctUsed - a.pacing.pctUsed);

  const totalLimit = store.budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.pacing.spent, 0);

  return `
    <div class="page-title">Budgets</div>

    ${rows.length ? `
      <div class="card">
        <div class="card-title">This Month</div>
        <div class="row">
          <div style="font-size:22px;font-weight:700">${fmtMoney(-totalSpent)}</div>
          <div class="item-sub">of ${fmtMoney(totalLimit)} budgeted</div>
        </div>
        ${progressBar(totalLimit > 0 ? totalSpent / totalLimit : 0, { color: totalSpent > totalLimit ? 'var(--red)' : 'var(--accent)', height: 10 })}
      </div>
    ` : ''}

    ${rows.map(({ b, pacing, cat }) => `
      <div class="card list-item" data-budget-id="${b.id}" style="border-bottom:none;cursor:pointer">
        <div style="width:100%">
          <div class="row">
            <span class="item-title">${cat.icon} ${escapeHtml(cat.name)}</span>
            <span class="pill ${pacing.pace === 'over' ? 'red' : pacing.pace === 'ahead' ? 'orange' : 'green'}">
              ${pacing.pace === 'over' ? 'Over budget' : pacing.pace === 'ahead' ? 'Spending fast' : 'On track'}
            </span>
          </div>
          <div class="row" style="margin-top:6px">
            <span class="item-sub">${fmtMoney(-pacing.spent)} spent</span>
            <span class="item-sub">${fmtMoney(b.monthlyLimit)} limit</span>
          </div>
          <div style="margin-top:8px">${progressBar(pacing.pctUsed, { color: pacing.pace === 'over' ? 'var(--red)' : pacing.pace === 'ahead' ? 'var(--orange)' : 'var(--green)' })}</div>
          <div class="item-sub" style="margin-top:8px">Projected month-end: ${fmtMoney(-pacing.projected)}</div>
        </div>
      </div>
    `).join('')}

    ${!rows.length ? `
      <div class="empty-state">
        <div class="emoji">🎯</div>
        <div>No budgets yet. Set one to start tracking your pace.</div>
      </div>
    ` : ''}

    <button class="btn btn-primary btn-block" id="add-budget" style="margin-top:6px">+ New Budget</button>
  `;
}

function openBudgetForm(budget = null) {
  const isEdit = !!budget;
  const availableCats = store.categories.filter((c) => isEdit ? true : !store.budgets.some((b) => b.categoryId === c.id));
  let selectedCat = budget?.categoryId || availableCats[0]?.id;

  const html = `
    <div class="sheet-title">${isEdit ? 'Edit Budget' : 'New Budget'}</div>
    <div class="field-label">Category</div>
    <div class="chip-row" id="bf-cats">
      ${availableCats.map((c) => `<button type="button" class="chip ${c.id === selectedCat ? 'selected' : ''}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`).join('')}
    </div>
    <div class="field-label">Monthly Limit</div>
    <input class="field" id="bf-limit" inputmode="decimal" placeholder="$0.00" value="${budget ? (budget.monthlyLimit / 100).toFixed(2) : ''}" />
    <button class="btn btn-primary" id="bf-save">${isEdit ? 'Save Changes' : 'Create Budget'}</button>
    ${isEdit ? '<button class="btn btn-secondary btn-block" id="bf-delete" style="margin-top:10px">Delete Budget</button>' : ''}
  `;

  openSheet(html, {
    onMount(sheetEl, close) {
      sheetEl.querySelector('#bf-cats').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cat]');
        if (!btn) return;
        selectedCat = btn.dataset.cat;
        sheetEl.querySelectorAll('#bf-cats .chip').forEach((b) => b.classList.toggle('selected', b === btn));
      });

      sheetEl.querySelector('#bf-save').addEventListener('click', async () => {
        const raw = parseFloat(sheetEl.querySelector('#bf-limit').value.replace(/[^0-9.]/g, ''));
        if (!raw || raw <= 0) { toast('Enter a monthly limit'); return; }
        if (!selectedCat) { toast('Choose a category'); return; }
        const record = { id: budget?.id || uid(), categoryId: selectedCat, monthlyLimit: Math.round(raw * 100) };
        await db.put('budgets', record);
        const idx = store.budgets.findIndex((b) => b.id === record.id);
        if (idx >= 0) store.budgets[idx] = record; else store.budgets.push(record);
        notify();
        toast(isEdit ? 'Budget updated' : 'Budget created');
        close();
      });

      const del = sheetEl.querySelector('#bf-delete');
      if (del) {
        del.addEventListener('click', async () => {
          await db.delete('budgets', budget.id);
          store.budgets = store.budgets.filter((b) => b.id !== budget.id);
          notify();
          toast('Budget deleted');
          close();
        });
      }
    },
  });
}
