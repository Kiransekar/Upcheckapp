/**
 * The in-app legal copy and the publicly hosted markdown must be the same text.
 * If they drift it becomes impossible to say which version a user agreed to, so
 * this fails the build rather than letting the two quietly diverge.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';

describe('legal documents', () => {
    it('docs/legal/*.md match src/legal/content.ts', () => {
        const script = path.join(__dirname, '..', '..', '..', 'scripts', 'sync-legal-docs.js');
        expect(() =>
            execFileSync('node', [script, '--check'], { stdio: 'pipe' }),
        ).not.toThrow();
    });
});
