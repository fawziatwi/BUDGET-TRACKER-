const routes = new Map();
let mountEl = null;
let currentCleanup = null;

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function initRouter(el) {
  mountEl = el;
  window.addEventListener('hashchange', render);
  render();
}

export function navigate(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

export function currentPath() {
  return (location.hash || '#/dashboard').slice(1);
}

async function render() {
  const path = currentPath();
  const base = '/' + path.split('/')[1];
  const renderFn = routes.get(base) || routes.get('/dashboard');
  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }
  mountEl.innerHTML = '';
  currentCleanup = await renderFn(mountEl, path);
  mountEl.scrollTop = 0;
  document.dispatchEvent(new CustomEvent('routechange', { detail: { path: base } }));
}

export function rerender() {
  render();
}
