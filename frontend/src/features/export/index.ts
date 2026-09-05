/**
 * The one function the Export screen calls.
 *
 *   collect -> render -> deliver
 *
 * Each step is a separate module and each is testable on its own; this file is
 * only the wiring and the error vocabulary. It categorises failures so the UI
 * can say "we could not reach the server" or "there is nothing in this range"
 * instead of showing a farmer a stack trace.
 *
 * Nothing here reports what was exported. The FACT of an export is analytics;
 * its contents — money, harvest weights, buyer names — never are.
 */

import * as Print from 'expo-print';

import i18n from '../../i18n';
import { collectReport } from './collect';
import { toReportCsv } from './csv';
import { toReportXlsxBase64 } from './xlsx';
import { deliver, safeFilename } from './deliver';
import { renderReportHtml } from './pdf/renderReportHtml';
import type { ExportConfig, ExportResult, ReportData } from './types';

export type ExportErrorCode =
    | 'missing-scope'   // the config named no farm/pond/crop to export
    | 'no-data'         // the range is real, there is simply nothing in it
    | 'network'         // could not reach the server
    | 'render'          // the document could not be built
    | 'write';          // the file could not be written or shared

export class ExportError extends Error {
    readonly code: ExportErrorCode;
    readonly cause?: unknown;

    constructor(code: ExportErrorCode, message: string, cause?: unknown) {
        super(message);
        this.name = 'ExportError';
        this.code = code;
        this.cause = cause;
    }
}

const isNetwork = (e: unknown): boolean => {
    const err = e as { code?: string; message?: string; response?: unknown } | null;
    if (!err) return false;
    if (err.response) return false; // the server answered; that is not a network fault
    return err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || /network/i.test(err.message ?? '');
};

const today = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const render = async (data: ReportData, config: ExportConfig, filename: string): Promise<ExportResult> => {
    if (config.format === 'pdf') {
        const { uri } = await Print.printToFileAsync({ html: renderReportHtml(data, config.language) });
        return deliver({ filename, format: 'pdf', sourceUri: uri, dialogTitle: data.meta.documentTitle });
    }
    if (config.format === 'xlsx') {
        return deliver({
            filename,
            format: 'xlsx',
            content: toReportXlsxBase64(data),
            dialogTitle: data.meta.documentTitle,
        });
    }
    return deliver({
        filename,
        format: 'csv',
        content: toReportCsv(data),
        dialogTitle: data.meta.documentTitle,
    });
};

/**
 * Build, render, write and share one export.
 *
 * Resolves with where the file went. Rejects only with an `ExportError`, so
 * the screen has something to map to a message.
 */
export const runExport = async (config: ExportConfig): Promise<ExportResult> => {
    let data: ReportData;
    try {
        data = await collectReport(config);
    } catch (e) {
        if (isNetwork(e)) throw new ExportError('network', 'Could not reach the server', e);
        if (e instanceof Error && /needs a (farmId|pondId|cropId)/.test(e.message)) {
            throw new ExportError('missing-scope', e.message, e);
        }
        throw new ExportError('render', 'Could not gather the records for this report', e);
    }

    // Every section was empty, or every section was switched off. Producing a
    // file with nothing but a header wastes the farmer's data and their time.
    if (!data.tables.length && !data.stats.length) {
        throw new ExportError('no-data', 'There is nothing to export for this selection');
    }

    const filename = safeFilename(
        [
            i18n.t('common.appName'),
            config.dataset,
            data.meta.farmName ?? data.meta.pondName ?? data.meta.cycleLabel,
            today(),
        ],
        config.format,
    );

    try {
        return await render(data, config, filename);
    } catch (e) {
        throw new ExportError('write', 'Could not save or share the file', e);
    }
};

export { collectReport } from './collect';
export { toReportCsv } from './csv';
export { toReportXlsxBase64 } from './xlsx';
export { deliver, safeFilename } from './deliver';
export * from './types';
export default runExport;
