import { api } from './api.js';
import { toCsv } from './csv.js';
import { makeZip } from './zip.js';
import { todayTehran } from './jalali.js';

export const BACKUP_KEY = 'crm_last_backup_at';

export const TABLES = [
  { name: 'accounts', order: ['id'], columns: ['id', 'code', 'name', 'landline', 'city', 'district', 'address', 'field_id', 'status', 'created_at', 'updated_at'] },
  { name: 'contacts', order: ['id'], columns: ['id', 'code', 'first_name', 'last_name', 'mobile', 'mobile2', 'job_title', 'note', 'status', 'created_at', 'updated_at'] },
  { name: 'account_contacts', order: ['account_id', 'contact_id'], columns: ['account_id', 'contact_id', 'role', 'is_primary', 'status'] },
  { name: 'opportunities', order: ['id'], columns: ['id', 'account_id', 'product_id', 'stage', 'opened_at', 'closed_at', 'updated_at'] },
  { name: 'tasks', order: ['id'], columns: ['id', 'account_id', 'person_id', 'description', 'due_date', 'due_time', 'type_id', 'user_id', 'status_id', 'created_at', 'created_by', 'updated_at'] },
  { name: 'products', order: ['id'], columns: ['id', 'code', 'name', 'active'] },
  { name: 'task_users', order: ['id'], columns: ['id', 'name'] },
  { name: 'task_types', order: ['id'], columns: ['id', 'name', 'sort', 'kind'] },
  { name: 'task_statuses', order: ['id'], columns: ['id', 'name', 'sort', 'kind'] },
  { name: 'activity_fields', order: ['id'], columns: ['id', 'name'] },
];

async function fetchAll(t) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await api.exportPage(t.name, t.columns, t.order, from);
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

// One CSV per table inside one ZIP (avoids the browser's "multiple downloads" prompt).
export async function buildBackup(onProgress = () => {}) {
  const enc = new TextEncoder();
  const files = [], counts = {};
  for (const t of TABLES) {
    onProgress(`دریافت ${t.name}…`);
    const rows = await fetchAll(t);
    counts[t.name] = rows.length;
    files.push({ name: `${t.name}.csv`, data: enc.encode(toCsv(rows, t.columns)) });
  }
  return { blob: makeZip(files), filename: `crm-backup-${todayTehran()}.zip`, counts };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const markBackupDone = () => { try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch { /* storage may be blocked */ } };
export function lastBackup() { try { return localStorage.getItem(BACKUP_KEY); } catch { return null; } }
