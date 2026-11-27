import { el, openDialog, toast } from './ui.js';
import { api } from './api.js';
import { getAccounts } from './lists.js';
import { normMobile, isMobile } from './normalize.js';
import { field, wireForm } from './fields.js';
import { accountPicker } from './account-picker.js';

const clean = (s) => { const v = String(s ?? '').replace(/\s+/g, ' ').trim(); return v || null; };

// Create / edit a person. Only the last name is required; the mobile (if given) must be a valid mobile number.
// Pass `account` (fixed) when opened from an account page; otherwise an account can be chosen (optional).
export async function openPersonDialog({ person = null, account = null, onSaved }) {
  const edit = !!person;
  const p = person || {};
  const currentLink = (p.account_contacts || []).find((l) => l.status === 'active');
  const currentAccountId = currentLink?.accounts?.id ?? null;
  const picker = account ? null : accountPicker(await getAccounts(), currentAccountId, 'اکانت');

  const inp = (v, cls) => el('input', { type: 'text', autocomplete: 'off', value: v || '', class: cls });
  const first = inp(p.first_name), last = inp(p.last_name), mobile = inp(p.mobile, 'ltr'), job = inp(p.job_title);
  mobile.setAttribute('inputmode', 'tel');

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, edit ? 'ذخیره' : 'ایجاد شخص');
  const form = el('form', { class: 'dform', novalidate: true },
    el('div', { class: 'grid2' }, field('نام', first).root, field('نام خانوادگی *', last).root),
    el('div', { class: 'grid2' }, field('شماره موبایل', mobile).root, field('عنوان شغلی', job).root),
    picker ? picker.root : el('p', { class: 'muted' }, `اکانت: ${account.name}`),
    err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(edit ? 'ویرایش شخص' : 'شخص جدید', form);
  (edit ? last : first).focus();

  wireForm(form, btn, err, async () => {
    const lastName = clean(last.value);
    if (!lastName) { err.textContent = 'نام خانوادگی را وارد کنید.'; last.focus(); return; }
    const mob = normMobile(mobile.value);
    if (mobile.value.trim() && !isMobile(mob)) { err.textContent = 'شمارهٔ موبایل معتبر نیست (مثال: 09123456789).'; mobile.focus(); return; }
    let accountId = account ? account.id : null;
    if (picker) {
      accountId = picker.getId();
      if (picker.input.value.trim() && !accountId) { err.textContent = 'اکانت را از فهرست انتخاب کنید یا خالی بگذارید.'; picker.input.focus(); return; }
    }
    const row = { first_name: clean(first.value), last_name: lastName, mobile: mob || null, job_title: clean(job.value) };
    try {
      let id = p.id;
      if (edit) await api.updatePerson(id, row); else id = (await api.createPerson(row)).id;
      if (!edit || accountId !== currentAccountId) await api.setPersonAccount(id, accountId);
    } catch (e) {
      if (e.code === '23505') e.userMessage = 'این شماره موبایل قبلاً برای شخص دیگری ثبت شده است.';
      throw e;
    }
    close();
    toast(edit ? 'شخص ذخیره شد.' : 'شخص اضافه شد.', 'ok');
    if (onSaved) onSaved();
  });
}
