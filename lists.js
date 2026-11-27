import { api } from './api.js';

let cache = null, accountsCache = null;

// All editable lists in one call (task users / statuses / types, products, activity fields).
export async function loadLists(force = false) {
  if (cache && !force) return cache;
  const [users, statuses, types, products, fields] = await Promise.all(
    ['task_users', 'task_statuses', 'task_types', 'products', 'activity_fields'].map((t) => api.listRows(t)));
  cache = { users, statuses, types, products, fields };
  return cache;
}
export const resetLists = () => { cache = null; };

export async function getAccounts(force = false) {
  if (accountsCache && !force) return accountsCache;
  accountsCache = await api.accountNames();
  return accountsCache;
}
export const resetAccounts = () => { accountsCache = null; };
