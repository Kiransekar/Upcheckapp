/**
 * ReportData -> CSV.
 *
 * Escaping is `src/utils/csv.ts` and nothing else — a second escaper is a
 * second place for "Rao, Anita" to shift every column one to the right.
 *
 * A CSV is one grid and a report is several. Each table gets a blank line, a
 * title row and its own header row, which is what a spreadsheet importer (and
 * a farmer scrolling on a phone) reads as "new section".
 */

import { toCsv, type CsvCell } from '../../utils/csv';
import type { ReportData } from './types';

/** One escaped row. `toCsv` with no body rows is exactly that. */
const line = (cells: CsvCell[]): string => toCsv([], cells);

export const toReportCsv = (data: ReportData): string => {
    const { meta } = data;
    const blocks: string[] = [];

    blocks.push(
        [
            meta.documentTitle,
            meta.farmName,
            meta.pondName,
            meta.cycleLabel,
            meta.periodLabel,
            meta.generatedAt,
        ]
            .filter((v): v is string => !!v)
            .map((v) => line([v]))
            .join('\n'),
    );

    if (data.stats.length) {
        blocks.push(data.stats.map((s) => line([s.label, s.value, s.hint])).join('\n'));
    }

    for (const table of data.tables) {
        blocks.push(
            [
                line([table.title]),
                toCsv([...table.rows, ...(table.total ? [table.total] : [])], table.columns),
            ].join('\n'),
        );
    }

    blocks.push([line([meta.attribution]), line([data.disclaimer])].join('\n'));

    return blocks.join('\n\n');
};

export default toReportCsv;
