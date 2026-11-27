import { el, openDialog, toast } from './ui.js';
import { api } from './api.js';
import { loadLists, resetAccounts } from './lists.js';
import { field, selectEl, wireForm } from './fields.js';

const clean = (s) => { const v = String(s ?? '').replace(/\s+/g, ' ').trim(); return v || null; };

// Create / edit an account. Only the title is required.
export async function openAccountDialog({ account = null, onSaved }) {
  const lists = await loadLists();
  const edit = !!account;
  const a = account || {};
  const inp = (v, cls) => el('input', { type: 'text', autocomplete: 'off', value: v || '', class: cls });
  const title = inp(a.name), phone = inp(a.landline, 'ltr'), city = inp(a.city), district = inp(a.district), address = inp(a.address);
  const fieldSel = selectEl([{ value: '', label: '— انتخاب نشده —' }, ...lists.fields.map((f) => ({ value: f.id, label: f.name }))], a.field_id ?? '');

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, edit ? 'ذخیره' : 'ایجاد اکانت');
  const form = el('form', { class: 'dform', novalidate: true },
    field('عنوان *', title).root,
    el('div', { class: 'grid2' }, field('تلفن', phone).root, field('حوزه فعالیت', fieldSel).root),
    el('div', { class: 'grid2' }, field('شهر', city).root, field('منطقه', district).root),
    field('آدرس', address).root,
    err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(edit ? 'ویرایش اکانت' : 'اکانت جدید', form);
  title.focus();

  wireForm(form, btn, err, async () => {
    const name = clean(title.value);
    if (!name) { err.textContent = 'عنوان اکانت را وارد کنید.'; title.focus(); return; }
    const row = { name, landline: clean(phone.value), city: clean(city.value), district: clean(district.value), address: clean(address.value), field_id: fieldSel.value ? Number(fieldSel.value) : null };
    let saved;
    try { saved = edit ? await api.updateAccount(a.id, row) : await api.createAccount(row); }
    catch (e) { if (e.code === '23505') e.userMessage = 'اکانت فعالی با این عنوان وجود دارد.'; throw e; }
    resetAccounts();
    close();
    toast(edit ? 'اکانت ذخیره شد.' : 'اکانت ساخته شد.', 'ok');
    if (onSaved) onSaved(saved);
  });
}
