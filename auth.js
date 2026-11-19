import { sb, api } from './api.js';
import { t } from './i18n.js';

export const state = { session: null, profile: null };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn());
const persian = (msg) => Object.assign(new Error(msg), { isPersian: true });

async function loadProfile() {
  state.profile = null;
  if (!state.session) return;
  try { state.profile = await api.getMyProfile(state.session.user.id, { quiet: true }); } catch { state.profile = null; }
  if (state.profile && !state.profile.active) state.profile = null;
}

export async function init() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadProfile();
  if (state.session && !state.profile) { await sb.auth.signOut(); state.session = null; }
  // Do not call supabase APIs inside this callback (can deadlock); only record the sign-out.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && state.session) {
      state.session = null; state.profile = null;
      setTimeout(notify, 0);
    }
  });
}

export async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login/i.test(error.message)) throw persian(t.loginFailed);
    throw error;
  }
  state.session = data.session;
  await loadProfile();
  if (!state.profile) {
    await sb.auth.signOut();
    state.session = null;
    throw persian(t.noProfile);
  }
  notify();
}

export async function logout() {
  await sb.auth.signOut();
  state.session = null; state.profile = null;
  notify();
}
