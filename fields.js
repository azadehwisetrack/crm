import { el, friendlyError } from './ui.js';
import { formatDate, parseDateInput, parseTimeInput } from './jalali.js';

let uid = 0;
export function field(labelText, input, hintText = '') {
  const id = 'f' + (++uid);
  input.id = id;
  const hint = el('div', { class: 'hint muted small' }, hintText);
  const root = el('div', { class: 'field' }, el('label', { for: id }, labelText), input, hint);
  return { root, input, hint };
}

export function selectEl(opts, value = '') {
  return el('select', {}, opts.map((o) => el('option', { value: o.value, selected: String(o.value) === String(value), disabled: o.disabled }, o.label)));
}

function setHint(f, text, isError) {
  f.hint.textContent = text || '';
  f.hint.className = 'hint small ' + (isError ? 'error' : 'muted');
  f.input.classList.toggle('invalid', !!isError);
}

// Jalali date input. value() -> {ok, iso|null, text}. Accepts 1405/08/12, 14050812, 1405812, t, Persian digits.
export function dateField(labelText, { iso = null, required = false } = {}) {
  const input = el('input', { type: 'text', class: 'ltr', autocomplete: 'off', placeholder: '1405/08/12 یا t' });
  if (iso) input.value = formatDate(iso);
  const f = field(labelText, input);
  function check() {
    const v = input.value.trim();
    if (!v) {
      if (required) { setHint(f, 'تاریخ را وارد کنید.', true); return { ok: false, iso: null }; }
      setHint(f, ''); return { ok: true, iso: null };
    }
    const r = parseDateInput(v);
    if (!r.ok) { setHint(f, r.error, true); return { ok: false, iso: null }; }
    setHint(f, r.warning || '', false);
    return { ok: true, iso: r.iso, text: r.text };
  }
  input.addEventListener('input', check);
  input.addEventListener('blur', () => { const r = check(); if (r.ok && r.text) input.value = r.text; });
  return { root: f.root, input, value: check };
}

// Time input: 9, 9:25, 925, 1430, ۹.۲۵ -> HH:MM
export function timeField(labelText, def = '10:00') {
  const input = el('input', { type: 'text', class: 'ltr', autocomplete: 'off', value: def, placeholder: '10:00' });
  const f = field(labelText, input);
  function check() {
    const r = parseTimeInput(input.value);
    if (!r.ok) { setHint(f, r.error, true); return { ok: false }; }
    setHint(f, ''); return { ok: true, text: r.text };
  }
  input.addEventListener('input', check);
  input.addEventListener('blur', () => { const r = check(); if (r.ok) input.value = r.text; });
  return { root: f.root, input, value: check };
}

// Wires a form: Enter submits, errors appear inline, button is disabled while busy.
export function wireForm(form, btn, errBox, fn) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errBox.textContent = '';
    btn.disabled = true;
    try { await fn(); } catch (e) { console.error(e); errBox.textContent = e.userMessage || friendlyError(e); } finally { btn.disabled = false; }
  });
}
