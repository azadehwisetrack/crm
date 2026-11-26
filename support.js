import { el, clear, toast, toastError, openDialog } from './ui.js';
import { api } from './api.js';
import { loadLookups, label, options } from './lookups.js';
import { field, selectEl, dateField, wireForm } from './fields.js';
import { formatDate } from './jalali.js';

const LATE_AFTER_DAYS = 2; // days since Won shown in red after this many days

export async function renderSupport(view) {
  const holder = el('div');
  view.append(el('div', { class: 'card' }, el('h1', {}, 'پشتیبانی'),
    el('p', { class: 'muted' }, 'قراردادهای بسته‌شده که هنوز «راهنمایی انجام شد» برایشان ثبت نشده؛ قدیمی‌ترین اول.')), holder);
  let seq = 0;

  function openResultForm(item) {
    const resultSel = selectEl(options('support_result').map((o) => ({ value: o.key, label: o.label })), 'guided');
    const note = el('textarea', { rows: 3 });
    const follow = dateField('تاریخ پیگیری (اختیاری)');
    const err = el('div', { class: 'form-error error', role: 'alert' });
    const btn = el('button', { type: 'submit', class: 'primary' }, 'ثبت نتیجه');
    const form = el('form', { class: 'dform', novalidate: true },
      el('div', { class: 'handoff' }, el('strong', {}, 'یادداشت تحویل: '), item.handoff_note || '—'),
      field('نتیجه', resultSel).root, field('یادداشت', note).root, follow.root, err, el('div', { class: 'actions' }, btn));
    const { close } = openDialog(`نتیجهٔ پشتیبانی — ${item.account_name}`, form);
    resultSel.focus();
    wireForm(form, btn, err, async () => {
      const f = follow.value();
      if (!f.ok) { follow.input.focus(); return; }
      try {
        await api.addSupportResult({ opportunity_id: item.opportunity_id, result: resultSel.value, note: note.value.trim() || null, follow_up_date: f.iso });
      } catch (e) {
        if (e.code === '23514') e.userMessage = 'نتیجهٔ پشتیبانی فقط برای فرصت‌های Won ثبت می‌شود.';
        throw e;
      }
      close();
      toast(resultSel.value === 'guided' ? 'ثبت شد و از صف خارج شد.' : 'نتیجه ثبت شد.', 'ok');
      load();
    });
  }

  async function load() {
    const my = ++seq;
    clear(holder);
    holder.append(el('div', { class: 'card muted' }, 'در حال بارگذاری…'));
    let rows;
    try { [rows] = await Promise.all([api.supportQueue(), loadLookups()]); } catch (e) { if (my !== seq) return; clear(holder); toastError(e); holder.append(el('div', { class: 'card error' }, 'بارگذاری صف ناموفق بود.')); return; }
    if (my !== seq) return;
    clear(holder);
    if (!rows.length) { holder.append(el('div', { class: 'card' }, 'موردی در صف پشتیبانی نیست.')); return; }
    holder.append(el('p', { class: 'muted' }, `${rows.length} مورد در صف`));
    for (const r of rows) {
      const late = r.days_since_won > LATE_AFTER_DAYS;
      const b = el('button', { type: 'button', class: 'primary' }, 'ثبت نتیجه');
      b.addEventListener('click', () => openResultForm(r));
      holder.append(el('div', { class: 'card support-item' },
        el('div', { class: 'row' },
          el('h2', {}, r.account_name),
          el('span', { class: 'badge ' + (late ? 'late' : '') }, `${r.days_since_won ?? 0} روز از Won`)),
        el('dl', { class: 'info' },
          el('dt', {}, 'آدرس'), el('dd', {}, r.address || '—'),
          el('dt', {}, 'کانتکت'), el('dd', {}, r.contact_name || '—', ' ', r.contact_mobile ? el('a', { href: 'tel:' + r.contact_mobile, class: 'ltr' }, r.contact_mobile) : null),
          el('dt', {}, 'تحویل'), el('dd', { class: 'note' }, r.handoff_note || '—'),
          el('dt', {}, 'آخرین نتیجه'), el('dd', {}, r.last_result ? `${label('support_result', r.last_result)}${r.last_follow_up ? ' — پیگیری: ' + formatDate(r.last_follow_up) : ''}` : 'هنوز ثبت نشده')),
        el('div', { class: 'actions' }, b)));
    }
  }
  await load();
}
