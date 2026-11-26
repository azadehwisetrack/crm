import { el, openDialog, toast } from './ui.js';
import { api } from './api.js';
import { options } from './lookups.js';
import { ACTIVITY_TYPES } from './i18n.js';
import { field, selectEl, dateField, timeField, wireForm } from './fields.js';
import { todayTehran, tehranToIso } from './jalali.js';
import { parseTag } from './tags.js';

const isOpen = (o) => o.stage !== 'Won' && o.stage !== 'Lost';

// Quick log (key N on the account page). Reusable from queue rows: pass the account's opps + contacts.
export function openQuickLog({ account, opps, contacts, defaults = {}, onSaved }) {
  const sorted = [...opps].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));
  const openOnes = sorted.filter(isOpen);
  const oppSel = selectEl([{ value: '', label: '— بدون فرصت —' }, ...sorted.map((o) => ({ value: o.opportunity_id, label: `${o.product_name} — ${o.stage}` }))],
    defaults.opportunity_id ?? (openOnes.length === 1 ? openOnes[0].opportunity_id : ''));
  const links = contacts.filter((c) => c.contacts);
  const primary = links.find((c) => c.is_primary) || links[0];
  const contactSel = selectEl([{ value: '', label: '— بدون کانتکت —' }, ...links.map((c) => ({ value: c.contacts.id, label: [c.contacts.name, c.contacts.mobile].filter(Boolean).join(' · ') }))],
    defaults.contact_id ?? primary?.contacts.id ?? '');
  const date = dateField('تاریخ', { iso: todayTehran(), required: true });
  const time = timeField('ساعت', '10:00');
  const typeSel = selectEl(ACTIVITY_TYPES.map(([value, label]) => ({ value, label })), defaults.type || 'call');
  const resultSel = selectEl([{ value: '', label: '—' }, ...options('activity_result').map((o) => ({ value: o.key, label: o.label }))], '');
  const note = el('textarea', { rows: 3 });
  const nextDate = dateField('تاریخ قدم بعدی');
  const nextText = el('input', { type: 'text', autocomplete: 'off' });
  const tagHint = el('div', { class: 'hint small muted' });

  const noteF = field('یادداشت', note);
  noteF.hint.replaceWith(tagHint);

  function updateTagHint() {
    const tg = parseTag(note.value);
    if (!tg) { tagHint.className = 'hint small muted'; tagHint.textContent = 'برای بستن فرصت در یادداشت بنویسید: #won یا #lost و بعد دلیل.'; return; }
    const target = oppSel.value ? sorted.find((o) => o.opportunity_id === oppSel.value) : (openOnes.length === 1 ? openOnes[0] : null);
    tagHint.className = 'hint small ' + (target ? 'warn' : 'error');
    if (!target) { tagHint.textContent = 'فرصتی مشخص نیست؛ تگ نادیده گرفته می‌شود. فرصت را انتخاب کنید.'; return; }
    if (tg.kind === 'won') tagHint.textContent = `با ذخیره، «${target.product_name}» به Won می‌رود${tg.reason ? ' و متن بعد از تگ، یادداشت تحویل می‌شود.' : '. (یادداشت تحویل خالی است؛ بهتر است بعد از #won توضیح بنویسید.)'}`;
    else tagHint.textContent = `با ذخیره، «${target.product_name}» به Lost می‌رود. دلیل: ${tg.reason || 'other'}`;
  }
  note.addEventListener('input', updateTagHint);
  oppSel.addEventListener('change', updateTagHint);
  updateTagHint();

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, 'ذخیره');
  const form = el('form', { class: 'dform', novalidate: true },
    field('فرصت', oppSel).root, field('کانتکت', contactSel).root,
    el('div', { class: 'grid2' }, date.root, time.root),
    el('div', { class: 'grid2' }, field('نوع', typeSel).root, field('نتیجه', resultSel).root),
    noteF.root,
    el('div', { class: 'grid2' }, nextDate.root, field('متن قدم بعدی', nextText).root),
    err, el('div', { class: 'actions' }, btn));
  note.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });

  const { close } = openDialog(`ثبت اقدام — ${account.name}`, form);
  resultSel.focus();

  wireForm(form, btn, err, async () => {
    const d = date.value(), tm = time.value(), nd = nextDate.value();
    if (!d.ok) { date.input.focus(); return; }
    if (!tm.ok) { time.input.focus(); return; }
    if (!nd.ok) { nextDate.input.focus(); return; }
    if (nextText.value.trim() && !nd.iso) { err.textContent = 'برای متن قدم بعدی، تاریخ هم لازم است.'; nextDate.input.focus(); return; }
    if (typeSel.value === 'note' && !note.value.trim()) { err.textContent = 'برای نوع «یادداشت»، متن یادداشت را بنویسید.'; note.focus(); return; }
    await api.createActivity({
      account_id: account.id, opportunity_id: oppSel.value || null, contact_id: contactSel.value || null,
      occurred_at: tehranToIso(d.iso, tm.text), type: typeSel.value, result: resultSel.value || null,
      note: note.value.trim() || null, next_step_date: nd.iso, next_step_text: nextText.value.trim() || null,
    });
    close();
    toast('اقدام ثبت شد.', 'ok');
    if (onSaved) onSaved({ activity: true });
  });
}
