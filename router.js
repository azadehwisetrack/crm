import { el, clear } from './ui.js';
import { t } from './i18n.js';

const routes = [];
export function route(pattern, { roles, render }) {
  const names = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, names, roles, render });
}

export const defaultPath = () => '/dashboard';

export function currentPath() {
  const raw = (location.hash || '').replace(/^#/, '');
  try { return decodeURIComponent(raw) || '/'; } catch { return '/'; }
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, m[i + 1]])) };
  }
  return null;
}

let cleanup = null;
let token = 0;

// Renders the page for the current hash into `view`. Role is enforced here (UI level; the database enforces it for real).
export async function dispatch(view, role) {
  const path = currentPath();
  const hit = match(path);
  if (!hit || !hit.route.roles.includes(role)) {
    const d = defaultPath(role);
    if (path !== d) { location.replace('#' + d); return; }
  }
  const mine = ++token;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  clear(view);
  if (!hit) { view.append(el('div', { class: 'card' }, t.notFound)); return; }
  try {
    const c = await hit.route.render(view, { params: hit.params, role });
    if (mine === token) cleanup = typeof c === 'function' ? c : null;
    else if (typeof c === 'function') c();
  } catch (e) {
    console.error(e);
    if (mine === token) { clear(view); view.append(el('div', { class: 'card error' }, 'بارگذاری صفحه با خطا مواجه شد.')); }
  }
}
