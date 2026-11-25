import { el, openDialog, toast } from '../ui.js';
import { api } from '../api.js';
import { field, selectEl, wireForm } from '../fields.js';

const clean = (s) => { const v = String(s ?? '').replace(/\s+/g, ' ').trim(); return v || null; };

export function openAccountForm({ account = null, onSaved }) {
  const edit = !!account;
  const a = account || {};
  const inp = (v, cls) => el('input', { type: 'text', autocomplete: 'off', value: v || '', class: cls });
  const name = inp(a.name), city = inp(a.city), district = inp(a.district), address = inp(a.address);
  const landline = inp(a.landline, 'ltr'), software = inp(a.software), gln = inp(a.gln, 'ltr');
  const statusSel = selectEl([{ value: 'active', label: 'فعال' }, { value: 'archived', label: 'بایگانی' }], a.status || 'active');

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, edit ? 'ذخیره' : 'ایجاد اکانت');
  const form = el('form', { class: 'dform', novalidate: true },
    field('نام اکانت *', name).root,
    el('div', { class: 'grid2' }, field('شهر', city).root, field('منطقه', district).root),
    field('آدرس', address).root,
    el('div', { class: 'grid2' }, field('تلفن ثابت', landline).root, field('GLN', gln).root),
    field('نرم‌افزار داروخانه', software).root,
    edit ? field('وضعیت', statusSel).root : null,
    err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(edit ? 'ویرایش اکانت' : 'اکانت جدید', form);
  name.focus();

  wireForm(form, btn, err, async () => {
    const nm = clean(name.value);
    if (!nm) { err.textContent = 'نام اکانت را وارد کنید.'; name.focus(); return; }
    const row = { name: nm, city: clean(city.value), district: clean(district.value), address: clean(address.value), landline: clean(landline.value), software: clean(software.value), gln: clean(gln.value) };
    if (edit) row.status = statusSel.value;
    let saved;
    try {
      saved = edit ? await api.updateAccount(a.id, row) : await api.createAccount(row);
    } catch (e) {
      if (e.code === '23505') e.userMessage = 'اکانت فعالی با این نام وجود دارد.';
      throw e;
    }
    close();
    toast(edit ? 'اکانت ذخیره شد.' : 'اکانت ساخته شد (فرصت New به‌صورت خودکار ایجاد شد).', 'ok');
    if (onSaved) onSaved(saved);
  });
}
