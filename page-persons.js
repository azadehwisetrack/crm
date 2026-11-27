import { el, clear, toastError, pager } from './ui.js';
import { api } from './api.js';
import { normFa } from './normalize.js';
import { openPersonDialog } from './dlg-person.js';

const SIZE = 50;
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));

export async function renderPersons(view) {
  const holder = el('div');
  const filter = el('input', { type: 'search', placeholder: 'جستجو در اشخاص…', 'aria-label': 'جستجو' });
  const add = el('button', { type: 'button', class: 'primary' }, '+ شخص جدید');
  view.append(el('div', { class: 'card' }, el('div', { class: 'row' }, el('h1', {}, 'اشخاص'), add), el('div', { class: 'filter-bar top-gap' }, filter), holder));
  let all = [], page = 0;
  const accountOf = (p) => (p.account_contacts || []).filter((l) => l.status === 'active' && l.accounts).map((l) => l.accounts);

  function draw() {
    const needle = normFa(filter.value);
    const rows = needle ? all.filter((p) => normFa([p.first_name, p.last_name, p.mobile, p.job_title, ...accountOf(p).map((a) => a.name)].filter(Boolean).join(' ')).includes(needle)) : all;
    clear(holder);
    if (!rows.length) { holder.append(el('p', { class: 'muted' }, all.length ? 'موردی پیدا نشد.' : 'هنوز شخصی تعریف نشده است.')); return; }
    holder.append(el('div', { class: 'table-wrap' }, el('table', {}, th('نام', 'نام خانوادگی', 'شماره موبایل', 'عنوان شغلی', 'اکانت', ''),
      el('tbody', {}, rows.slice(page * SIZE, page * SIZE + SIZE).map((p) => {
        const edit = el('button', { type: 'button', class: 'small-btn' }, 'ویرایش');
        edit.addEventListener('click', () => openPersonDialog({ person: p, onSaved: load }));
        return el('tr', {}, el('td', {}, p.first_name || '—'), el('td', {}, p.last_name),
          el('td', {}, p.mobile ? el('a', { href: 'tel:' + p.mobile, class: 'ltr' }, p.mobile) : '—'), el('td', {}, p.job_title || '—'),
          el('td', {}, accountOf(p).length ? accountOf(p).map((a, i) => [i ? '، ' : '', el('a', { href: '#/account/' + a.id }, a.name)]) : '—'), el('td', {}, edit));
      })))));
    const pg = pager(rows.length, page, SIZE, (n) => { page = n; draw(); });
    if (pg) holder.append(pg);
  }
  async function load() {
    try { all = await api.persons(); } catch (e) { toastError(e); clear(holder); holder.append(el('p', { class: 'error' }, 'بارگذاری اشخاص ناموفق بود.')); return; }
    draw();
  }
  filter.addEventListener('input', () => { page = 0; draw(); });
  add.addEventListener('click', () => openPersonDialog({ onSaved: load }));
  holder.append(el('p', { class: 'muted' }, 'در حال بارگذاری…'));
  await load();
}
