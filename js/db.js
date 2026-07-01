// IndexedDB wrapper — single DB, small promise-based API. No dependencies.
const DB_NAME = 'budgetTracker';
const DB_VERSION = 1;

const STORES = {
  accounts: 'id',
  transactions: 'id',
  categories: 'id',
  budgets: 'id',
  subscriptions: 'id',
  merchantCategoryMap: 'merchant',
  settings: 'key',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath });
        }
      }
      const txStore = req.transaction.objectStore('transactions');
      if (!txStore.indexNames.contains('date')) txStore.createIndex('date', 'date');
      if (!txStore.indexNames.contains('accountId')) txStore.createIndex('accountId', 'accountId');
      if (!txStore.indexNames.contains('category')) txStore.createIndex('category', 'category');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const db = {
  async getAll(store) {
    const s = await tx(store);
    return wrap(s.getAll());
  },
  async get(store, key) {
    const s = await tx(store);
    return wrap(s.get(key));
  },
  async put(store, value) {
    const s = await tx(store, 'readwrite');
    return wrap(s.put(value));
  },
  async bulkPut(store, values) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const t = database.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const v of values) os.put(v);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },
  async delete(store, key) {
    const s = await tx(store, 'readwrite');
    return wrap(s.delete(key));
  },
  async clear(store) {
    const s = await tx(store, 'readwrite');
    return wrap(s.clear());
  },
};

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function exportAll() {
  const data = {};
  for (const store of Object.keys(STORES)) {
    data[store] = await db.getAll(store);
  }
  data.exportedAt = new Date().toISOString();
  return data;
}

export async function importAll(data) {
  for (const store of Object.keys(STORES)) {
    if (Array.isArray(data[store]) && data[store].length) {
      await db.bulkPut(store, data[store]);
    }
  }
}
