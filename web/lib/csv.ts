/** One CSV row. Cells that a spreadsheet would run as a formula are made inert. */
export function csvRow(cells: (string | number | null)[]): string {
  return cells
    .map((cell) => {
      let text = cell == null ? "" : String(cell);
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(",");
}
