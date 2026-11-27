import { el, clear, friendlyError, withBusy } from './ui.js';
import { t } from './i18n.js';

export function renderLogin(root, { onLogin }) {
  clear(root);
  const err = el('div', { class: 'form-error error', role: 'alert' });
  const email = el('input', { id: 'email', type: 'email', class: 'ltr', autocomplete: 'username', required: true });
  const pass = el('input', { id: 'password', type: 'password', class: 'ltr', autocomplete: 'current-password', required: true });
  const btn = el('button', { type: 'submit', class: 'primary' }, t.login);
  const form = el('form', { class: 'card login', novalidate: true },
    el('h1', {}, t.appName),
    el('label', { for: 'email' }, t.email), email,
    el('label', { for: 'password' }, t.password), pass,
    err,
    btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    err.textContent = '';
    if (!email.value.trim() || !pass.value) { err.textContent = 'ایمیل و رمز عبور را وارد کنید.'; return; }
    await withBusy(btn, async () => {
      try { await onLogin(email.value, pass.value); } catch (e) { err.textContent = friendlyError(e); pass.value = ''; pass.focus(); }
    });
  });
  root.append(form);
  email.focus();
}
