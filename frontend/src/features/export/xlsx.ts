/**
 * ReportData -> XLSX (SheetJS), as a base64 string ready for the file writer.
 *
 * Two things Excel is unforgiving about and both are silent failures:
 *  - a sheet name over 31 characters, or containing []:*?/\ , makes Excel
 *    refuse to open the whole workbook — not the sheet, the workbook;
 *  - default column width. Every column at 8 characters wide turns a report
 *    into a grid of ####, and the farmer's first act is to resize 8 columns.
 */

import * as XLSX from 'xlsx';

import type { ReportData, ReportTable } from './types';

const ILLEGAL_SHEET_CHARS = /[[\]:*?/\\]/g;

/** Excel's own rules: ≤31 chars, none of []:*?/\ , never blank. */
export const safeSheetName = (name: string, taken: Set<string>): string => {
    const base = (name.replace(ILLEGAL_SHEET_CHARS, ' ').replace(/\s+/g, ' ').trim() || 'Sheet').slice(0, 31);
    let candidate = base;
    // Duplicate names are the other way a workbook fails to open, and two
    // tables can legitimately share a title once truncated.
    for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
        const suffix = ` (${n})`;
        candidate = base.slice(0, 31 - suffix.length) + suffix;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
};

/** Widths from the content, clamped so nothing is a ### column or a mile wide. */
export const columnWidths = (rows: string[][]): { wch: number }[] => {
    const widths: number[] = [];
    for (const row of rows) {
        row.forEach((cell, i) => {
            widths[i] = Math.max(widths[i] ?? 0, String(cell ?? '').length);
        });
    }
    return widths.map((w) => ({ wch: Math.min(50, Math.max(10, w + 2)) }));
};

const sheetFromGrid = (grid: string[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    sheet['!cols'] = columnWidths(grid);
    return sheet;
};

const tableGrid = (table: ReportTable): string[][] => [
    [table.title],
    table.columns,
    ...table.rows,
    ...(table.total ? [table.total] : []),
];

const summaryGrid = (data: ReportData): string[][] => {
    const { meta } = data;
    const rows: string[][] = [[meta.documentTitle]];
    const pair = (label: string, value?: string) => {
        if (value) rows.push([label, value]);
    };
    pair('Farm', meta.farmName);
    pair('Pond', meta.pondName);
    pair('Cycle', meta.cycleLabel);
    pair('Period', meta.periodLabel);
    pair('Generated', meta.generatedAt);
    if (data.stats.length) {
        rows.push([]);
        for (const s of data.stats) rows.push([s.label, s.value, s.hint ?? '']);
    }
    rows.push([], [meta.attribution], [data.disclaimer]);
    return rows;
};

/** The whole workbook, base64-encoded — see deliver.ts for why base64. */
export const toReportXlsxBase64 = (data: ReportData): string => {
    const book = XLSX.utils.book_new();
    const taken = new Set<string>();

    XLSX.utils.book_append_sheet(book, sheetFromGrid(summaryGrid(data)), safeSheetName('Summary', taken));
    for (const table of data.tables) {
        XLSX.utils.book_append_sheet(book, sheetFromGrid(tableGrid(table)), safeSheetName(table.title, taken));
    }

    return XLSX.write(book, { bookType: 'xlsx', type: 'base64' }) as string;
};

export default toReportXlsxBase64;
