import { el, toast, friendlyError } from './ui.js';
import { api } from './api.js';
import { formatDate, todayTehran } from './jalali.js';

const td = (c, cls) => el('td', { class: cls }, c);

// Tasks table shared by the tasks page, dashboard and account page.
// opts: statuses (for the inline status select), omit: [column keys to hide], onChanged(), onEdit(row)
export function buildTasksTable(rows, { statuses = [], omit = [], onChanged, onEdit } = {}) {
  const today = todayTehran();
  const cols = [
    ['account', 'اکانت', (r) => el('a', { href: '#/account/' + r.account_id }, r.account_name)],
    ['person', 'شخص', (r) => r.person_name || '—'],
    ['mobile', 'موبایل شخص', (r) => (r.person_mobile ? el('a', { href: 'tel:' + r.person_mobile, class: 'ltr' }, r.person_mobile) : '—')],
    ['district', 'منطقه', (r) => r.account_district || '—'],
    ['description', 'شرح', (r) => r.description || '—', 'note'],
    ['date', 'تاریخ', (r) => formatDate(r.due_date), 'nowrap'],
    ['time', 'ساعت', (r) => String(r.due_time).slice(0, 5), 'nowrap'],
    ['type', 'نوع', (r) => r.type_name || '—'],
    ['user', 'کاربر', (r) => r.user_name || '—'],
    ['status', 'وضعیت', (r) => statusCell(r)],
    ['edit', '', (r) => { const b = el('button', { type: 'button', class: 'small-btn' }, 'ویرایش'); b.addEventListener('click', () => onEdit && onEdit(r)); return b; }],
  ].filter((c) => !omit.includes(c[0]));

  function statusCell(r) {
    if (!statuses.length) return r.status_name || '—';
    const sel = el('select', { class: 'status-select', 'aria-label': 'وضعیت' },
      el('option', { value: '', selected: !r.status_id }, '—'),
      ...statuses.map((s) => el('option', { value: s.id, selected: s.id === r.status_id }, s.name)));
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { await api.updateTask(r.id, { status_id: sel.value ? Number(sel.value) : null }); toast('وضعیت ذخیره شد.', 'ok'); if (onChanged) onChanged(); }
      catch (e) { toast(friendlyError(e), 'error'); sel.value = r.status_id ?? ''; } finally { sel.disabled = false; }
    });
    return sel;
  }

  const overdue = (r) => r.status_kind === 'todo' && r.due_date < today;
  return el('div', { class: 'table-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c[1])))),
    el('tbody', {}, rows.map((r) => el('tr', {}, cols.map((c) => td(c[2](r), [c[3], c[0] === 'date' && overdue(r) ? 'overdue' : ''].filter(Boolean).join(' ') || null)))))));
}
