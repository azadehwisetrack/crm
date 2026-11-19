// ALL Supabase calls go through this file. Every call surfaces errors as a Persian toast (never swallowed).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from './supabase-lite.js';
import { toastError } from './ui.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Awaits a supabase query, throws on error, toasts unless quiet.
export async function run(query, { quiet = false } = {}) {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (e) {
    if (!quiet) toastError(e);
    throw e;
  }
}

export const api = {
  getMyProfile: (uid, opts) =>
    run(sb.from('profiles').select('user_id,display_name,role,active').eq('user_id', uid).maybeSingle(), opts),
  dashboard: () => run(sb.from('v_dashboard').select('*').maybeSingle()),
  supportQueue: () => run(sb.rpc('rpc_support_queue')),
};

// ---- Phase 3: read-only queries
Object.assign(api, {
  lookups: (o) => run(sb.from('lookups').select('kind,key,label,sort,active'), o),
  search: (q) => run(sb.rpc('rpc_search', { q }), { quiet: true }),
  account: (id, o) => run(sb.from('accounts').select('*').eq('id', id).maybeSingle(), o),
  accountContacts: (id, o) => run(
    sb.from('account_contacts').select('role,is_primary,contacts(id,code,name,mobile,mobile2,note)')
      .eq('account_id', id).eq('status', 'active'), o),
  accountOpportunities: (id, o) => run(
    sb.from('v_opportunity_summary').select('*').eq('account_id', id).order('opened_at', { ascending: false }), o),
  timeline: (id, o) => run(sb.rpc('rpc_account_timeline', { account: id }), o),
});

// ---- Phase 4: writes (errors are returned to the dialog, which shows them inline)
const q = (query) => run(query, { quiet: true });
Object.assign(api, {
  products: () => q(sb.from('products').select('id,code,name').eq('active', true).order('id')),
  createAccount: (row) => q(sb.from('accounts').insert(row).select().single()),
  updateAccount: (id, patch) => q(sb.from('accounts').update(patch).eq('id', id).select().single()),
  // `mobile` must already be normalized and validated (09xxxxxxxxx) by the caller.
  findContactByMobile: (mobile) => q(sb.from('contacts').select('id,code,name,mobile,status').or(`mobile.eq.${mobile},mobile2.eq.${mobile}`).limit(1).maybeSingle()),
  createContact: (row) => q(sb.from('contacts').insert(row).select().single()),
  updateContact: (id, patch) => q(sb.from('contacts').update(patch).eq('id', id).select().single()),
  linkContact: (account, contact, role, primary) => q(sb.rpc('rpc_link_contact', { p_account: account, p_contact: contact, p_role: role || null, p_primary: !!primary })),
  unlinkContact: (account, contact) => q(sb.from('account_contacts').update({ status: 'archived', is_primary: false }).eq('account_id', account).eq('contact_id', contact)),
  createActivity: (row) => q(sb.from('activities').insert(row).select('id').single()),
  changeStage: (opp, stage, reason, handoff, note) => q(sb.rpc('rpc_change_stage', { p_opp: opp, p_stage: stage, p_reason: reason || null, p_handoff: handoff || null, p_note: note || null })),
  createOpportunity: (account_id, product_id) => q(sb.from('opportunities').insert({ account_id, product_id }).select().single()),
});

// ---- Phase 5: queues, day plan, dashboard
export const QUEUE_PAGE_SIZE = 50;
Object.assign(api, {
  queueCount: async (view) => {
    const { count, error } = await sb.from(view).select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count;
  },
  // Sorted by next_step_date ascending (nulls last), then district, then name. 50 rows per page.
  queuePage: async (view, page) => {
    let query = sb.from(view).select('*', { count: 'exact' });
    if (view === 'v_accounts_without_opportunity') {
      query = query.order('district', { ascending: true, nullsFirst: false }).order('account_name');
    } else {
      query = query.order('next_step_date', { ascending: true, nullsFirst: false })
        .order('district', { ascending: true, nullsFirst: false }).order('account_name');
    }
    const from = page * QUEUE_PAGE_SIZE;
    const { data, count, error } = await query.range(from, from + QUEUE_PAGE_SIZE - 1);
    if (error) throw error;
    return { rows: data, count };
  },
  settings: (o) => run(sb.from('settings').select('key,value'), o),
  dayPlan: (day) => run(sb.rpc('rpc_day_plan', { day }), { quiet: true }),
  stageChangesSince: (sinceIso) => run(
    sb.from('stage_history').select('changed_at,from_stage,to_stage,reason,source,opportunities(code,account_id,accounts(name))')
      .gte('changed_at', sinceIso).order('changed_at', { ascending: false }), { quiet: true }),
});

// ---- Phase 6: support
Object.assign(api, {
  addSupportResult: (row) => q(sb.from('support_results').insert(row).select('id').single()),
});

// ---- Phase 7: settings, users, export
Object.assign(api, {
  productsAll: () => q(sb.from('products').select('id,code,name,active').order('id')),
  createProduct: (name) => q(sb.from('products').insert({ name }).select().single()),
  updateProduct: (id, patch) => q(sb.from('products').update(patch).eq('id', id).select().single()),
  saveSetting: (key, value) => q(sb.from('settings').upsert({ key, value: String(value) })),
  createLookup: (row) => q(sb.from('lookups').insert(row).select().single()),
  updateLookup: (kind, key, patch) => q(sb.from('lookups').update(patch).eq('kind', kind).eq('key', key).select().single()),
  listProfiles: () => q(sb.rpc('rpc_list_profiles')),
  setDisplayName: (user, name) => q(sb.rpc('rpc_set_display_name', { p_user: user, p_name: name })),
  // Pages through a table 1000 rows at a time (PostgREST default max) in a stable order.
  exportPage: (table, columns, order, from) => {
    let query = sb.from(table).select(columns.join(','));
    for (const o of order) query = query.order(o);
    return q(query.range(from, from + 999));
  },
});
