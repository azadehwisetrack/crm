import { el, clear, toast, friendlyError } from './ui.js';
import { api } from './api.js';
import { resetLookups } from './lookups.js';
import { field, selectEl } from './fields.js';
import { buildBackup, downloadBlob, markBackupDone, lastBackup } from './export.js';
import { formatDateTime } from './jalali.js';

const KINDS = [['activity_result', 'نتیجهٔ اقدام'], ['pending_reason', 'دلیل Pending'], ['lost_reason', 'دلیل Lost'], ['contact_role', 'نقش کانتکت'], ['support_result', 'نتیجهٔ پشتیبانی']];
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));
const td = (c, cls) => el('td', { class: cls }, c);
const intIn = (value) => el('input', { type: 'text', inputmode: 'numeric', class: 'ltr', value: String(value ?? '') });

// Runs an async save, shows the error inline (dialogs/cards) and a toast on success.
async function save(btn, errBox, okMsg, fn) {
  errBox.textContent = ''; btn.disabled = true;
  try { await fn(); toast(okMsg, 'ok'); } catch (e) { console.error(e); errBox.textContent = e.userMessage || friendlyError(e); } finally { btn.disabled = false; }
}
const errBox = () => el('div', { class: 'form-error error', role: 'alert' });

async function generalCard(host) {
  const [settings, products] = await Promise.all([api.settings({ quiet: true }), api.productsAll()]);
  const get = (k, d) => settings.find((s) => s.key === k)?.value ?? d;
  const inactivity = intIn(get('inactivity_days', 14)), minNo = intIn(get('min_noanswer', 3));
  const skip = selectEl([{ value: 'true', label: 'بله' }, { value: 'false', label: 'خیر' }], get('skip_friday_tomorrow', 'true'));
  const prod = selectEl(products.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), get('default_product_id', ''));
  const err = errBox(), btn = el('button', { type: 'button', class: 'primary' }, 'ذخیره');
  btn.addEventListener('click', () => save(btn, err, 'تنظیمات ذخیره شد.', async () => {
    const a = Number(inactivity.value), b = Number(minNo.value);
    if (!Number.isInteger(a) || a < 1 || a > 365) throw Object.assign(new Error('x'), { userMessage: 'روز بی‌حرکتی باید عددی بین ۱ تا ۳۶۵ باشد.' });
    if (!Number.isInteger(b) || b < 1 || b > 50) throw Object.assign(new Error('x'), { userMessage: 'حداقل تلاش بی‌پاسخ باید عددی بین ۱ تا ۵۰ باشد.' });
    await Promise.all([api.saveSetting('inactivity_days', a), api.saveSetting('min_noanswer', b), api.saveSetting('skip_friday_tomorrow', skip.value), api.saveSetting('default_product_id', prod.value)]);
  }));
  host.append(el('div', { class: 'card' }, el('h2', {}, 'تنظیمات عمومی'),
    el('div', { class: 'grid2' }, field('روزهای بی‌حرکتی (صف In progress بی‌حرکت)', inactivity).root, field('حداقل تلاش بی‌پاسخ (صف New با تلاش بی‌پاسخ)', minNo).root),
    el('div', { class: 'grid2' }, field('«فردا» در برنامه روز جمعه را رد کند', skip).root, field('محصول پیش‌فرض اکانت جدید', prod).root),
    err, el('div', { class: 'actions' }, btn)));
}

async function productsCard(host) {
  const err = errBox();
  const body = el('tbody');
  const card = el('div', { class: 'card' }, el('h2', {}, 'محصولات'), el('div', { class: 'table-wrap' }, el('table', {}, th('نام', 'فعال', ''), body)), err);
  host.append(card);
  async function draw() {
    const products = await api.productsAll();
    clear(body);
    for (const p of products) {
      const name = el('input', { type: 'text', value: p.name });
      const active = el('input', { type: 'checkbox', checked: p.active });
      const b = el('button', { type: 'button', class: 'small-btn' }, 'ذخیره');
      b.addEventListener('click', () => save(b, err, 'محصول ذخیره شد.', async () => {
        if (!name.value.trim()) throw Object.assign(new Error('x'), { userMessage: 'نام محصول نباید خالی باشد.' });
        if (!active.checked) {
          const def = (await api.settings({ quiet: true })).find((s) => s.key === 'default_product_id')?.value;
          if (String(def) === String(p.id)) throw Object.assign(new Error('x'), { userMessage: 'محصول پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا محصول پیش‌فرض را عوض کنید.' });
        }
        try { await api.updateProduct(p.id, { name: name.value.trim(), active: active.checked }); }
        catch (e) { if (e.code === '23505') e.userMessage = 'محصولی با این نام وجود دارد.'; throw e; }
      }));
      body.append(el('tr', {}, td(name), td(active), td(b)));
    }
  }
  const newName = el('input', { type: 'text', placeholder: 'نام محصول جدید' });
  const add = el('button', { type: 'button' }, '+ افزودن');
  add.addEventListener('click', () => save(add, err, 'محصول اضافه شد.', async () => {
    if (!newName.value.trim()) throw Object.assign(new Error('x'), { userMessage: 'نام محصول را وارد کنید.' });
    try { await api.createProduct(newName.value.trim()); } catch (e) { if (e.code === '23505') e.userMessage = 'محصولی با این نام وجود دارد.'; throw e; }
    newName.value = ''; await draw();
  }));
  card.append(el('div', { class: 'row top-gap' }, newName, add));
  await draw();
}

async function lookupsCard(host) {
  let all = await api.lookups({ quiet: true });
  let kind = KINDS[0][0];
  const err = errBox(), chips = el('div', { class: 'chips' }), holder = el('div');
  host.append(el('div', { class: 'card' }, el('h2', {}, 'فهرست‌های انتخابی (برچسب، ترتیب، فعال)'),
    el('p', { class: 'muted' }, 'حذف وجود ندارد؛ موردِ بلااستفاده را «غیرفعال» کنید تا سوابق قدیمی همچنان برچسب درست داشته باشند.'), chips, holder, err));
  function draw() {
    clear(chips); clear(holder);
    for (const [k, title] of KINDS) {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === kind) }, title);
      b.addEventListener('click', () => { kind = k; draw(); });
      chips.append(b);
    }
    const rows = all.filter((r) => r.kind === kind).sort((a, b) => a.sort - b.sort);
    const body = el('tbody');
    for (const r of rows) {
      const label = el('input', { type: 'text', value: r.label });
      const sort = intIn(r.sort), active = el('input', { type: 'checkbox', checked: r.active });
      const b = el('button', { type: 'button', class: 'small-btn' }, 'ذخیره');
      b.addEventListener('click', () => save(b, err, 'ذخیره شد.', async () => {
        const s = Number(sort.value);
        if (!label.value.trim()) throw Object.assign(new Error('x'), { userMessage: 'برچسب نباید خالی باشد.' });
        if (!Number.isInteger(s)) throw Object.assign(new Error('x'), { userMessage: 'ترتیب باید عدد صحیح باشد.' });
        const saved = await api.updateLookup(r.kind, r.key, { label: label.value.trim(), sort: s, active: active.checked });
        Object.assign(r, saved); resetLookups();
      }));
      body.append(el('tr', {}, td(r.key, 'ltr muted'), td(label), td(sort), td(active), td(b)));
    }
    holder.append(el('div', { class: 'table-wrap' }, el('table', {}, th('کلید', 'برچسب', 'ترتیب', 'فعال', ''), body)));
    const newLabel = el('input', { type: 'text', placeholder: 'برچسب مورد جدید' });
    const add = el('button', { type: 'button' }, '+ افزودن');
    add.addEventListener('click', () => save(add, err, 'اضافه شد.', async () => {
      if (!newLabel.value.trim()) throw Object.assign(new Error('x'), { userMessage: 'برچسب را وارد کنید.' });
      const next = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
      const row = await api.createLookup({ kind, key: 'x' + Date.now().toString(36), label: newLabel.value.trim(), sort: next, active: true });
      all = [...all, row]; resetLookups(); draw();
    }));
    holder.append(el('div', { class: 'row top-gap' }, newLabel, add));
  }
  draw();
}

async function usersCard(host) {
  const err = errBox(), body = el('tbody');
  host.append(el('div', { class: 'card' }, el('h2', {}, 'کاربران (نام نمایشی)'),
    el('p', { class: 'muted' }, 'ساخت کاربر یا تغییر رمز از داشبورد Supabase انجام می‌شود (docs/setup.md).'),
    el('div', { class: 'table-wrap' }, el('table', {}, th('ایمیل', 'نقش', 'نام نمایشی', ''), body)), err));
  for (const u of await api.listProfiles()) {
    const name = el('input', { type: 'text', value: u.display_name });
    const b = el('button', { type: 'button', class: 'small-btn' }, 'ذخیره');
    b.addEventListener('click', () => save(b, err, 'نام ذخیره شد (برای کاربر بعد از ورود مجدد دیده می‌شود).', () => api.setDisplayName(u.user_id, name.value)));
    body.append(el('tr', {}, td(u.email || '—', 'ltr'), td(u.role === 'sales' ? 'فروش' : 'پشتیبانی'), td(name), td(b)));
  }
}

function backupCard(host) {
  const status = el('p', { class: 'muted' }), err = errBox();
  const btn = el('button', { type: 'button', class: 'primary' }, 'خروجی بکاپ');
  function showLast() {
    const last = lastBackup();
    if (!last) { status.textContent = 'در این مرورگر هنوز بکاپی گرفته نشده است.'; status.className = 'error'; return; }
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 864e5);
    status.textContent = `آخرین بکاپ در این مرورگر: ${formatDateTime(last)} (${days} روز پیش)`;
    status.className = days > 7 ? 'error' : 'muted';
  }
  showLast();
  btn.addEventListener('click', async () => {
    err.textContent = ''; btn.disabled = true;
    try {
      const { blob, filename, counts } = await buildBackup((m) => { btn.textContent = m; });
      downloadBlob(blob, filename); markBackupDone(); showLast();
      toast(`بکاپ دانلود شد (${Object.values(counts).reduce((a, b) => a + b, 0)} ردیف در ${Object.keys(counts).length} جدول).`, 'ok');
    } catch (e) { console.error(e); err.textContent = e.userMessage || friendlyError(e); } finally { btn.disabled = false; btn.textContent = 'خروجی بکاپ'; }
  });
  host.append(el('div', { class: 'card' }, el('h2', {}, 'بکاپ'),
    el('p', {}, 'یک فایل ZIP شامل یک CSV برای هر جدول (UTF-8 با BOM، مناسب Excel). پلن رایگان بکاپ خودکار ندارد؛ هفته‌ای یک بار بگیرید و جای امنی نگه دارید.'),
    status, err, el('div', { class: 'actions' }, btn)));
}

export async function renderSettings(view) {
  view.append(el('div', { class: 'card' }, el('h1', {}, 'تنظیمات')));
  const host = el('div');
  view.append(host);
  for (const section of [generalCard, productsCard, lookupsCard, usersCard]) {
    try { await section(host); } catch (e) { console.error(e); host.append(el('div', { class: 'card error' }, 'بارگذاری یک بخش از تنظیمات ناموفق بود: ' + friendlyError(e))); }
  }
  backupCard(host);
}
