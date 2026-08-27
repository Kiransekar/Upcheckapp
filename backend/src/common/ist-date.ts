/**
 * Calendar-day bucketing for reports/plans (DATE-1).
 *
 * The app's canonical day boundary is the farm's LOCAL day — IST (UTC+5:30, no
 * DST) for launch. Deriving the day with `toISOString().split('T')[0]` buckets
 * in UTC, so anything logged before 05:30 IST lands on the previous calendar
 * day (the classic pre-dawn DO reading). Shifting by the fixed IST offset before
 * taking the date portion fixes that.
 *
 * ponytail: hard-coded +5:30. When the app goes multi-timezone, pass the farm's
 * offset/zone instead of assuming IST.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for the given instant in IST-local time. */
export function toIstDateString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().split('T')[0];
}

/**
 * The UTC instants bounding one IST calendar day, for `Between(...)` filters.
 *
 * The naive version of this — `new Date(\`${date}T00:00:00Z\`)` to
 * `\`${date}T23:59:59.999Z\`` — buckets in UTC while the caller passed a LOCAL
 * date, which silently drops everything logged between 00:00 and 05:30 IST onto
 * the previous day. Attendance is exactly where that hurts: a farm's shift
 * starts around 05:00, so the early arrivals were the ones going missing from
 * "who is in today".
 */
export function istDayRangeUtc(date: string): { start: Date; end: Date } {
  // 00:00 IST on `date` is 18:30 UTC on the previous day.
  const start = new Date(
    new Date(`${date}T00:00:00.000Z`).getTime() - IST_OFFSET_MS,
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
