/**
 * The whole of the recurrence "engine". Two rule shapes, no library.
 *
 *   FREQ=DAILY
 *   FREQ=WEEKLY;BYDAY=<0-6>     (0 = Sunday, matching Date#getUTCDay)
 *
 * Dates are plain 'YYYY-MM-DD' strings in UTC. There is no per-farm timezone
 * anywhere in this backend, so "today" is UTC today — the same assumption every
 * other dated record in the app already makes.
 *
 * ponytail: no RRULE parser, no COUNT, no INTERVAL. Add one when a farmer asks
 * for "every third Tuesday"; until then this is the whole feature.
 */

export interface RecurrenceInput {
  freq: 'daily' | 'weekly';
  byWeekday?: number;
  until?: string;
}

export function buildRecurrenceRule(r: RecurrenceInput): string {
  if (r.freq === 'weekly') {
    return r.byWeekday === undefined
      ? 'FREQ=WEEKLY'
      : `FREQ=WEEKLY;BYDAY=${r.byWeekday}`;
  }
  return 'FREQ=DAILY';
}

/** 'YYYY-MM-DD' for a Date, or for today when called with nothing. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** `days` after (or, negative, before) an ISO date. */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Does a template's rule fire on this date? Unknown/absent rules never fire. */
export function ruleFiresOn(rule: string | null, iso: string): boolean {
  const parts = new Map(
    (rule ?? '')
      .split(';')
      .filter(Boolean)
      .map((p) => p.split('=') as [string, string]),
  );
  const freq = parts.get('FREQ');
  if (freq === 'DAILY') return true;
  if (freq !== 'WEEKLY') return false;
  const byDay = parts.get('BYDAY');
  if (byDay === undefined) return true;
  return Number(byDay) === new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * The dates a template owes instances for, oldest first.
 *
 * Bounded on BOTH ends and hard-capped: a template created two years ago must
 * not backfill 700 rows the first time someone opens the app. It starts at the
 * later of (template creation date, today − windowDays) and stops at today or
 * `until`, whichever is earlier.
 */
export function dueDatesFor(opts: {
  rule: string | null;
  startedOn: string;
  until: string | null;
  today: string;
  windowDays: number;
}): string[] {
  const from =
    opts.startedOn > shiftDate(opts.today, -opts.windowDays)
      ? opts.startedOn
      : shiftDate(opts.today, -opts.windowDays);
  const to =
    opts.until && opts.until < opts.today ? opts.until : opts.today;

  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    if (ruleFiresOn(opts.rule, d)) out.push(d);
    if (out.length > opts.windowDays + 1) break; // paranoia; the loop is bounded
  }
  return out;
}
