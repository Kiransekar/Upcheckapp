/**
 * CSV for the share sheet.
 *
 * Two screens now export ("give me this so I can pay someone", "give me what
 * happened on this farm last month"), and the escaping is the only part that
 * is easy to get wrong: a worker called "Rao, Anita", a note with a line break
 * in it, or a missing check-out all break a naive `join(',')` — silently, into
 * a spreadsheet that looks fine and has the columns shifted.
 *
 * RFC 4180: a cell containing a quote, a comma or a newline is wrapped in
 * quotes and its own quotes are doubled. Everything else goes out bare.
 * `null`/`undefined` is an empty cell, not the string "null".
 */

export type CsvCell = string | number | null | undefined;

const cell = (v: CsvCell): string => {
    if (v == null) return '';
    const s = String(v);
    return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** `headings` first, then one line per row. Rows are cells in column order. */
export const toCsv = (rows: CsvCell[][], headings: CsvCell[]): string =>
    [headings, ...rows].map((r) => r.map(cell).join(',')).join('\n');

export default toCsv;
