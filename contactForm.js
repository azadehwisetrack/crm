import { el, openDialog, toast } from '../ui.js';
import { api } from '../api.js';
import { options } from '../lookups.js';
import { normMobile, isMobile } from '../normalize.js';
import { field, selectEl, wireForm } from '../fields.js';

const MOBILE_ERR = 'شمارهٔ موبایل معتبر نیست (مثال: 09123456789).';

// Add a contact to an account (reuses an existing contact when the mobile already exists) or edit a linked contact.
export function openContactForm({ account, link = null, linkedIds = [], onSaved }) {
  const edit = !!link;
  const c = link?.contacts || {};
  const mobile = el('input', { type: 'text', class: 'ltr', inputmode: 'tel', autocomplete: 'off', value: c.mobile || '' });
  const mobile2 = el('input', { type: 'text', class: 'ltr', inputmode: 'tel', autocomplete: 'off', value: c.mobile2 || '' });
  const name = el('input', { type: 'text', autocomplete: 'off', value: c.name || '' });
  const note = el('textarea', { rows: 2 }); note.value = c.note || '';
  const roleSel = selectEl([{ value: '', label: '— بدون نقش —' }, ...options('contact_role').map((o) => ({ value: o.key, label: o.label }))], link?.role || '');
  const primary = el('input', { type: 'checkbox', checked: !!link?.is_primary });

  const mobileF = field('موبایل *', mobile);
  let existing = null;
  async function lookup() {
    existing = null;
    mobileF.hint.className = 'hint small muted'; mobileF.hint.textContent = '';
    const m = normMobile(mobile.value);
    if (!isMobile(m)) return;
    if (edit && m === c.mobile) return;
    let found;
    try { found = await api.findContactByMobile(m); } catch { return; }
    if (!found) return;
    if (linkedIds.includes(found.id)) { mobileF.hint.className = 'hint small error'; mobileF.hint.textContent = `«${found.name || found.mobile}» قبلاً به این اکانت پیوند شده است.`; return; }
    existing = found;
    mobileF.hint.className = 'hint small warn';
    mobileF.hint.textContent = `این شماره قبلاً برای «${found.name || found.code}» ثبت شده است؛ با ذخیره، همان کانتکت به این اکانت پیوند می‌شود.`;
  }
  mobile.addEventListener('blur', lookup);

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, edit ? 'ذخیره' : 'افزودن');
  const unlinkBtn = edit ? el('button', { type: 'button', class: 'danger' }, 'حذف پیوند از این اکانت') : null;
  const form = el('form', { class: 'dform', novalidate: true },
    mobileF.root, field('نام', name).root, field('موبایل دوم', mobile2).root,
    el('div', { class: 'grid2' }, field('نقش در این اکانت', roleSel).root,
      el('div', { class: 'field' }, el('label', { class: 'check' }, primary, ' کانتکت اصلی این اکانت'))),
    field('یادداشت', note).root,
    err, el('div', { class: 'actions' }, btn, unlinkBtn));
  const { close } = openDialog(edit ? 'ویرایش کانتکت' : 'کانتکت جدید', form);
  mobile.focus();

  if (unlinkBtn) unlinkBtn.addEventListener('click', async () => {
    if (!window.confirm('پیوند این کانتکت با اکانت حذف شود؟ (خود کانتکت و سابقه می‌ماند.)')) return;
    unlinkBtn.disabled = true;
    try { await api.unlinkContact(account.id, c.id); close(); toast('پیوند حذف شد.', 'ok'); if (onSaved) onSaved(); }
    catch (e) { err.textContent = e.userMessage || 'حذف پیوند ناموفق بود.'; unlinkBtn.disabled = false; }
  });

  wireForm(form, btn, err, async () => {
    const m = normMobile(mobile.value);
    if (!isMobile(m)) { err.textContent = MOBILE_ERR; mobile.focus(); return; }
    const m2raw = mobile2.value.trim();
    const m2 = m2raw ? normMobile(m2raw) : null;
    if (m2 && !isMobile(m2)) { err.textContent = 'موبایل دوم معتبر نیست.'; mobile2.focus(); return; }
    const fields = { name: name.value.trim() || null, mobile2: m2, note: note.value.trim() || null };
    try {
      if (edit) {
        const patch = { ...fields };
        if (m !== c.mobile) patch.mobile = m;
        await api.updateContact(c.id, patch);
        await api.linkContact(account.id, c.id, roleSel.value, primary.checked);
      } else {
        await lookup();
        let contact = existing;
        if (!contact) {
          const again = await api.findContactByMobile(m);
          if (again && linkedIds.includes(again.id)) { err.textContent = 'این کانتکت قبلاً به این اکانت پیوند شده است.'; return; }
          contact = again || await api.createContact({ ...fields, mobile: m });
        } else if (contact.status === 'archived') {
          await api.updateContact(contact.id, { status: 'active' });
        }
        await api.linkContact(account.id, contact.id, roleSel.value, primary.checked);
      }
    } catch (e) {
      if (e.code === '23505') e.userMessage = 'این شماره برای کانتکت دیگری ثبت شده است.';
      throw e;
    }
    close();
    toast(edit ? 'کانتکت ذخیره شد.' : 'کانتکت اضافه شد.', 'ok');
    if (onSaved) onSaved();
  });
}
