import { el, openDialog, toast } from './ui.js';
import { api } from './api.js';
import { loadLists, getAccounts } from './lists.js';
import { field, selectEl, dateField, timeField, wireForm } from './fields.js';
import { accountPicker } from './account-picker.js';
import { todayTehran, formatTime } from './jalali.js';

const personLabel = (p) => [[p.first_name, p.last_name].filter(Boolean).join(' '), p.mobile].filter(Boolean).join(' · ');

// Create / edit a task. Date and time default to "now" and can be edited.
// Choosing an account fills the person automatically when that account has exactly one person.
export async function openTaskDialog({ task = null, account = null, onSaved }) {
  const [lists, accounts] = await Promise.all([loadLists(), getAccounts()]);
  const edit = !!task;
  const accountId0 = task?.account_id ?? account?.id ?? null;
  const picker = accountPicker(accounts, accountId0);
  const personSel = selectEl([{ value: '', label: '— بدون شخص —' }], '');

  async function loadPersons(accId, keepId = null) {
    let persons = [];
    if (accId) { try { persons = await api.accountPersons(accId); } catch { persons = []; } }
    const pick = keepId ?? (persons.length === 1 ? persons[0].id : '');
    personSel.replaceChildren(el('option', { value: '', selected: pick === '' }, '— بدون شخص —'),
      ...persons.map((p) => el('option', { value: p.id, selected: p.id === pick }, personLabel(p))));
    personSel.value = pick;
  }
  picker.onPick((id) => loadPersons(id));
  if (accountId0) await loadPersons(accountId0, task?.person_id ?? null);

  const desc = el('textarea', { rows: 3 }); desc.value = task?.description || '';
  const date = dateField('تاریخ', { iso: task?.due_date ?? todayTehran(), required: true });
  const time = timeField('ساعت', task ? String(task.due_time).slice(0, 5) : formatTime(new Date()));
  const typeSel = selectEl([{ value: '', label: '—' }, ...lists.types.map((x) => ({ value: x.id, label: x.name }))], task ? (task.type_id ?? '') : (lists.types[0]?.id ?? ''));
  const userSel = selectEl([{ value: '', label: '—' }, ...lists.users.map((x) => ({ value: x.id, label: x.name }))], task?.user_id ?? '');
  const todo = lists.statuses.find((s) => s.kind === 'todo') || lists.statuses[0];
  const statusSel = selectEl([{ value: '', label: '—' }, ...lists.statuses.map((x) => ({ value: x.id, label: x.name }))], task ? (task.status_id ?? '') : (todo?.id ?? ''));

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, edit ? 'ذخیره' : 'ایجاد کار');
  const form = el('form', { class: 'dform', novalidate: true },
    picker.root, field('شخص', personSel).root, field('شرح', desc).root,
    el('div', { class: 'grid2' }, date.root, time.root),
    el('div', { class: 'grid2' }, field('نوع', typeSel).root, field('کاربر', userSel).root),
    field('وضعیت', statusSel).root,
    err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(edit ? 'ویرایش کار' : 'کار جدید', form);
  (accountId0 ? desc : picker.input).focus();

  wireForm(form, btn, err, async () => {
    const accId = picker.getId();
    if (!accId) { err.textContent = 'اکانت را از فهرست انتخاب کنید.'; picker.input.focus(); return; }
    const d = date.value(), tm = time.value();
    if (!d.ok) { date.input.focus(); return; }
    if (!tm.ok) { time.input.focus(); return; }
    const num = (v) => (v ? Number(v) : null);
    const row = { account_id: accId, person_id: personSel.value || null, description: desc.value.trim() || null, due_date: d.iso, due_time: tm.text,
      type_id: num(typeSel.value), user_id: num(userSel.value), status_id: num(statusSel.value) };
    if (edit) await api.updateTask(task.id, row); else await api.createTask(row);
    close();
    toast(edit ? 'کار ذخیره شد.' : 'کار ثبت شد.', 'ok');
    if (onSaved) onSaved();
  });
}
