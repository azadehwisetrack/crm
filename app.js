import { el, clear, initNetworkBanner } from './ui.js';
import { t, NAV } from './i18n.js';

const root = document.getElementById('app');

async function boot() {
  initNetworkBanner();
  const auth = await import('./auth.js');
  const { route, dispatch, currentPath } = await import('./router.js');
  const { renderLogin } = await import('./pages/login.js');
  const { renderSearch } = await import('./pages/search.js');
  const { renderAccount } = await import('./pages/account.js');
  const { createSearchBox } = await import('./pages/searchbox.js');
  const { renderSupport } = await import('./pages/support.js');
  const { renderQueues } = await import('./pages/queues.js');
  const { renderPlan } = await import('./pages/plan.js');
  const { renderDashboard } = await import('./pages/dashboard.js');
  const { renderSettings } = await import('./pages/settings.js');

  const SALES = ['sales'];
  route('/search', { roles: SALES, render: renderSearch });
  route('/account/:id', { roles: SALES, render: renderAccount });
  route('/queues', { roles: SALES, render: renderQueues });
  route('/queues/:q', { roles: SALES, render: renderQueues });
  route('/plan', { roles: SALES, render: renderPlan });
  route('/dashboard', { roles: SALES, render: renderDashboard });
  route('/settings', { roles: SALES, render: renderSettings });
  route('/support', { roles: ['support', 'sales'], render: renderSupport });

  let view = null;
  let nav = null;
  let headerSearch = null;

  function markNav() {
    if (!nav) return;
    const p = currentPath();
    nav.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href').slice(1);
      const on = p === href || p.startsWith(href + '/') || (href === '/search' && p.startsWith('/account/'));
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function renderShell() {
    const role = auth.state.profile.role;
    nav = el('nav', { class: 'nav', 'aria-label': 'منوی اصلی' },
      NAV[role].map(([path, label]) => el('a', { href: '#' + path }, label)));
    const logoutBtn = el('button', { type: 'button' }, t.logout);
    logoutBtn.addEventListener('click', () => auth.logout());
    headerSearch = role === 'sales' ? createSearchBox() : null;
    view = el('main', { id: 'view' });
    clear(root);
    root.append(
      el('header', { class: 'header' }, el('span', { class: 'brand' }, t.appName), nav,
        headerSearch ? headerSearch.root : null,
        el('span', { class: 'user' }, auth.state.profile.display_name, logoutBtn)),
      view);
    show();
  }

  async function show() {
    if (!auth.state.profile || !view) return;
    await dispatch(view, auth.state.profile.role);
    markNav();
  }

  function render() {
    if (!auth.state.profile) {
      view = null; nav = null; headerSearch = null;
      renderLogin(root, { onLogin: auth.login });
    } else {
      renderShell();
    }
  }

  // "/" focuses the global search (unless the user is typing somewhere).
  document.addEventListener('keydown', (e) => {
    if ((e.key !== '/' && e.code !== 'Slash') || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !headerSearch) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    e.preventDefault();
    headerSearch.focus();
  });

  auth.onChange(render);
  window.addEventListener('hashchange', show);
  await auth.init();
  render();
}

boot().catch((e) => {
  console.error(e);
  root.append(el('div', { class: 'card error' }, 'برنامه راه‌اندازی نشد. صفحه را دوباره بارگذاری کنید.'));
});
