// Text for pasting the day plan into a messenger: one line per item, empty fields omitted (no double separators).
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function buildPlanText({ dateText, rows }) {
  const lines = [`📅 برنامه ${dateText}`];
  for (const r of rows) {
    lines.push([r.account_name, r.contact_name, r.contact_mobile, r.address, r.next_step_text].map(clean).filter(Boolean).join(' | '));
  }
  return lines.join('\n');
}
