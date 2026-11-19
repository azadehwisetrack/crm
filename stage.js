import { el, openDialog, toast } from '../ui.js';
import { api } from '../api.js';
import { options } from '../lookups.js';
import { STAGES } from '../i18n.js';
import { field, selectEl, wireForm } from '../fields.js';

export function openStageDialog({ opp, onSaved }) {
  const closed = opp.stage === 'Won' || opp.stage === 'Lost';
  const stageOpts = STAGES.map((s) => ({ value: s, label: s === opp.stage ? `${s} (فعلی)` : s, disabled: s === opp.stage || (closed && s !== 'In progress') }));
  const first = stageOpts.find((o) => !o.disabled);
  const stageSel = selectEl(stageOpts, first.value);
  const reasonSel = selectEl([], '');
  const handoff = el('textarea', { rows: 3, placeholder: 'برای پشتیبانی: چه چیزی نصب/آموزش داده شود، به چه کسی زنگ بزنند…' });
  const note = el('textarea', { rows: 2 });

  const reasonF = field('دلیل *', reasonSel);
  const handoffF = field('یادداشت تحویل به پشتیبانی *', handoff);
  const noteF = field('یادداشت (اختیاری)', note);
  const info = el('p', { class: 'muted' }, closed ? 'این فرصت بسته است؛ فقط با تغییر دستی به In progress بازگشایی می‌شود (در تاریخچه ثبت می‌شود).' : '');

  function sync() {
    const s = stageSel.value;
    const kind = s === 'Pending' ? 'pending_reason' : s === 'Lost' ? 'lost_reason' : null;
    reasonF.root.hidden = !kind;
    handoffF.root.hidden = s !== 'Won';
    reasonSel.replaceChildren(...(kind ? options(kind) : []).map((o) => el('option', { value: o.key }, o.label)));
  }
  stageSel.addEventListener('change', sync);
  sync();

  const err = el('div', { class: 'form-error error', role: 'alert' });
  const btn = el('button', { type: 'submit', class: 'primary' }, 'ذخیره');
  const form = el('form', { class: 'dform', novalidate: true }, info, field('مرحله جدید', stageSel).root, reasonF.root, handoffF.root, noteF.root, err, el('div', { class: 'actions' }, btn));
  const { close } = openDialog(`تغییر مرحله — ${opp.product_name}`, form);
  stageSel.focus();

  wireForm(form, btn, err, async () => {
    const s = stageSel.value;
    if ((s === 'Pending' || s === 'Lost') && !reasonSel.value) { err.textContent = 'دلیل را انتخاب کنید.'; return; }
    if (s === 'Won' && !handoff.value.trim()) { err.textContent = 'یادداشت تحویل برای پشتیبانی لازم است.'; handoff.focus(); return; }
    await api.changeStage(opp.opportunity_id, s, reasonSel.value, handoff.value.trim(), note.value.trim());
    close();
    toast(`مرحله به ${s} تغییر کرد.`, 'ok');
    if (onSaved) onSaved();
  });
}
