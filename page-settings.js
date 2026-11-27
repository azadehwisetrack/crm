import { el, clear, toast, friendlyError } from './ui.js';
import { api } from './api.js';
import { resetLists } from './lists.js';
import { buildBackup, downloadBlob, markBackupDone, lastBackup } from './export.js';
import { formatDateTime } from './jalali.js';

// One editable list per settings tab. `sorted` lists keep a hidden order number.
const TABS = [
  { key: 'users', title: 'کاربران', table: 'task_users', hint: 'کسانی که کارها به آن‌ها محول می‌شود (فقط نام لازم است).' },
  { key: 'statuses', title: 'وضعیت کارها', table: 'task_statuses', sorted: true, hint: 'وضعیت‌های پیش‌فرض: برای انجام، انجام شده، کنسل شده. می‌توانید ویرایش، اضافه یا حذف کنید.' },
  { key: 'types', title: 'نوع کار', table: 'task_types', sorted: true, hint: 'نوع‌های پیش‌فرض: تماس، جلسه، یادداشت. می‌توانید ویرایش، اضافه یا حذف کنید.' },
  { key: 'products', title: 'محصولات', table: 'products', hint: 'محصولات در صفحهٔ هر اکانت با «وضعیت فروش» نمایش داده می‌شوند.' },
  { key: 'fields', title: 'حوزه فعالیت اکانت‌ها', table: 'activity_fields', hint: 'گزینه‌های «حوزه فعالیت» در فرم اکانت.' },
  { key: 'backup', title: 'پشتیبان‌گیری' },
];
const IN_USE = 'این مورد در جای دیگری (اکانت، کار یا محصول) استفاده شده و حذف نمی‌شود. اگر دیگر نمی‌خواهیدش، نامش را ویرایش کنید.';

async function save(btn, errBox, okMsg, fn) {
  errBox.textContent = ''; btn.disabled = true;
  try { await fn(); toast(okMsg, 'ok'); } catch (e) { console.error(e); errBox.textContent = e.userMessage || friendlyError(e); } finally { btn.disabled = false; }
}
const fail = (msg) => Object.assign(new Error('x'), { userMessage: msg });

async function listEditor(host, cfg) {
  const err = el('div', { class: 'form-error error', role: 'alert' });
  const body = el('tbody');
  const newName = el('input', { type: 'text', placeholder: 'مورد جدید', 'aria-label': 'نام مورد جدید' });
  const add = el('button', { type: 'button', class: 'primary' }, '+ افزودن');
  host.append(el('div', { class: 'card' }, el('p', { class: 'muted' }, cfg.hint || ''),
    el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'نام'), el('th', {}, ''), el('th', {}, ''))), body)),
    err, el('div', { class: 'row top-gap' }, newName, add)));

  let rows = [];
  async function draw() {
    rows = await api.listRows(cfg.table);
    clear(body);
    if (!rows.length) body.append(el('tr', {}, el('td', { class: 'muted' }, 'موردی تعریف نشده است.'), el('td'), el('td')));
    for (const r of rows) {
      const name = el('input', { type: 'text', value: r.name, 'aria-label': 'نام' });
      const sv = el('button', { type: 'button', class: 'small-btn' }, 'ذخیره');
      const del = el('button', { type: 'button', class: 'small-btn danger' }, 'حذف');
      sv.addEventListener('click', () => save(sv, err, 'ذخیره شد.', async () => {
        if (!name.value.trim()) throw fail('نام نباید خالی باشد.');
        try { await api.updateRow(cfg.table, r.id, { name: name.value.trim() }); }
        catch (e) { if (e.code === '23505') e.userMessage = 'این نام قبلاً ثبت شده است.'; throw e; }
        resetLists();
      }));
      del.addEventListener('click', () => save(del, err, 'حذف شد.', async () => {
        if (!window.confirm(`«${r.name}» حذف شود؟`)) throw fail('');
        try { await api.deleteRow(cfg.table, r.id); }
        catch (e) { if (e.code === '23503') e.userMessage = IN_USE; throw e; }
        resetLists(); await draw();
      }));
      body.append(el('tr', {}, el('td', {}, name), el('td', {}, sv), el('td', {}, del)));
    }
  }
  add.addEventListener('click', () => save(add, err, 'اضافه شد.', async () => {
    if (!newName.value.trim()) throw fail('نام را وارد کنید.');
    const row = { name: newName.value.trim() };
    if (cfg.sorted) row.sort = rows.reduce((m, r) => Math.max(m, r.sort || 0), 0) + 1;
    try { await api.addRow(cfg.table, row); } catch (e) { if (e.code === '23505') e.userMessage = 'این نام قبلاً ثبت شده است.'; throw e; }
    newName.value = ''; resetLists(); await draw();
  }));
  await draw();
}

function backupCard(host) {
  const status = el('p', { class: 'muted' }), err = el('div', { class: 'form-error error', role: 'alert' });
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
      toast(`بکاپ دانلود شد (${Object.values(counts).reduce((a, b) => a + b, 0)} ردیف).`, 'ok');
    } catch (e) { console.error(e); err.textContent = e.userMessage || friendlyError(e); } finally { btn.disabled = false; btn.textContent = 'خروجی بکاپ'; }
  });
  host.append(el('div', { class: 'card' }, el('p', {}, 'یک فایل ZIP شامل یک CSV برای هر جدول (UTF-8، مناسب Excel). برنامه بکاپ خودکار ندارد؛ هفته‌ای یک بار بگیرید و جای امنی نگه دارید.'), status, err, el('div', { class: 'actions' }, btn)));
}

export async function renderSettings(view, { params }) {
  const tab = TABS.find((x) => x.key === params.tab) || TABS[0];
  view.append(el('div', { class: 'card' }, el('h1', {}, 'تنظیمات'),
    el('div', { class: 'chips', role: 'navigation', 'aria-label': 'زیرمنوی تنظیمات' },
      TABS.map((x) => el('a', { class: 'chip', href: '#/settings/' + x.key, 'aria-pressed': String(x.key === tab.key) }, x.title)))));
  const host = el('div');
  view.append(host);
  if (tab.key === 'backup') backupCard(host);
  else {
    try { await listEditor(host, tab); } catch (e) { console.error(e); host.append(el('div', { class: 'card error' }, 'بارگذاری ناموفق بود: ' + friendlyError(e))); }
  }
}
