// Builds the plain-text account summary used by the "copy summary" button. Pure function (no DOM / network).
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

export function buildSummary({ account, contacts, opps, timeline, label, formatDate, formatDateTime }) {
  const L = [];
  L.push(`${account.name} (${account.code})`);
  const place = [account.city, account.district, account.address].filter(Boolean).join('، ');
  if (place) L.push(place);
  if (account.landline) L.push(`تلفن: ${account.landline}`);
  if (account.software) L.push(`نرم‌افزار: ${account.software}`);
  if (contacts.length) {
    L.push('', 'کانتکت‌ها:');
    for (const c of contacts) {
      const p = c.contacts || {};
      L.push('- ' + [p.name, p.mobile, label('contact_role', c.role), c.is_primary ? 'اصلی' : ''].filter(Boolean).join(' | '));
    }
  }
  if (opps.length) {
    L.push('', 'فرصت‌ها:');
    for (const o of opps) {
      const reason = o.stage === 'Pending' ? label('pending_reason', o.stage_reason) : o.stage === 'Lost' ? label('lost_reason', o.stage_reason) : '';
      const next = o.next_step_date ? `قدم بعدی: ${formatDate(o.next_step_date)}${o.next_step_text ? ' ' + o.next_step_text : ''}` : '';
      L.push('- ' + [o.product_name, o.stage, reason, next].filter(Boolean).join(' | '));
    }
  }
  const last = timeline.slice(-5);
  if (last.length) {
    L.push('', 'آخرین اقدام‌ها:');
    for (const t of last) {
      const kind = t.source === 'پشتیبانی' ? label('support_result', t.result) : [label('activity_type', t.type), label('activity_result', t.result)].filter(Boolean).join(' - ');
      L.push('- ' + [formatDateTime(t.occurred_at), t.source, kind, clip(t.note, 80)].filter(Boolean).join(' | '));
    }
  }
  return L.join('\n');
}
