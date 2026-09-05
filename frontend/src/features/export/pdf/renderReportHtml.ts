/**
 * ReportData -> a complete, self-contained HTML document for `expo-print`.
 *
 * Pure function. No `t()`, no Date, no number formatting — `ReportData` arrives
 * already formatted and already translated (see ../types.ts). That is what makes
 * this file testable against a fixture and safe to change.
 *
 * Everything is inline: no external stylesheet, no webfont, no network image.
 * `expo-print` renders offline and a farmer may have no signal.
 */
import type { ReportData, ReportStat, ReportTable } from '../types';

/**
 * The single escape hatch. EVERY interpolated value goes through this — farm
 * names, pond names and free-text notes are typed by farmers, so an unescaped
 * `&` corrupts the document and a farm named `<script>` must be inert.
 * Quotes are escaped too: cheap, and it means this is still correct the day
 * someone interpolates into an attribute.
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Font stack, widest-net first for Latin then one Noto family per Indic script.
 * CSS falls back per glyph, so listing all six scripts means a Tamil report on a
 * device with only Devanagari still renders the Latin numerals correctly and
 * degrades to the system default for the rest. Noto* are the Android system
 * families; the Apple names cover iOS. Ends in `sans-serif` so the Android PDF
 * renderer always has something.
 */
const FONT_STACK = [
    '-apple-system',
    "'Helvetica Neue'",
    'Roboto',
    "'Noto Sans'",
    "'Noto Sans Devanagari'",
    "'Noto Sans Bengali'",
    "'Noto Sans Tamil'",
    "'Noto Sans Telugu'",
    "'Noto Sans Oriya'",
    "'Kohinoor Devanagari'",
    "'Kohinoor Bangla'",
    "'Tamil Sangam MN'",
    "'Telugu Sangam MN'",
    'sans-serif',
].join(', ');

/* Palette hardcoded from src/theme/colorRoles.ts — the PDF cannot import it. */
const CSS = `
@page { size: A4; margin: 14mm 12mm 20mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${FONT_STACK};
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1A222B;
  background: #FFFFFF;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  padding-bottom: 18mm; /* room for the fixed footer */
}

/* ---- header ---- */
.hdr { border-bottom: 2px solid #0B6DC7; padding-bottom: 8px; margin-bottom: 14px; }
.brand { font-size: 17pt; font-weight: 700; color: #0B6DC7; letter-spacing: 0.4px; }
.brand .dot { color: #0EA8D8; }
.doc-title { font-size: 14pt; font-weight: 700; margin: 6px 0 2px; }
.subject { font-size: 10.5pt; color: #3E5163; }
.hdr-meta { font-size: 8.5pt; color: #5C6F7E; margin-top: 4px; }

/* ---- summary cards ---- */
.stats { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 0 16px; page-break-inside: avoid; }
.stats td {
  border: 1px solid #E0E8EC; background: #F5F8FA; border-radius: 4px;
  padding: 8px 10px; vertical-align: top; overflow-wrap: anywhere;
}
.stat-label { font-size: 8pt; color: #5C6F7E; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-value { font-size: 14pt; font-weight: 700; color: #1A222B; margin-top: 2px; }
.stat-hint { font-size: 8pt; color: #5C6F7E; margin-top: 1px; }

/* ---- tables ---- */
.section { margin-bottom: 16px; }
h2 {
  font-size: 11.5pt; margin: 0 0 6px; color: #0B6DC7;
  page-break-after: avoid; break-after: avoid;
}
table.data { width: 100%; border-collapse: collapse; table-layout: fixed; }
/* THE rule: without table-header-group a table spanning three pages has headers
   only on the first, which is a report nobody can read. */
table.data thead { display: table-header-group; }
table.data tfoot { display: table-footer-group; }
table.data tr, table.data td, table.data th { page-break-inside: avoid; break-inside: avoid; }
table.data th {
  background: #EEF2F5; color: #3E5163; font-size: 8.5pt; font-weight: 700;
  text-align: left; text-transform: uppercase; letter-spacing: 0.3px;
  border-bottom: 1.5px solid #C8D4DA; padding: 5px 6px;
}
table.data td {
  border-bottom: 1px solid #E0E8EC; padding: 5px 6px; vertical-align: top;
  font-size: 9.5pt; overflow-wrap: anywhere; word-wrap: break-word;
}
table.data tbody tr:nth-child(even) td { background: #F5F8FA; }
table.data .num { text-align: right; }
table.data tr.total td {
  background: #EBF4FD; font-weight: 700; color: #0B4F8A;
  border-top: 1.5px solid #C8D4DA; border-bottom: 1.5px solid #C8D4DA;
}
td.empty { text-align: center; color: #5C6F7E; font-style: italic; padding: 12px 6px; }

/* ---- footer, repeated on every page ---- */
.ftr {
  position: fixed; left: 0; right: 0; bottom: 0;
  border-top: 1px solid #E0E8EC; padding-top: 4px;
  font-size: 7.5pt; color: #5C6F7E; line-height: 1.35;
}
.ftr .attr { font-weight: 700; color: #3E5163; }
`;

const cell = (value: string, numeric: boolean, tag: 'td' | 'th' = 'td'): string =>
    `<${tag}${numeric ? ' class="num"' : ''}>${escapeHtml(value)}</${tag}>`;

function renderStats(stats: ReportStat[]): string {
    if (!stats.length) return '';
    // Cards wrap to a new row every four so eight stats do not shrink to slivers.
    const rows: ReportStat[][] = [];
    for (let i = 0; i < stats.length; i += 4) rows.push(stats.slice(i, i + 4));
    const width = `${(100 / Math.min(stats.length, 4)).toFixed(2)}%`;
    return `<table class="stats"><tbody>${rows
        .map(
            (row) =>
                `<tr>${row
                    .map(
                        (s) =>
                            `<td style="width:${width}">` +
                            `<div class="stat-label">${escapeHtml(s.label)}</div>` +
                            `<div class="stat-value">${escapeHtml(s.value)}</div>` +
                            (s.hint ? `<div class="stat-hint">${escapeHtml(s.hint)}</div>` : '') +
                            `</td>`,
                    )
                    .join('')}</tr>`,
        )
        .join('')}</tbody></table>`;
}

function renderTable(table: ReportTable): string {
    const numeric = new Set(table.numericColumns ?? []);
    const colCount = Math.max(table.columns.length, 1);

    const head = `<thead><tr>${table.columns
        .map((c, i) => cell(c, numeric.has(i), 'th'))
        .join('')}</tr></thead>`;

    const body = table.rows.length
        ? table.rows
              .map(
                  (row) =>
                      `<tr>${row.map((v, i) => cell(v, numeric.has(i))).join('')}</tr>`,
              )
              .join('')
        : // Explicit empty state, not a headerless husk. An em dash needs no
          // translation, and ReportData carries no string for this.
          `<tr><td class="empty" colspan="${colCount}">&mdash;</td></tr>`;

    const foot = table.total
        ? `<tfoot><tr class="total">${table.total
              .map((v, i) => cell(v, numeric.has(i)))
              .join('')}</tr></tfoot>`
        : '';

    return (
        `<section class="section">` +
        `<h2>${escapeHtml(table.title)}</h2>` +
        `<table class="data">${head}${foot}<tbody>${body}</tbody></table>` +
        `</section>`
    );
}

/**
 * @param lang BCP-47 tag for the document (`ExportConfig.language`). Defaults to
 *   English so the one-argument call in the contract stays valid.
 */
export function renderReportHtml(data: ReportData, lang = 'en'): string {
    const { meta } = data;
    // Subject line: farm / pond / cycle, whichever the report actually has.
    const subject = [meta.farmName, meta.pondName, meta.cycleLabel]
        .filter(Boolean)
        .map((s) => escapeHtml(s))
        .join(' &middot; ');
    const headMeta = [meta.periodLabel, meta.generatedAt]
        .filter(Boolean)
        .map((s) => escapeHtml(s))
        .join(' &middot; ');

    return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.documentTitle)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="hdr">
<div class="brand">Neerani<span class="dot">.</span></div>
<div class="doc-title">${escapeHtml(meta.documentTitle)}</div>
${subject ? `<div class="subject">${subject}</div>` : ''}
${headMeta ? `<div class="hdr-meta">${headMeta}</div>` : ''}
</header>
${renderStats(data.stats)}
${data.tables.map(renderTable).join('\n')}
<footer class="ftr">
<div class="attr">${escapeHtml(meta.attribution)}</div>
<div>${escapeHtml(data.disclaimer)}</div>
</footer>
</body>
</html>`;
}
