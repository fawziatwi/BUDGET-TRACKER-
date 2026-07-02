import { db, uid, exportAll, importAll } from '../db.js';
import { store, subscribe, notify, fmtMoney, todayStr } from '../state.js';
import { openSheet, toast, escapeHtml } from '../ui.js';
import { navigate } from '../router.js';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AED', symbol: 'AED ' },
];

export async function renderSettings(root) {
  const container = document.createElement('div');
  container.className = 'screen';
  root.appendChild(container);

  function paint() {
    container.innerHTML = buildHtml();
    wireEvents();
  }

  function wireEvents() {
    container.querySelector('#go-accounts').addEventListener('click', () => navigate('/accounts'));

    container.querySelector('#currency-select').addEventListener('change', async (e) => {
      const c = CURRENCIES.find((x) => x.code === e.target.value);
      await db.put('settings', { key: 'currency', value: c.code });
      await db.put('settings', { key: 'currencySymbol', value: c.symbol });
      store.settings.currency = c.code;
      store.settings.currencySymbol = c.symbol;
      notify();
      toast('Currency updated');
    });

    container.querySelector('#export-json').addEventListener('click', doExportJson);
    container.querySelector('#export-csv').addEventListener('click', doExportCsv);
    container.querySelector('#import-file').addEventListener('change', doImport);
    container.querySelector('#add-category').addEventListener('click', openAddCategory);
    container.querySelectorAll('.cat-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(btn.dataset.id);
      });
    });
  }

  const unsub = subscribe(paint);
  paint();
  return unsub;
}

function buildHtml() {
  return `
    <div class="page-title">More</div>

    <div class="card">
      <div class="card-title">Accounts</div>
      <div class="list-item" id="go-accounts" style="cursor:pointer;border-bottom:none">
        <div class="icon-badge" style="background:rgba(0,122,255,0.15)">🏦</div>
        <div style="flex:1">
          <div class="item-title">Manage Accounts</div>
          <div class="item-sub">${store.accounts.length} account${store.accounts.length === 1 ? '' : 's'}</div>
        </div>
        <div style="color:var(--text-secondary)">›</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Currency</div>
      <select class="field" id="currency-select" style="margin-bottom:0">
        ${CURRENCIES.map((c) => `<option value="${c.code}" ${store.settings.currency === c.code ? 'selected' : ''}>${c.code} (${c.symbol.trim()})</option>`).join('')}
      </select>
    </div>

    <div class="card">
      <div class="row">
        <div class="card-title" style="margin-bottom:0">Categories</div>
      </div>
      <div style="margin-top:8px">
        ${store.categories.map((c) => `
          <div class="list-item">
            <div class="icon-badge" style="background:${c.color}26">${c.icon}</div>
            <div style="flex:1" class="item-title">${escapeHtml(c.name)}</div>
            <button class="icon-btn cat-delete" data-id="${c.id}">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary btn-block" id="add-category" style="margin-top:10px">+ Add Category</button>
    </div>

    <div class="card">
      <div class="card-title">Backup & Export</div>
      <div class="item-sub" style="margin-bottom:12px">Your data lives only on this device. Export regularly so you never lose it.</div>
      <button class="btn btn-secondary btn-block" id="export-json">Export Full Backup (JSON)</button>
      <button class="btn btn-secondary btn-block" id="export-csv" style="margin-top:10px">Export Transactions (CSV)</button>
      <div class="field-label" style="margin-top:16px">Restore from Backup</div>
      <input type="file" accept="application/json" id="import-file" class="field" style="padding:8px" />
    </div>

    <div class="card">
      <div class="card-title">About</div>
      <div class="item-sub">Smart Budget Tracker · all data stored locally on your device · no ads, no tracking, no bank credentials.</div>
    </div>
  `;
}

async function doExportJson() {
  const data = await exportAll();
  downloadFile(JSON.stringify(data, null, 2), `budget-backup-${todayStr()}.json`, 'application/json');
  toast('Backup exported');
}

function doExportCsv() {
  const header = 'Date,Merchant,Category,Amount,Account,Method,Note\n';
  const rows = store.transactions
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((t) => {
      const account = store.accounts.find((a) => a.id === t.accountId);
      const cat = store.categories.find((c) => c.id === t.category);
      const csvEscape = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      return [t.date, csvEscape(t.merchant), csvEscape(cat?.name || t.category), (t.amount / 100).toFixed(2), csvEscape(account?.name || ''), t.method, csvEscape(t.note || '')].join(',');
    })
    .join('\n');
  downloadFile(header + rows, `transactions-${todayStr()}.csv`, 'text/csv');
  toast('Transactions exported');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function doImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importAll(data);
    toast('Backup restored — reloading...');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    toast('Could not read that backup file');
  }
  e.target.value = '';
}

function openAddCategory() {
  const html = `
    <div class="sheet-title">New Category</div>
    <div class="field-label">Name</div>
    <input class="field" id="nc-name" placeholder="e.g. Pets" />
    <div class="field-label">Icon (emoji)</div>
    <input class="field" id="nc-icon" placeholder="🐾" value="📦" maxlength="4" />
    <button class="btn btn-primary" id="nc-save">Add Category</button>
  `;
  openSheet(html, {
    onMount(sheetEl, close) {
      sheetEl.querySelector('#nc-save').addEventListener('click', async () => {
        const name = sheetEl.querySelector('#nc-name').value.trim();
        if (!name) { toast('Enter a name'); return; }
        const icon = sheetEl.querySelector('#nc-icon').value.trim() || '📦';
        const record = { id: uid(), name, icon, color: '#8e8e93' };
        await db.put('categories', record);
        store.categories.push(record);
        notify();
        toast('Category added');
        close();
      });
    },
  });
}

async function deleteCategory(id) {
  const inUse = store.transactions.some((t) => t.category === id) || store.budgets.some((b) => b.categoryId === id);
  if (inUse) { toast('This category is in use — reassign those transactions first'); return; }
  await db.delete('categories', id);
  store.categories = store.categories.filter((c) => c.id !== id);
  notify();
  toast('Category removed');
}
