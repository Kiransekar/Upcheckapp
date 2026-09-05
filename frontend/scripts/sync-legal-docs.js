/**
 * Regenerates docs/legal/*.md from src/legal/content.ts.
 *
 * The in-app screens and the publicly hosted documents must say the same thing:
 * a privacy policy that differs between the app and the website is worse than
 * having only one, because it is impossible to say which one the user agreed
 * to. content.ts is the source; these files are output.
 *
 * Usage:  node scripts/sync-legal-docs.js          (writes)
 *         node scripts/sync-legal-docs.js --check  (exits 1 if out of date)
 */
const fs = require('fs');
const path = require('path');

// content.ts is plain data with no runtime deps, so strip the types and eval it
// rather than dragging ts-node into a script this small.
const SRC = path.join(__dirname, '..', 'src', 'legal', 'content.ts');
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'legal');

function load() {
    const ts = fs.readFileSync(SRC, 'utf8');
    const js = ts
        .replace(/export interface[\s\S]*?\n}\n/g, '')
        .replace(/export const/g, 'const')
        .replace(/: LegalBlock\[\]/g, '')
        .concat('\nmodule.exports = { LEGAL_META, PRIVACY_POLICY, TERMS };');
    const m = { exports: {} };
    new Function('module', 'exports', js)(m, m.exports);
    return m.exports;
}

const render = (title, blocks, meta) =>
    `<!-- GENERATED FROM frontend/src/legal/content.ts — DO NOT EDIT BY HAND.\n` +
    `     Run: node scripts/sync-legal-docs.js  (from frontend/) -->\n\n` +
    `# ${title}\n\n**${meta.company}**\n\n` +
    blocks
        .map((b) => (b.heading ? `## ${b.heading}\n\n${b.text}` : b.text))
        .join('\n\n') +
    '\n';

function main() {
    const { LEGAL_META, PRIVACY_POLICY, TERMS } = load();
    const files = [
        ['PRIVACY_POLICY.md', render('Privacy Policy', PRIVACY_POLICY, LEGAL_META)],
        ['TERMS_AND_CONDITIONS.md', render('Terms of Service', TERMS, LEGAL_META)],
    ];
    const check = process.argv.includes('--check');
    let stale = [];

    for (const [name, body] of files) {
        const dest = path.join(OUT_DIR, name);
        const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
        // Compare normalised, so a CRLF checkout is not reported as a drift.
        if (current && current.replace(/\r\n/g, '\n') === body) continue;
        if (check) stale.push(name);
        else {
            fs.writeFileSync(dest, body);
            console.log('wrote docs/legal/' + name);
        }
    }

    if (check && stale.length) {
        console.error('Out of date with src/legal/content.ts: ' + stale.join(', '));
        console.error('Run: node scripts/sync-legal-docs.js');
        process.exit(1);
    }
    if (check) console.log('legal docs in sync');
}

main();
