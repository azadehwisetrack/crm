// Jalali (Persian) calendar helpers built on the browser's Intl (no external library). Zone: Asia/Tehran.
import { toLatinDigits } from './normalize.js';

const TZ = 'Asia/Tehran';
const DAY = 864e5;
const gFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = JS getUTCDay()
const pad = (n) => String(n).padStart(2, '0');
const noon = (iso) => new Date(iso + 'T12:00:00Z');
const part = (parts, t) => Number(parts.find((p) => p.type === t).value);

// ---- Calendar core: algorithm of jalaali-js (MIT), which follows the official Iranian calendar.
// (The browser's Intl "persian" calendar is arithmetic and differs by one day in some leap years, so it is NOT used.)
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - Math.trunc(a / b) * b;

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
  for (i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { y: jy, m: 1 + div(k, 31), d: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { y: jy, m: 7 + div(k, 30), d: mod(k, 30) + 1 };
}

const isLeapJ = (jy) => jalCal(jy).leap === 0;
function validJ(jy, jm, jd) {
  if (!(jy >= 1200 && jy <= 1700 && jm >= 1 && jm <= 12 && jd >= 1)) return false;
  const len = jm <= 6 ? 31 : jm <= 11 ? 30 : (isLeapJ(jy) ? 30 : 29);
  return jd <= len;
}

// Jalali date of the Tehran calendar day containing the instant `date`.
export function toJalali(date) {
  const p = gFmt.formatToParts(date);
  return d2j(g2d(part(p, 'year'), part(p, 'month'), part(p, 'day')));
}

// Gregorian ISO date (YYYY-MM-DD), or null when the Jalali date does not exist.
export function toGregorian(jy, jm, jd) {
  if (!validJ(jy, jm, jd)) return null;
  const r = jalCal(jy);
  const g = d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export const fmtJalali = (y, m, d) => `${y}/${pad(m)}/${pad(d)}`;

// iso: 'YYYY-MM-DD' (date) or a full timestamp string / Date (instant, shown in Tehran).
export function formatDate(v) {
  if (!v) return '';
  const d = typeof v === 'string' && v.length === 10 ? noon(v) : new Date(v);
  const j = toJalali(d);
  return fmtJalali(j.y, j.m, j.d);
}

export function formatTime(v) {
  const p = gFmt.formatToParts(new Date(v));
  return `${pad(part(p, 'hour'))}:${pad(part(p, 'minute'))}`;
}

export const formatDateTime = (v) => (v ? `${formatDate(v)} ${formatTime(v)}` : '');

export function todayTehran() {
  const p = gFmt.formatToParts(new Date());
  return `${part(p, 'year')}-${pad(part(p, 'month'))}-${pad(part(p, 'day'))}`;
}

export const addDays = (iso, n) => new Date(noon(iso).getTime() + n * DAY).toISOString().slice(0, 10);
export const weekdayName = (iso) => WEEKDAYS[noon(iso).getUTCDay()];
export const isFriday = (iso) => noon(iso).getUTCDay() === 5;

// Default day-plan date: tomorrow, skipping Friday.
export function planDefaultDay(today = todayTehran(), skipFriday = true) {
  let d = addDays(today, 1);
  if (skipFriday && isFriday(d)) d = addDays(d, 1);
  return d;
}

// Tehran local date + HH:MM -> UTC ISO string for storage (Iran has no DST since 2022).
export const tehranToIso = (isoDate, hhmm) => new Date(`${isoDate}T${hhmm}:00+03:30`).toISOString();

function finish(y, m, d, warning) {
  const iso = toGregorian(y, m, d);
  if (!iso) return { ok: false, error: 'تاریخ نامعتبر است. نمونه: 1405/08/12' };
  return { ok: true, iso, text: fmtJalali(y, m, d), warning: warning || null };
}

export function parseDateInput(input, today = todayTehran()) {
  const s = toLatinDigits(input).trim().toLowerCase();
  if (!s) return { ok: false, error: 'تاریخ را وارد کنید. نمونه: 1405/08/12' };
  if (s === 't' || s === 'امروز' || s === 'today') {
    const j = toJalali(noon(today));
    return finish(j.y, j.m, j.d);
  }
  if (/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(/[/\-.]/).map(Number);
    return finish(y, m, d);
  }
  if (/^\d{8}$/.test(s)) return finish(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6));
  if (/^\d{7}$/.test(s)) {
    const y = +s.slice(0, 4);
    const a = { m: +s[4], d: +s.slice(5) };
    const b = { m: +s.slice(4, 6), d: +s[6] };
    const okA = toGregorian(y, a.m, a.d) !== null;
    const okB = toGregorian(y, b.m, b.d) !== null;
    if (okA) return finish(y, a.m, a.d, okB ? `تاریخ مبهم بود؛ ${fmtJalali(y, a.m, a.d)} انتخاب شد. در صورت نیاز با جداکننده بنویسید.` : null);
    if (okB) return finish(y, b.m, b.d);
  }
  return { ok: false, error: 'تاریخ نامعتبر است. نمونه: 1405/08/12 یا 14050812 یا t' };
}

export function parseTimeInput(input) {
  const s = toLatinDigits(input).trim();
  if (!s) return { ok: false, error: 'ساعت را وارد کنید. نمونه: 9:25' };
  let h, mi;
  let m = s.match(/^(\d{1,2})[:.٫/](\d{1,2})$/);
  if (m) { h = +m[1]; mi = +m[2]; }
  else if (/^\d{1,2}$/.test(s)) { h = +s; mi = 0; }
  else if (/^\d{3,4}$/.test(s)) { mi = +s.slice(-2); h = +s.slice(0, -2); }
  else return { ok: false, error: 'ساعت نامعتبر است. نمونه: 9 یا 9:25 یا 1430' };
  if (h > 23 || mi > 59) return { ok: false, error: 'ساعت نامعتبر است. نمونه: 9 یا 9:25 یا 1430' };
  return { ok: true, text: `${pad(h)}:${pad(mi)}` };
}
