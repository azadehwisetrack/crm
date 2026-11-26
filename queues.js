import { el, clear, toastError } from './ui.js';
import { api, QUEUE_PAGE_SIZE } from './api.js';
import { loadLookups, label } from './lookups.js';
import { formatDate, todayTehran } from './jalali.js';
import { openQuickLog } from './quicklog.js';

export const QUEUES = [
  { key: 'q1', view: 'v_q1', label: 'تماس امروز و عقب‌افتاده' },
  { key: 'q2', view: 'v_q2', label: 'New بدون تماس' },
  { key: 'q3', view: 'v_q3', label: 'New با تلاش بی‌پاسخ' },
  { key: 'q4', view: 'v_q4', label: 'In progress بدون پیگیری' },
  { key: 'q5', view: 'v_q5', label: 'In progress بی‌حرکت' },
  { key: 'q6', view: 'v_q6', label: 'Pending سررسیدشده' },
  { key: 'q7', view: 'v_q7', label: 'Won بدون راهنمایی' },
  { key: 'noopp', view: 'v_accounts_without_opportunity', label: 'اکانت‌های بدون فرصت' },
  { key: 'needs_sales', view: 'v_support_needs_sales', label: 'نیاز به تماس فروش' },
];

const td = (c, cls) => el('td', { class: cls }, c);
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));
const stageBadge = (s) => el('span', { class: 'badge stage-' + String(s).replace(' ', '-') }, s);

export async function renderQueues(view, { params }) {
  let current = QUEUES.find((q) => q.key === params.q) || QUEUES[0];
  let page = 0;
  let seq = 0;
  const counts = {};

  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'انتخاب صف' });
  const holder = el('div');
  view.append(el('div', { class: 'card' }, el('h1', {}, 'صف‌ها'), chips), el('div', { class: 'card' }, holder));
  await loadLookups().catch(() => {});

  function drawChips() {
    clear(chips);
    for (const q of QUEUES) {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(q.key === current.key) },
        q.label, el('span', { class: 'chip-count' }, counts[q.key] ?? '…'));
      b.addEventListener('click', () => { current = q; page = 0; history.replaceState(null, '', '#/queues/' + q.key); drawChips(); loadTable(); });
      chips.append(b);
    }
  }

  async function loadCounts() {
    await Promise.all(QUEUES.map(async (q) => {
      try { counts[q.key] = await api.queueCount(q.view); } catch { counts[q.key] = '؟'; }
    }));
    drawChips();
  }

  async function quickLog(row, button) {
    button.disabled = true;
    try {
      const [contacts, opps] = await Promise.all([api.accountContacts(row.account_id, { quiet: true }), api.accountOpportunities(row.account_id, { quiet: true })]);
      openQuickLog({ account: { id: row.account_id, name: row.account_name }, opps, contacts, defaults: { opportunity_id: row.opportunity_id }, onSaved: () => { loadCounts(); loadTable(); } });
    } catch (e) { toastError(e); } finally { button.disabled = false; }
  }

  async function loadTable() {
    const my = ++seq;
    clear(holder);
    holder.append(el('p', { class: 'muted' }, 'در حال بارگذاری…'));
    let res;
    try { res = await api.queuePage(current.view, page); } catch (e) { if (my !== seq) return; clear(holder); toastError(e); holder.append(el('p', { class: 'error' }, 'بارگذاری صف ناموفق بود.')); return; }
    if (my !== seq) return;
    clear(holder);
    counts[current.key] = res.count; drawChips();
    holder.append(el('h2', {}, `${current.label} (${res.count})`));
    if (!res.rows.length) { holder.append(el('p', { class: 'muted' }, page > 0 ? 'این صفحه خالی است.' : 'موردی در این صف نیست.')); return; }

    const today = todayTehran();
    let table;
    if (current.view === 'v_accounts_without_opportunity') {
      table = el('table', {}, th('اکانت', 'شهر', 'منطقه', 'آدرس'),
        el('tbody', {}, res.rows.map((r) => el('tr', { class: 'clickable', onclick: (e) => { if (!e.target.closest('a')) location.hash = '#/account/' + r.account_id; } },
          td(el('a', { href: '#/account/' + r.account_id }, r.account_name)), td(r.city || '—'), td(r.district || '—'), td(r.address || '—')))));
    } else {
      table = el('table', {}, th('اکانت', 'محصول', 'مرحله', 'قدم بعدی', 'روز از آخرین', 'کانتکت', 'موبایل', 'منطقه', 'آخرین اقدام', ''),
        el('tbody', {}, res.rows.map((r) => {
          const cls = r.next_step_date ? (r.next_step_date < today ? 'overdue' : r.next_step_date === today ? 'due-today' : '') : '';
          const last = r.last_activity_at ? [formatDate(r.last_activity_at), label('activity_type', r.last_activity_type), label('activity_result', r.last_activity_result)].filter(Boolean).join(' · ') : '—';
          const qb = el('button', { type: 'button', class: 'small-btn' }, 'ثبت اقدام');
          qb.addEventListener('click', () => quickLog(r, qb));
          return el('tr', { class: 'clickable', onclick: (e) => { if (!e.target.closest('a,button')) location.hash = '#/account/' + r.account_id; } },
            td(el('a', { href: '#/account/' + r.account_id }, r.account_name)), td(r.product_name), td(stageBadge(r.stage)),
            td(r.next_step_date ? `${formatDate(r.next_step_date)}${r.next_step_text ? ' — ' + r.next_step_text : ''}` : '—', cls),
            td(r.days_since_last ?? '—'), td(r.contact_name || '—'), td(r.contact_mobile ? el('a', { href: 'tel:' + r.contact_mobile, class: 'ltr' }, r.contact_mobile) : '—'),
            td(r.district || '—'), td(last), td(qb));
        })));
    }
    holder.append(el('div', { class: 'table-wrap' }, table));

    const pages = Math.max(1, Math.ceil(res.count / QUEUE_PAGE_SIZE));
    if (pages > 1) {
      const prev = el('button', { type: 'button', disabled: page === 0 }, 'قبلی');
      const next = el('button', { type: 'button', disabled: page >= pages - 1 }, 'بعدی');
      prev.addEventListener('click', () => { page--; loadTable(); });
      next.addEventListener('click', () => { page++; loadTable(); });
      holder.append(el('div', { class: 'actions top-gap' }, prev, el('span', { class: 'muted' }, `صفحه ${page + 1} از ${pages}`), next));
    }
  }

  drawChips();
  loadCounts();
  await loadTable();
}
