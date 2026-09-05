/**
 * Startup budget, in one log line.
 *
 * The farmer's report was "the first screens after a fresh reinstall are very
 * slow" and there was no number anywhere to argue with. This is the number.
 * It is deliberately permanent and release-safe (plain `console.log`, no dev
 * guard, no dependency) so the budget can be re-checked on any build — a
 * one-off profiling script would have told us nothing the next time.
 *
 * WHAT t0 IS, precisely: the moment this module is evaluated. It is the FIRST
 * import in App.tsx, so t0 ≈ the start of app-code evaluation. It does NOT
 * include native process start, Hermes bytecode load, or the RN bridge coming
 * up — those happen before any JS of ours runs and cannot be read from here.
 * So treat the numbers as "time spent in our JS", not "time since the icon tap".
 *
 * Usage: `mark('fonts')` at each milestone. The line is printed once, when the
 * final milestone (`FINAL_MARK`) arrives; later marks print on their own.
 */

const t0 = Date.now();

/** Printing is triggered by this milestone — the first screen the farmer sees. */
const FINAL_MARK = 'nav-ready';

const marks: string[] = [];
let flushed = false;

export function mark(name: string): void {
    const ms = Date.now() - t0;
    if (flushed) {
        console.log(`[startup] +${ms}ms ${name}`);
        return;
    }
    marks.push(`${name}=${ms}ms`);
    if (name === FINAL_MARK) {
        flushed = true;
        console.log(`[startup] ${marks.join(' ')} (from first app-code eval)`);
    }
}

/** Test seam: the marks recorded so far, in order. */
export const recordedMarks = (): readonly string[] => marks;
