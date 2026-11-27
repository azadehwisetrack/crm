import { el, toastError } from './ui.js';
import { api } from './api.js';
import { loadLists } from './lists.js';
import { buildTasksTable } from './tasks-ui.js';
import { openTaskDialog } from './dlg-task.js';
import { todayTehran, formatDate } from './jalali.js';

const stat = (value, text) => el('div', { class: 'stat' }, el('div', { class: 'stat-value' }, String(value ?? 0)), el('div', { class: 'muted' }, text));

export async function renderDashboard(view) {
  view.append(el('div', { class: 'card muted' }, 'در حال بارگذاری…'));
  async function load() {
    let d, tasks, lists;
    try { [d, tasks, lists] = await Promise.all([api.dashboard(), api.tasksOnDate(todayTehran()), loadLists()]); }
    catch (e) { view.replaceChildren(el('div', { class: 'card error' }, 'بارگذاری داشبورد ناموفق بود.')); toastError(e); return; }
    d = d || {};
    view.replaceChildren(
      el('div', { class: 'card' }, el('h1', {}, 'داشبورد'),
        el('div', { class: 'stats' }, stat(d.todo_count, 'کارهای برای انجام'), stat(d.won_count, 'پیروزی‌ها'), stat(d.meetings_week, 'جلسات هفتهٔ جاری'))),
      el('div', { class: 'card' }, el('h2', {}, `کارهای امروز (${formatDate(todayTehran())}) — ${tasks.length} مورد`),
        tasks.length ? buildTasksTable(tasks, { statuses: lists.statuses, omit: ['date'], onChanged: load, onEdit: (r) => openTaskDialog({ task: r, onSaved: load }) })
          : el('p', { class: 'muted' }, 'برای امروز کاری ثبت نشده است.')));
  }
  await load();
}
