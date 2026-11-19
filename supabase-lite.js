// Minimal Supabase client written for this app (no external library, nothing to download):
//  - auth: email + password login, session kept in the browser, silent token refresh, sign-out
//  - data: PostgREST query builder (select / insert / update / upsert / filters / order / range / rpc)
// It talks to the same public REST endpoints as the official library (/auth/v1 and /rest/v1).
const STORE_KEY = 'crm_session_v1';

function makeStorage() {
  try { const k = '__crm_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; }
  catch { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; }
}

function parseCount(range) {
  if (!range) return null;
  const total = String(range).split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

class Auth {
  constructor(url, key) {
    this.url = url; this.key = key; this.storage = makeStorage();
    this.listeners = new Set(); this.refreshing = null;
  }
  _read() { try { return JSON.parse(this.storage.getItem(STORE_KEY) || 'null'); } catch { return null; } }
  _write(s) { if (s) this.storage.setItem(STORE_KEY, JSON.stringify(s)); else this.storage.removeItem(STORE_KEY); }
  _emit(event, session = null) { this.listeners.forEach((cb) => { try { cb(event, session); } catch (e) { console.error(e); } }); }
  async _post(path, body, token) {
    const headers = { apikey: this.key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${this.url}/auth/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { res, json };
  }
  _error(res, json) {
    const e = new Error(json?.msg || json?.error_description || json?.message || `HTTP ${res.status}`);
    e.status = res.status; e.code = json?.error_code || json?.code;
    return e;
  }
  _session(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user };
  }
  async signInWithPassword({ email, password }) {
    try {
      const { res, json } = await this._post('token?grant_type=password', { email, password });
      if (!res.ok || !json?.access_token) return { data: { session: null, user: null }, error: this._error(res, json) };
      const s = this._session(json);
      this._write(s);
      return { data: { session: s, user: s.user }, error: null };
    } catch (e) { return { data: { session: null, user: null }, error: e }; }
  }
  async getSession() {
    const s = this._read();
    if (!s) return { data: { session: null }, error: null };
    if (s.expires_at - 60 > Date.now() / 1000) return { data: { session: s }, error: null };
    return { data: { session: await this._refresh(s) }, error: null };
  }
  _refresh(s) {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const { res, json } = await this._post('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
          if (res.ok && json?.access_token) { const n = this._session(json); this._write(n); return n; }
          if (res.status >= 400 && res.status < 500) { this._write(null); this._emit('SIGNED_OUT'); } // session really ended
          return null;
        } catch { return null; } // offline: keep the stored session, try again later
        finally { this.refreshing = null; }
      })();
    }
    return this.refreshing;
  }
  async token() { const { data } = await this.getSession(); return data.session?.access_token || null; }
  async signOut() {
    const s = this._read();
    this._write(null);
    if (s) { try { await this._post('logout?scope=local', {}, s.access_token); } catch { /* already signed out locally */ } }
    return { error: null };
  }
  onAuthStateChange(cb) {
    this.listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => this.listeners.delete(cb) } } };
  }
}

class Query {
  constructor(client, path, method = 'GET') {
    this.c = client; this.path = path; this.method = method;
    this.params = new URLSearchParams(); this.headers = {}; this.prefer = []; this.body = undefined; this.mode = 'list';
  }
  select(cols = '*', opts = {}) {
    this.params.set('select', String(cols).replace(/\s+/g, ''));
    if (this.method !== 'GET' && this.method !== 'HEAD') this.prefer.push('return=representation');
    if (opts.count) this.prefer.push(`count=${opts.count}`);
    if (opts.head) this.method = 'HEAD';
    return this;
  }
  insert(rows) { this.method = 'POST'; this.body = rows; return this; }
  update(patch) { this.method = 'PATCH'; this.body = patch; return this; }
  upsert(rows, { onConflict } = {}) {
    this.method = 'POST'; this.body = rows; this.prefer.push('resolution=merge-duplicates');
    if (onConflict) this.params.set('on_conflict', onConflict);
    return this;
  }
  eq(col, val) { this.params.append(col, `eq.${val}`); return this; }
  gte(col, val) { this.params.append(col, `gte.${val}`); return this; }
  or(filters) { this.params.append('or', `(${filters})`); return this; }
  order(col, { ascending = true, nullsFirst } = {}) {
    const part = `${col}.${ascending ? 'asc' : 'desc'}${nullsFirst === undefined ? '' : nullsFirst ? '.nullsfirst' : '.nullslast'}`;
    const prev = this.params.get('order');
    this.params.set('order', prev ? `${prev},${part}` : part);
    return this;
  }
  limit(n) { this.params.set('limit', String(n)); return this; }
  range(from, to) { this.params.set('offset', String(from)); this.params.set('limit', String(to - from + 1)); return this; }
  single() { this.mode = 'single'; this.headers.Accept = 'application/vnd.pgrst.object+json'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(resolve, reject) { return this._run().then(resolve, reject); }

  async _run() {
    try {
      const token = await this.c.auth.token();
      const headers = { apikey: this.c.key, ...this.headers };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (this.body !== undefined) headers['Content-Type'] = 'application/json';
      if (this.prefer.length) headers.Prefer = this.prefer.join(',');
      const qs = this.params.toString();
      const res = await fetch(`${this.c.url}/rest/v1/${this.path}${qs ? '?' + qs : ''}`, {
        method: this.method, headers, body: this.body !== undefined ? JSON.stringify(this.body) : undefined,
      });
      const count = parseCount(res.headers.get('content-range'));
      const text = this.method === 'HEAD' ? '' : await res.text();
      let json = null;
      if (text) { try { json = JSON.parse(text); } catch { json = null; } }
      if (!res.ok) {
        const error = { message: json?.message || json?.error_description || text || `HTTP ${res.status}`, code: json?.code, details: json?.details, hint: json?.hint, status: res.status };
        return { data: null, count: null, status: res.status, error };
      }
      let data = json;
      if (this.mode === 'maybe' && Array.isArray(data)) {
        if (data.length > 1) return { data: null, count, status: res.status, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
        data = data.length ? data[0] : null;
      }
      return { data, count, status: res.status, error: null };
    } catch (e) {
      return { data: null, count: null, status: 0, error: e }; // network failure (TypeError) -> shown as a Persian network message
    }
  }
}

export function createClient(url, key) {
  const client = { url: url.replace(/\/+$/, ''), key };
  client.auth = new Auth(client.url, key);
  client.from = (table) => new Query(client, table);
  client.rpc = (fn, args = {}) => { const q = new Query(client, `rpc/${fn}`, 'POST'); q.body = args; return q; };
  return client;
}
