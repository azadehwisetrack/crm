import { el, openDialog, toast, friendlyError } from '../ui.js';
import { api } from '../api.js';
import { field, selectEl, wireForm } from '../fields.js';

// New opportunity for another product on an existing account (one open opportunity per product).
export async function openOppForm({ account, opps, onSaved }) {
  let products;
  try { products = await api.products(); } catch (e) { toast(friendlyError(e), 'error'); return; }
  const busy = new Set(opps.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost').map((o) => o.product_id));
  const avail = products.filter((p) => !busy.has(p.id));

  const err = el('div', { class: 'form-error error', role: 'alert' });
  if (!avail.length) {
    openDialog('فرصت جدید', el('div', { class: 'dform' }, el('p', {}, 'برای همهٔ محصولات فعال، فرصت باز وجود دارد. محصول جدید را در تنظیمات اضافه کنید.')));
    return;
  }
  const sel = selectEl(avail.map((p) => ({ value: p.id, label: p.name })), avail[0].id);
  const btn = el('button', { type: 'submit', class: 'primary' }, 'ایجاد فرصت');
  const form = el('form', { class: 'dform', novalidate: true }, field('محصول', sel).root, err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(`فرصت جدید — ${account.name}`, form);
  sel.focus();
  wireForm(form, btn, err, async () => {
    try { await api.createOpportunity(account.id, Number(sel.value)); }
    catch (e) { if (e.code === '23505') e.userMessage = 'برای این محصول فرصت باز وجود دارد.'; throw e; }
    close();
    toast('فرصت جدید ساخته شد (مرحله New).', 'ok');
    if (onSaved) onSaved();
  });
}
