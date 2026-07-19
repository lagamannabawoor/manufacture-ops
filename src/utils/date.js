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
