/** Always returns DD/MM/YYYY regardless of device locale */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** Returns today as YYYY-MM-DD (for input[type=date] value) */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns { from, to } for the current calendar month */
export function monthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}
