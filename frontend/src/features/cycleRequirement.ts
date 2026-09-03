/**
 * Which log types are meaningless without an active crop cycle.
 *
 * The Getting Started checklist on Today offered "Log your first reading",
 * which opened QuickLog, which happily routed to any log form for a pond with
 * no cycle at all. Nothing rejected the save, so it looked like it worked.
 *
 * It did not. `feed_records.crop_id`, `sampling_data.crop_id` and
 * `measurements.crop_id` are all NULLABLE, and every figure a farmer actually
 * cares about — FCR, ABW, growth curve, cycle P&L — is computed per CROP. A
 * record saved with a null crop is accepted, stored, and then silently
 * excluded from all of it. The farmer sees a success toast and their feed
 * never counts. That is worse than a refusal, because there is nothing to
 * notice.
 *
 * Water quality is genuinely different: `water_quality_records` has no crop
 * column at all (only `pond_id`), so a reading belongs to the POND and is
 * complete on its own. Pond water chemistry matters between cycles too — it
 * is what tells a farmer whether the pond is fit to stock. Gating it would
 * remove a real capability to fix a bug it does not have.
 *
 * This is the single definition, so the pond dashboard's action grid and
 * QuickLog cannot drift apart — the same mistake `logProgress.ts` exists to
 * prevent for "done".
 */

/** Log routes that write a row keyed to a crop, and are useless without one. */
const REQUIRES_ACTIVE_CYCLE = new Set([
    'FeedLog',          // feed_records.crop_id → FCR, cycle feed totals
    'SamplingLog',      // sampling_data.crop_id → ABW, survival, growth curve
    'Measurements',     // measurements.crop_id → per-crop trend charts
    'DailyRoutine',     // writes tray checks against cropId
    'HarvestLog',       // cropId is REQUIRED by the DTO — a save would 400
    'FeedingTrayChecks', // route params type cropId as REQUIRED
    'MortalityLog',     // mortality.crop_id is NOT NULL — a save would fail
]);

/*
 * Two entries that look like they belong here and do not:
 *
 * `WeeklyChemistry` writes `{ entity: 'water_quality', payload: { pondId } }`
 * (WeeklyChemistryScreen.tsx:47-59) — a pond-level row with no crop, same as
 * any other water-quality reading. It was briefly listed here as
 * `WeeklyChemLog`, which matched no registered route at all, so it gated
 * nothing either way.
 *
 * The remaining log types (Treatment, Disease, Chemical, Plankton,
 * Microbiology) fall through to allowed and are believed pond-level. If one of
 * them turns out to carry a nullable crop_id, add it — the failure mode is the
 * silent one described above, so it is worth checking before assuming.
 */

/**
 * True if this destination needs the pond to have an active cycle.
 *
 * Everything not listed is allowed without one — notably WaterQualityLog
 * (pond-level, see above) and any pure navigation target such as
 * PondDashboard. Defaulting to ALLOWED is deliberate: a new pond-level log
 * type should not become silently unreachable because someone forgot to
 * update a list.
 */
export const requiresActiveCycle = (route: string): boolean =>
    REQUIRES_ACTIVE_CYCLE.has(route);
