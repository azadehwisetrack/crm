// Same rule as the database trigger (rule 5): #won / #وان or #lost / #لاست, text after the tag is the reason.
export function parseTag(note) {
  const m = /#(won|lost|وان|لاست)(?:[\s.,،;:!]+([\s\S]*))?$/i.exec(String(note || ''));
  if (!m) return null;
  const reason = (m[2] || '').trim();
  return { kind: ['won', 'وان'].includes(m[1].toLowerCase()) ? 'won' : 'lost', reason: reason || null };
}
