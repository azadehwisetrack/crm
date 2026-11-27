import { el, clear, toastError, pager } from './ui.js';
import { api } from './api.js';
import { normFa } from './normalize.js';
import { openAccountDialog } from './dlg-account.js';

const SIZE = 50;
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));

export async function renderAccounts(view) {
  const holder = el('div');
  const filter = el('input', { type: 'search', placeholder: 'جستجو در اکانت‌ها…', 'aria-label': 'جستجو' });
  const add = el('button', { type: 'button', class: 'primary' }, '+ اکانت جدید');
  view.append(el('div', { class: 'card' }, el('div', { class: 'row' }, el('h1', {}, 'اکانت‌ها'), add),
    el('div', { class: 'filter-bar top-gap' }, filter), holder));
  let all = [], page = 0;

  function draw() {
    const needle = normFa(filter.value);
    const rows = needle ? all.filter((a) => normFa([a.name, a.landline, a.city, a.district, a.address, a.activity_fields?.name].filter(Boolean).join(' ')).includes(needle)) : all;
    clear(holder);
    if (!rows.length) { holder.append(el('p', { class: 'muted' }, all.length ? 'موردی پیدا نشد.' : 'هنوز اکانتی تعریف نشده است.')); return; }
    const slice = rows.slice(page * SIZE, page * SIZE + SIZE);
    holder.append(el('div', { class: 'table-wrap' }, el('table', {}, th('عنوان', 'تلفن', 'شهر', 'منطقه', 'آدرس', 'حوزه فعالیت'),
      el('tbody', {}, slice.map((a) => el('tr', { class: 'clickable', onclick: (e) => { if (!e.target.closest('a')) location.hash = '#/account/' + a.id; } },
        el('td', {}, el('a', { href: '#/account/' + a.id }, a.name)), el('td', { class: 'ltr' }, a.landline || '—'), el('td', {}, a.city || '—'),
        el('td', {}, a.district || '—'), el('td', {}, a.address || '—'), el('td', {}, a.activity_fields?.name || '—')))))));
    const pg = pager(rows.length, page, SIZE, (n) => { page = n; draw(); });
    if (pg) holder.append(pg);
  }

  async function load() {
    try { all = (await api.accounts()).filter((a) => a.status === 'active'); } catch (e) { toastError(e); holder.append(el('p', { class: 'error' }, 'بارگذاری اکانت‌ها ناموفق بود.')); return; }
    draw();
  }
  filter.addEventListener('input', () => { page = 0; draw(); });
  add.addEventListener('click', () => openAccountDialog({ onSaved: (a) => { location.hash = '#/account/' + a.id; } }));
  holder.append(el('p', { class: 'muted' }, 'در حال بارگذاری…'));
  await load();
}
