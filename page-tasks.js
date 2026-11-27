import { el, clear, toastError, pager } from './ui.js';
import { api, PAGE } from './api.js';
import { loadLists } from './lists.js';
import { selectEl } from './fields.js';
import { buildTasksTable } from './tasks-ui.js';
import { openTaskDialog } from './dlg-task.js';

export async function renderTasks(view) {
  const holder = el('div');
  const add = el('button', { type: 'button', class: 'primary' }, '+ کار جدید');
  const lists = await loadLists().catch((e) => { toastError(e); return { statuses: [] }; });
  const statusFilter = selectEl([{ value: '', label: 'همهٔ وضعیت‌ها' }, ...lists.statuses.map((s) => ({ value: s.id, label: s.name }))], '');
  statusFilter.setAttribute('aria-label', 'فیلتر وضعیت');
  view.append(el('div', { class: 'card' }, el('div', { class: 'row' }, el('h1', {}, 'کارها'), add), el('div', { class: 'filter-bar top-gap' }, statusFilter), holder));
  let page = 0, seq = 0;

  async function load() {
    const my = ++seq;
    let res;
    try { res = await api.tasksPage(statusFilter.value ? Number(statusFilter.value) : null, page); }
    catch (e) { if (my !== seq) return; toastError(e); clear(holder); holder.append(el('p', { class: 'error' }, 'بارگذاری کارها ناموفق بود.')); return; }
    if (my !== seq) return;
    clear(holder);
    if (!res.rows.length) { holder.append(el('p', { class: 'muted' }, page > 0 ? 'این صفحه خالی است.' : 'کاری پیدا نشد.')); return; }
    holder.append(buildTasksTable(res.rows, { statuses: lists.statuses, onChanged: load, onEdit: (r) => openTaskDialog({ task: r, onSaved: load }) }));
    const pg = pager(res.count, page, PAGE, (n) => { page = n; load(); });
    if (pg) holder.append(pg);
  }
  statusFilter.addEventListener('change', () => { page = 0; load(); });
  add.addEventListener('click', () => openTaskDialog({ onSaved: load }));
  holder.append(el('p', { class: 'muted' }, 'در حال بارگذاری…'));
  await load();
}
