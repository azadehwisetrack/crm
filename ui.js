import { t } from './i18n.js';

// DOM helper. Text is ALWAYS inserted as text nodes (never innerHTML) so user data cannot inject markup.
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

export const clear = (node) => node.replaceChildren();

export function toast(msg, type = 'info', ms = 4500) {
  const box = document.getElementById('toasts');
  const n = el('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, msg);
  box.append(n);
  setTimeout(() => n.remove(), ms);
}

export function friendlyError(err) {
  if (!err) return t.unexpected;
  const msg = String(err.message || err);
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) return t.networkError;
  switch (err.code) {
    case 'P0001': return err.message; // business-rule messages raised by our own SQL functions (Persian)
    case '42501': return t.forbidden;
    case '23505': return t.duplicate;
    case '23514': return t.invalidValue;
    case '23503': return 'این مورد به رکوردهای دیگر وابسته است.';
    case 'PGRST301': case 'PGRST303': return 'نشست شما منقضی شده است. دوباره وارد شوید.';
    default: return err.isPersian ? msg : `${t.unexpected} (${msg})`;
  }
}

export function toastError(err) {
  console.error(err);
  toast(friendlyError(err), 'error', 7000);
}

export function initNetworkBanner() {
  const b = document.getElementById('banner');
  const sync = () => { b.hidden = navigator.onLine; };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}

// Disables a button while an async action runs.
export async function withBusy(button, fn) {
  button.disabled = true;
  try { return await fn(); } finally { button.disabled = false; }
}

// Modal dialog (native <dialog>: Esc closes, focus is trapped). Errors inside dialogs are shown inline
// because toasts sit underneath the browser's top layer.
export function openDialog(title, content, { onClose } = {}) {
  const dlg = el('dialog', { class: 'dialog', 'aria-label': title });
  const close = () => { if (dlg.open) dlg.close(); };
  const x = el('button', { type: 'button', class: 'icon', 'aria-label': 'بستن' }, '✕');
  x.addEventListener('click', close);
  dlg.append(el('div', { class: 'dialog-head' }, el('h2', {}, title), x), content);
  dlg.addEventListener('close', () => { dlg.remove(); if (onClose) onClose(); });
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}

export const isDialogOpen = () => !!document.querySelector('dialog[open]');

// Copies text to the clipboard (falls back to execCommand when the Clipboard API is unavailable).
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  const ta = el('textarea', { class: 'offscreen', 'aria-hidden': 'true' });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
