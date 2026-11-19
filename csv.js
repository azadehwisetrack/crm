// CSV with UTF-8 BOM (opens correctly in Excel with Persian text). CRLF line ends.
export function csvCell(v) {
  if (v == null) return '';
  let s;
  if (Array.isArray(v)) s = v.join(';');
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  // Neutralize spreadsheet formulas in text cells (=, +, -, @ at the start).
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
