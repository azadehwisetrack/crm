import { el, toastError } from '../ui.js';
import { api } from '../api.js';
import { label, loadLookups } from '../lookups.js';
import { STAGES } from '../i18n.js';
import { todayTehran, tehranToIso, formatTime } from '../jalali.js';

const SOURCE = { manual: 'دستی', tag: 'تگ', suggestion: 'پیشنهاد', migration: 'مهاجرت' };
const stat = (value, text, cls) => el('div', { class: 'stat' }, el('div', { class: 'stat-value ' + (cls || '') }, String(value ?? 0)), el('div', { class: 'muted' }, text));
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));

export async function renderDashboard(view) {
  view.append(el('div', { class: 'card muted' }, 'در حال بارگذاری…'));
  let d, hist;
  try {
    [d, hist] = await Promise.all([api.dashboard(), api.stageChangesSince(tehranToIso(todayTehran(), '00:00')), loadLookups().catch(() => {})]);
  } catch (e) { view.replaceChildren(el('div', { class: 'card error' }, 'بارگذاری داشبورد ناموفق بود.')); toastError(e); return; }
  d = d || {};
  const byStage = { New: d.new_count, 'In progress': d.in_progress_count, Pending: d.pending_count, Won: d.won_count, Lost: d.lost_count };

  const reasonOf = (h) => (h.to_stage === 'Pending' ? label('pending_reason', h.reason) : h.to_stage === 'Lost' ? label('lost_reason', h.reason) : '');
  view.replaceChildren(
    el('div', { class: 'card' }, el('h1', {}, 'داشبورد'),
      el('h2', {}, 'فرصت‌ها به تفکیک مرحله'),
      el('div', { class: 'stats' }, STAGES.map((s) => stat(byStage[s], s, 'stage-' + s.replace(' ', '-'))), stat(d.active_accounts, 'اکانت فعال'))),
    el('div', { class: 'card' }, el('h2', {}, 'امروز و ۷ روز گذشته'),
      el('div', { class: 'stats' }, stat(d.activities_today, 'اقدام امروز'), stat(d.calls_7d, 'تماس (۷ روز)'), stat(d.meetings_7d, 'جلسه (۷ روز)'),
        stat(d.won_7d, 'Won (۷ روز)', 'stage-Won'), stat(d.lost_7d, 'Lost (۷ روز)', 'stage-Lost'))),
    el('div', { class: 'card' }, el('h2', {}, `تغییر مرحله‌های امروز (${hist.length})`),
      hist.length ? el('div', { class: 'table-wrap' }, el('table', {}, th('ساعت', 'اکانت', 'تغییر', 'دلیل', 'منبع'),
        el('tbody', {}, hist.map((h) => {
          const o = h.opportunities || {};
          const name = o.accounts?.name || o.code || '—';
          return el('tr', {}, el('td', { class: 'nowrap' }, formatTime(h.changed_at)),
            el('td', {}, o.account_id ? el('a', { href: '#/account/' + o.account_id }, name) : name),
            el('td', {}, el('span', { class: 'ltr' }, `${h.from_stage || '—'} → ${h.to_stage}`)),
            el('td', {}, reasonOf(h) || '—'), el('td', {}, SOURCE[h.source] || h.source));
        })))) : el('p', { class: 'muted' }, 'امروز تغییر مرحله‌ای ثبت نشده است.')));
}
