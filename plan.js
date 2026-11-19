import { el, clear, toast, toastError, copyText } from '../ui.js';
import { api } from '../api.js';
import { dateField } from '../fields.js';
import { todayTehran, planDefaultDay, addDays, weekdayName, formatDate } from '../jalali.js';
import { buildPlanText } from '../plantext.js';

const td = (c, cls) => el('td', { class: cls }, c);
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));
const stageBadge = (s) => el('span', { class: 'badge stage-' + String(s).replace(' ', '-') }, s);

export async function renderPlan(view) {
  let skipFriday = true;
  try { skipFriday = (await api.settings({ quiet: true })).find((r) => r.key === 'skip_friday_tomorrow')?.value !== 'false'; } catch { /* default: skip */ }
  let iso = planDefaultDay(todayTehran(), skipFriday);
  let seq = 0;

  const date = dateField('تاریخ برنامه', { iso, required: true });
  const dayName = el('span', { class: 'muted' }, weekdayName(iso));
  const prev = el('button', { type: 'button' }, 'روز قبل');
  const next = el('button', { type: 'button' }, 'روز بعد');
  const copyBtn = el('button', { type: 'button', class: 'primary' }, 'کپی متن');
  const holder = el('div');
  view.append(el('div', { class: 'card' }, el('h1', {}, 'برنامه روز'),
    el('div', { class: 'plan-bar' }, date.root, dayName, prev, next, copyBtn)), el('div', { class: 'card' }, holder));

  let rows = [];
  async function refresh() {
    const v = date.value();
    if (!v.ok || !v.iso) return;
    iso = v.iso;
    dayName.textContent = weekdayName(iso);
    const my = ++seq;
    clear(holder); holder.append(el('p', { class: 'muted' }, 'در حال بارگذاری…'));
    try { rows = await api.dayPlan(iso); } catch (e) { if (my !== seq) return; rows = []; clear(holder); toastError(e); holder.append(el('p', { class: 'error' }, 'بارگذاری برنامه ناموفق بود.')); return; }
    if (my !== seq) return;
    clear(holder);
    copyBtn.disabled = !rows.length;
    if (!rows.length) { holder.append(el('p', { class: 'muted' }, 'برای این روز قدم بعدی ثبت نشده است.')); return; }
    holder.append(el('h2', {}, `${rows.length} مورد`), el('div', { class: 'table-wrap' }, el('table', {}, th('اکانت', 'کانتکت', 'موبایل', 'آدرس', 'قدم بعدی', 'مرحله', 'محصول', 'منطقه'),
      el('tbody', {}, rows.map((r) => el('tr', { class: 'clickable', onclick: (e) => { if (!e.target.closest('a')) location.hash = '#/account/' + r.account_id; } },
        td(el('a', { href: '#/account/' + r.account_id }, r.account_name)), td(r.contact_name || '—'),
        td(r.contact_mobile ? el('a', { href: 'tel:' + r.contact_mobile, class: 'ltr' }, r.contact_mobile) : '—'),
        td(r.address || '—'), td(r.next_step_text || '—', 'note'), td(stageBadge(r.stage)), td(r.product_name), td(r.district || '—')))))));
  }

  const shift = (n) => { const v = date.value(); const base = v.ok && v.iso ? v.iso : iso; date.input.value = formatDate(addDays(base, n)); refresh(); };
  prev.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
  date.input.addEventListener('change', refresh);
  date.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); refresh(); } });
  copyBtn.addEventListener('click', async () => {
    if (await copyText(buildPlanText({ dateText: formatDate(iso), rows }))) toast('متن برنامه کپی شد.', 'ok'); else toast('کپی انجام نشد. اجازهٔ مرورگر را بررسی کنید.', 'error');
  });
  await refresh();
}
