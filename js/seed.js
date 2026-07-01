export const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#34c759' },
  { id: 'dining', name: 'Dining', icon: '🍔', color: '#ff9500' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#5ac8fa' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#ff3b30' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔁', color: '#af52de' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ff2d55' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#5856d6' },
  { id: 'health', name: 'Health', icon: '💊', color: '#32ade6' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#007aff' },
  { id: 'income', name: 'Income', icon: '💰', color: '#30d158' },
  { id: 'transfer', name: 'Transfer', icon: '↔️', color: '#8e8e93' },
  { id: 'other', name: 'Other', icon: '📦', color: '#98989d' },
];

// Keyword -> category id, used for first-pass auto-suggestion before the
// learned merchantCategoryMap takes over.
export const CATEGORY_KEYWORDS = {
  groceries: ['grocery', 'market', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'aldi', 'costco'],
  dining: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'sushi', 'doordash', 'ubereats', 'grubhub', 'chipotle'],
  transport: ['uber', 'lyft', 'gas', 'shell', 'chevron', 'parking', 'transit', 'metro', 'fuel'],
  bills: ['electric', 'water bill', 'internet', 'comcast', 'verizon', 'at&t', 'insurance', 'rent', 'mortgage'],
  subscriptions: ['netflix', 'spotify', 'hulu', 'disney+', 'apple music', 'amazon prime', 'youtube premium', 'icloud', 'gym'],
  shopping: ['amazon', 'target', 'walmart', 'best buy', 'mall', 'store'],
  entertainment: ['movie', 'cinema', 'theater', 'concert', 'game'],
  health: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'dental', 'clinic'],
  travel: ['airline', 'hotel', 'airbnb', 'flight', 'delta', 'united'],
  income: ['payroll', 'salary', 'deposit', 'paycheck'],
};

export async function seedIfEmpty(db) {
  const existing = await db.getAll('categories');
  if (!existing.length) {
    await db.bulkPut('categories', DEFAULT_CATEGORIES);
  }
  const settings = await db.getAll('settings');
  if (!settings.length) {
    await db.bulkPut('settings', [
      { key: 'currency', value: 'USD' },
      { key: 'currencySymbol', value: '$' },
      { key: 'monthStartDay', value: 1 },
      { key: 'onboarded', value: false },
    ]);
  }
}
