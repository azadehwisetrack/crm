import { el, clear, toast, toastError, isDialogOpen, copyText } from './ui.js';
import { api } from './api.js';
import { loadLookups, label } from './lookups.js';
import { formatDate, formatDateTime, todayTehran } from './jalali.js';
import { buildSummary } from './summary.js';
import { openQuickLog } from './quicklog.js';
import { openStageDialog } from './stage.js';
import { openAccountForm } from './accountForm.js';
import { openContactForm } from './contactForm.js';
import { openOppForm } from './oppForm.js';

const td = (content, cls) => el('td', { class: cls }, content);
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));
const stageBadge = (s) => el('span', { class: 'badge stage-' + String(s).replace(' ', '-') }, s);
const btn = (text, fn, cls = '') => { const b = el('button', { type: 'button', class: cls }, text); b.addEventListener('click', fn); return b; };

export async function renderAccount(view, { params }) {
  const id = params.id;
  let d = null; // { account, contacts, opps, timeline }

  async function load({ flashLast = false } = {}) {
    if (!d) view.append(el('div', { class: 'card muted' }, 'در حال بارگذاری…'));
    try {
      const [account, contacts, opps, timeline] = await Promise.all([
        api.account(id, { quiet: true }), api.accountContacts(id, { quiet: true }),
        api.accountOpportunities(id, { quiet: true }), api.timeline(id, { quiet: true }), loadLookups(),
      ]);
      d = { account, contacts, opps, timeline };
    } catch (e) {
      if (!d) { clear(view); view.append(el('div', { class: 'card error' }, 'بارگذاری اکانت ناموفق بود.')); }
      toastError(e);
      return;
    }
    build(flashLast);
  }
  const reload = (flash) => load({ flashLast: flash });

  function build(flashLast) {
    clear(view);
    const { account, contacts, opps, timeline } = d;
    if (!account) { view.append(el('div', { class: 'card' }, 'اکانت پیدا نشد.', ' ', el('a', { href: '#/search' }, 'بازگشت به جستجو'))); return; }
    const today = todayTehran();
    const linkedIds = contacts.map((c) => c.contacts?.id).filter(Boolean);
    const info = [['شهر', account.city], ['منطقه', account.district], ['آدرس', account.address], ['تلفن ثابت', account.landline], ['نرم‌افزار', account.software], ['GLN', account.gln]];

    const copyBtn = btn('کپی خلاصه', async () => {
      const text = buildSummary({ account, contacts, opps, timeline, label, formatDate, formatDateTime });
      if (await copyText(text)) toast('خلاصه کپی شد.', 'ok'); else toast('کپی انجام نشد. اجازهٔ مرورگر را بررسی کنید.', 'error');
    });
    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' },
        el('h1', {}, account.name, ' ', el('span', { class: 'muted small ltr' }, account.code), account.status === 'archived' ? el('span', { class: 'badge' }, 'بایگانی') : null),
        el('div', { class: 'actions' },
          btn('ثبت اقدام (N)', () => openQuickLog({ account, opps, contacts, onSaved: () => reload(true) }), 'primary'),
          btn('ویرایش اکانت', () => openAccountForm({ account, onSaved: () => reload() })),
          copyBtn)),
      el('dl', { class: 'info' }, info.map(([k, v]) => [el('dt', {}, k), el('dd', { class: k === 'GLN' || k === 'تلفن ثابت' ? 'ltr' : '' }, v || '—')]))));

    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h2', {}, 'کانتکت‌ها'), btn('+ کانتکت', () => openContactForm({ account, linkedIds, onSaved: () => reload() }))),
      contacts.length ? el('div', { class: 'table-wrap' }, el('table', {}, th('نام', 'موبایل', 'نقش', '', ''),
        el('tbody', {}, contacts.map((c) => {
          const p = c.contacts || {};
          return el('tr', {}, td(p.name || '—'),
            td(p.mobile ? el('a', { href: 'tel:' + p.mobile, class: 'ltr' }, p.mobile) : '—'),
            td(label('contact_role', c.role) || '—'),
            td(c.is_primary ? el('span', { class: 'badge' }, 'اصلی') : ''),
            td(btn('ویرایش', () => openContactForm({ account, link: c, linkedIds, onSaved: () => reload() }), 'small-btn')));
        })))) : el('p', { class: 'muted' }, 'کانتکتی ثبت نشده است.')));

    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h2', {}, 'فرصت‌ها'), btn('+ فرصت (محصول دیگر)', () => openOppForm({ account, opps, onSaved: () => reload() }))),
      opps.length ? el('div', { class: 'table-wrap' }, el('table', {}, th('محصول', 'مرحله', 'دلیل', 'آخرین اقدام', 'قدم بعدی', 'روز از آخرین', 'یادداشت تحویل', ''),
        el('tbody', {}, opps.map((o) => {
          const reason = o.stage === 'Pending' ? label('pending_reason', o.stage_reason) : o.stage === 'Lost' ? label('lost_reason', o.stage_reason) : '';
          const open = o.stage !== 'Won' && o.stage !== 'Lost';
          const overdue = open && o.next_step_date && o.next_step_date <= today;
          const last = o.last_activity_at ? [formatDate(o.last_activity_at), label('activity_type', o.last_activity_type), label('activity_result', o.last_activity_result)].filter(Boolean).join(' · ') : '—';
          return el('tr', {}, td(o.product_name), td(stageBadge(o.stage)), td(reason || '—'), td(last),
            td(o.next_step_date ? `${formatDate(o.next_step_date)}${o.next_step_text ? ' — ' + o.next_step_text : ''}` : '—', overdue ? 'overdue' : ''),
            td(o.days_since_last ?? '—'), td(o.handoff_note || '—', 'note'),
            td(btn('تغییر مرحله', () => openStageDialog({ opp: o, onSaved: () => reload() }), 'small-btn')));
        })))) : el('p', { class: 'muted' }, 'فرصتی ثبت نشده است.')));

    view.append(el('div', { class: 'card' }, el('h2', {}, 'تایم‌لاین'),
      timeline.length ? el('div', { class: 'table-wrap' }, el('table', { class: 'timeline' }, th('تاریخ', 'منبع', 'نوع / نتیجه', 'کانتکت', 'یادداشت', 'قدم بعدی'),
        el('tbody', {}, timeline.map((t) => {
          const support = t.source === 'پشتیبانی';
          const kind = support ? label('support_result', t.result) : [label('activity_type', t.type), label('activity_result', t.result)].filter(Boolean).join(' · ');
          const next = support ? (t.follow_up_date ? `پیگیری: ${formatDate(t.follow_up_date)}` : '') : (t.next_step_date ? `${formatDate(t.next_step_date)}${t.next_step_text ? ' — ' + t.next_step_text : ''}` : '');
          const flagged = (t.flags || []).includes('tag_ignored');
          return el('tr', {}, td(formatDateTime(t.occurred_at), 'nowrap'), td(t.source), td(kind || '—'), td(t.contact_name || '—'),
            td([t.note || '', flagged ? el('span', { class: 'badge warn' }, 'تگ #won/#lost نادیده گرفته شد') : null], 'note'), td(next || '—'));
        })))) : el('p', { class: 'muted' }, 'هنوز اقدامی ثبت نشده است.')));

    if (flashLast) {
      const rows = view.querySelectorAll('.timeline tbody tr');
      const last = rows[rows.length - 1];
      if (last) { last.classList.add('flash'); last.scrollIntoView({ block: 'center' }); }
    }
  }

  await load();
  // N (physical key, works with the Persian layout too) opens the quick log.
  const onKey = (e) => {
    if (e.code !== 'KeyN' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isDialogOpen() || !d?.account) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    e.preventDefault();
    openQuickLog({ account: d.account, opps: d.opps, contacts: d.contacts, onSaved: () => reload(true) });
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
