// Small shared UI helpers: bottom sheet, toast, confirm.

export function openSheet(innerHtml, { onMount, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${innerHtml}</div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
  const sheetEl = backdrop.querySelector('.sheet');

  function close() {
    backdrop.remove();
    if (onClose) onClose();
  }

  if (onMount) onMount(sheetEl, close);
  return close;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = `
      position: fixed; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      background: rgba(20,20,20,0.92); color: #fff; padding: 10px 18px;
      border-radius: 999px; font-size: 13px; font-weight: 600; z-index: 200;
      transition: opacity 0.2s ease; opacity: 0; pointer-events: none;
    `;
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function relativeDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
