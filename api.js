// ALL Supabase calls go through this file. Writes return errors to the dialog (shown inline); reads toast once.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from './supabase-lite.js';
import { toastError } from './ui.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const q = (query) => run(query, { quiet: true });

export const PAGE = 50;
// Editable lists (settings) and how they are ordered.
export const LISTS = { task_users: ['name', 'id'], task_statuses: ['sort', 'id'], task_types: ['sort', 'id'], products: ['id'], activity_fields: ['name', 'id'] };
const ordered = (query, cols) => cols.reduce((x, c) => x.order(c), query);
const assertList = (table) => { if (!LISTS[table]) throw new Error('invalid list ' + table); };

// PostgREST returns at most 1000 rows per request: page through them.
async function pagedAll(table, select, order, refine = (x) => x) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await q(refine(ordered(sb.from(table).select(select), order)).range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export const api = {
  getMyProfile: (uid, opts) => run(sb.from('profiles').select('user_id,display_name,role,active').eq('user_id', uid).maybeSingle(), opts),

  // ---- editable lists
  listRows: (table) => { assertList(table); return q(ordered(sb.from(table).select('*'), LISTS[table])); },
  addRow: (table, row) => { assertList(table); return q(sb.from(table).insert(row).select().single()); },
  updateRow: (table, id, patch) => { assertList(table); return q(sb.from(table).update(patch).eq('id', id).select().single()); },
  deleteRow: async (table, id) => {
    assertList(table);
    const rows = await q(sb.from(table).delete().eq('id', id).select());
    if (!rows || !rows.length) throw Object.assign(new Error('x'), { userMessage: 'حذف انجام نشد.' });
  },

  // ---- accounts
  accounts: () => pagedAll('accounts', 'id,code,name,landline,city,district,address,field_id,status,activity_fields(name)', ['name']),
  accountNames: () => pagedAll('accounts', 'id,name', ['name'], (x) => x.eq('status', 'active')),
  account: (id) => q(sb.from('accounts').select('*,activity_fields(name)').eq('id', id).maybeSingle()),
  createAccount: (row) => q(sb.from('accounts').insert(row).select().single()),
  updateAccount: (id, patch) => q(sb.from('accounts').update(patch).eq('id', id).select().single()),

  // ---- persons (contacts)
  persons: () => pagedAll('contacts', 'id,first_name,last_name,mobile,job_title,account_contacts(status,accounts(id,name))', ['last_name', 'first_name']),
  accountPersons: async (accountId) => {
    const rows = await q(sb.from('account_contacts').select('contacts(id,first_name,last_name,mobile,job_title)').eq('account_id', accountId).eq('status', 'active'));
    return rows.map((r) => r.contacts).filter(Boolean).sort((a, b) => String(a.last_name).localeCompare(String(b.last_name), 'fa'));
  },
  createPerson: (row) => q(sb.from('contacts').insert(row).select('id').single()),
  updatePerson: (id, patch) => q(sb.from('contacts').update(patch).eq('id', id).select('id').single()),
  // A person belongs to one account in the UI: archive other links, then link (or leave unlinked).
  setPersonAccount: async (personId, accountId) => {
    await q(sb.from('account_contacts').update({ status: 'archived', is_primary: false }).eq('contact_id', personId));
    if (accountId) await q(sb.rpc('rpc_link_contact', { p_account: accountId, p_contact: personId, p_role: null, p_primary: false }));
  },

  // ---- sales status of a product on an account
  activeProducts: () => q(sb.from('products').select('id,name').eq('active', true).order('id')),
  accountOpps: (accountId) => q(sb.from('opportunities').select('id,product_id,stage').eq('account_id', accountId)),
  setProductStatus: (account_id, product_id, stage) => q(sb.from('opportunities').upsert({ account_id, product_id, stage }, { onConflict: 'account_id,product_id' })),

  // ---- tasks
  tasksPage: async (statusId, page) => {
    let query = sb.from('v_tasks').select('*', { count: 'exact' });
    if (statusId) query = query.eq('status_id', statusId);
    query = query.order('due_date', { ascending: false }).order('due_time', { ascending: false }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return { rows: data, count };
  },
  tasksOnDate: (iso) => q(sb.from('v_tasks').select('*').eq('due_date', iso).order('due_time')),
  accountTasks: (accountId) => q(sb.from('v_tasks').select('*').eq('account_id', accountId).order('due_date', { ascending: false }).order('due_time', { ascending: false }).limit(50)),
  createTask: (row) => q(sb.from('tasks').insert(row).select('id').single()),
  updateTask: (id, patch) => q(sb.from('tasks').update(patch).eq('id', id).select('id').single()),
  dashboard: () => q(sb.from('v_dashboard_simple').select('*').maybeSingle()),

  // ---- backup: pages through a table 1000 rows at a time in a stable order
  exportPage: (table, columns, order, from) => q(ordered(sb.from(table).select(columns.join(',')), order).range(from, from + 999)),
};
