import { el, clear, initNetworkBanner } from './ui.js';
import { t, NAV } from './i18n.js';
import * as auth from './auth.js';
import { route, dispatch, currentPath } from './router.js';
import { renderLogin } from './page-login.js';
import { renderDashboard } from './page-dashboard.js';
import { renderAccounts } from './page-accounts.js';
import { renderAccount } from './page-account.js';
import { renderPersons } from './page-persons.js';
import { renderTasks } from './page-tasks.js';
import { renderSettings } from './page-settings.js';

const root = document.getElementById('app');
const SALES = ['sales'];

route('/dashboard', { roles: SALES, render: renderDashboard });
route('/accounts', { roles: SALES, render: renderAccounts });
route('/account/:id', { roles: SALES, render: renderAccount });
route('/persons', { roles: SALES, render: renderPersons });
route('/tasks', { roles: SALES, render: renderTasks });
route('/settings', { roles: SALES, render: renderSettings });
route('/settings/:tab', { roles: SALES, render: renderSettings });

let view = null;
let nav = null;

function markNav() {
  if (!nav) return;
  const p = currentPath();
  nav.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href').slice(1);
    const on = p === href || p.startsWith(href + '/') || (href === '/accounts' && p.startsWith('/account/'));
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function renderShell() {
  const profile = auth.state.profile;
  const full = profile.role === 'sales'; // other roles have no access to the data yet (database rules enforce this too)
  nav = full ? el('nav', { class: 'nav', 'aria-label': 'منوی اصلی' }, NAV.map(([path, label]) => el('a', { href: '#' + path }, label))) : el('nav', { class: 'nav' });
  const logoutBtn = el('button', { type: 'button' }, t.logout);
  logoutBtn.addEventListener('click', () => auth.logout());
  view = el('main', { id: 'view' });
  clear(root);
  root.append(el('header', { class: 'header' }, el('span', { class: 'brand' }, t.appName), nav, el('span', { class: 'user' }, profile.display_name, logoutBtn)), view);
  if (full) show(); else view.append(el('div', { class: 'card' }, t.noAccess));
}

async function show() {
  if (!auth.state.profile || !view || auth.state.profile.role !== 'sales') return;
  await dispatch(view, 'sales');
  markNav();
}

function render() {
  if (!auth.state.profile) { view = null; nav = null; renderLogin(root, { onLogin: auth.login }); } else renderShell();
}

async function boot() {
  initNetworkBanner();
  auth.onChange(render);
  window.addEventListener('hashchange', show);
  await auth.init();
  render();
}

boot().catch((e) => {
  console.error(e);
  root.append(el('div', { class: 'card error' }, 'برنامه راه‌اندازی نشد. صفحه را دوباره بارگذاری کنید.'));
});
