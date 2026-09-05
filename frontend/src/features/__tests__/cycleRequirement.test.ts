import { requiresActiveCycle } from '../cycleRequirement';

/**
 * The Getting Started checklist on Today offered "Log your first reading",
 * which opened QuickLog, which routed to any log form even for a pond with no
 * cycle. Feed, sampling and measurement rows all carry a NULLABLE crop_id, so
 * those saves succeeded and were then silently excluded from FCR, ABW, growth
 * and cycle P&L — a success toast for a record that never counts.
 */
describe('requiresActiveCycle', () => {
    it.each([
        'FeedLog',
        'SamplingLog',
        'Measurements',
        'DailyRoutine',
        'HarvestLog',
        'FeedingTrayChecks',
        'MortalityLog',
    ])('gates %s, which writes against a crop', (route) => {
        expect(requiresActiveCycle(route)).toBe(true);
    });

    /**
     * Weekly chemistry LOOKS crop-shaped and is not: it saves
     * `{ entity: 'water_quality', payload: { pondId } }`, a pond-level row.
     * It was once listed as `WeeklyChemLog`, a route name that does not exist
     * — the navigator registers `WeeklyChemistry` — so the entry gated nothing
     * while reading as though it did.
     */
    it('does not gate weekly chemistry, which saves a pond-level water-quality row', () => {
        expect(requiresActiveCycle('WeeklyChemistry')).toBe(false);
    });

    /** Guards the rename: a route name in the set that nothing navigates to is dead. */
    it('has no entry for the non-existent WeeklyChemLog route', () => {
        expect(requiresActiveCycle('WeeklyChemLog')).toBe(false);
    });

    /**
     * water_quality_records has no crop column at all — only pond_id. A reading
     * belongs to the pond and is complete on its own, and chemistry BETWEEN
     * cycles is what tells a farmer whether the pond is fit to stock. Gating it
     * would remove a real capability to fix a bug it does not have.
     */
    it('does not gate water quality, which is pond-level and has no crop column', () => {
        expect(requiresActiveCycle('WaterQualityLog')).toBe(false);
    });

    it('does not gate pure navigation', () => {
        expect(requiresActiveCycle('PondDashboard')).toBe(false);
    });

    /**
     * Defaulting to allowed is deliberate: a new pond-level log type must not
     * become silently unreachable because nobody updated the list.
     */
    it('allows an unknown route rather than locking it out by omission', () => {
        expect(requiresActiveCycle('SomeFutureLog')).toBe(false);
    });
});
