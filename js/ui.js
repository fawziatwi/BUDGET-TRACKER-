// Small shared UI helpers: bottom sheet, toast, confirm.

export function openSheet(innerHtml, { onMount, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet">
      <div class="sheet-drag">
        <div class="sheet-handle"></div>
        <button type="button" class="sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="sheet-scroll">${innerHtml}</div>
    </div>
  `;
  const sheetEl = backdrop.querySelector('.sheet');
  const scrollEl = backdrop.querySelector('.sheet-scroll');
  const dragHandle = backdrop.querySelector('.sheet-drag');

  // Slide-up entrance driven by the CSS `transition` (not a @keyframes
  // animation — animation + transition on the same property can conflict and
  // leave the sheet parked off-screen if the animation doesn't resolve).
  sheetEl.style.transform = 'translateY(100%)';
  document.body.appendChild(backdrop);
  sheetEl.getBoundingClientRect(); // force layout so the starting position is registered
  requestAnimationFrame(() => {
    sheetEl.style.transform = 'translateY(0)';
  });

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = previousOverflow;
    backdrop.classList.add('closing');
    sheetEl.style.transform = 'translateY(100%)';
    setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  // Tapping the dimmed area outside the sheet closes it.
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  // Always-visible close button — the reliable way to dismiss, since on iOS
  // the first tap outside a focused input just dismisses the keyboard rather
  // than registering as a click.
  backdrop.querySelector('.sheet-close').addEventListener('click', close);

  // Swipe-down-to-dismiss on the handle/header area, iOS-native feel.
  let startY = null;
  let dragY = 0;
  dragHandle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    sheetEl.style.transition = 'none';
  }, { passive: true });
  dragHandle.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dragY = Math.max(0, e.touches[0].clientY - startY);
    sheetEl.style.transform = `translateY(${dragY}px)`;
  }, { passive: true });
  dragHandle.addEventListener('touchend', () => {
    sheetEl.style.transition = '';
    if (dragY > 90) {
      close();
    } else {
      sheetEl.style.transform = '';
    }
    startY = null;
    dragY = 0;
  });

  if (onMount) onMount(scrollEl, close);
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
