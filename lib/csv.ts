/** Escape CSV fields and prevent user text from becoming spreadsheet formulas. */
export function escapeCsv(value: string): string {
  const text = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
