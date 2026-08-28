// The farm card's three numbers and its strip of coloured bars all come from
// here. If this ranks wrong, the Farms screen points a farmer at the wrong farm
// — so the ordering and the fallow rule are what these tests pin.
import {
    healthOf,
    severityByPond,
    sortByHealth,
    rollUpFarm,
    buildPondRows,
    mergeBriefings,
    type PondWithHealth,
} from '../pondHealth';
import type { Pond } from '../../api/ponds';
import type { BriefingItem } from '../../api/alertCenter';
import type { PondContext } from '../../api/pondContext';

const pond = (over: Partial<Pond> = {}): Pond =>
    ({
        id: 'p1',
        farmId: 'f1',
        name: 'Pond 01',
        status: 'active',
        activeCycleId: 'c1',
        createdAt: '',
        updatedAt: '',
        ...over,
    }) as Pond;

const brief = (over: Partial<BriefingItem> = {}): BriefingItem => ({
    pondId: 'p1',
    topTitle: 'Oxygen below 3',
    topSeverity: 'critical',
    source: 'engine',
    steps: [],
    alertCount: 1,
    ...over,
});

const ctx = (over: Partial<PondContext> = {}): PondContext =>
    ({ pondId: 'p1', biomassKg: 100, ...over }) as PondContext;

describe('healthOf', () => {
    it('reads a pond with no cycle as fallow, whatever the alerts say', () => {
        // A stale critical on an emptied pond must not keep the farm red.
        expect(healthOf(pond({ activeCycleId: null }), 'critical')).toBe('fallow');
    });

    it('does NOT call a stocked pond fallow just because status says so', () => {
        // The reported bug. The backend set activeCycleId when a cycle started
        // but left status at 'fallow', so a running cycle showed as an empty
        // pond on Farms, on Ponds and on the pond page — each of them offering
        // "Start a cycle" for a pond that already had one. activeCycleId is the
        // fact; status was the stale copy of it.
        expect(healthOf({ status: 'fallow', activeCycleId: 'c1' } as any, null)).toBe('fine');
        expect(healthOf({ status: 'fallow', activeCycleId: 'c1' } as any, 'critical')).toBe(
            'critical',
        );
    });

    it('maps engine severity onto the four states', () => {
        expect(healthOf(pond(), 'critical')).toBe('critical');
        expect(healthOf(pond(), 'watch')).toBe('watch');
        expect(healthOf(pond(), 'info')).toBe('fine');
        expect(healthOf(pond(), null)).toBe('fine');
    });

    it('treats a harvesting pond as stocked, not empty', () => {
        expect(healthOf(pond({ status: 'harvesting' }), 'watch')).toBe('watch');
    });
});

describe('severityByPond', () => {
    it('keeps the worst severity when a pond has several alerts', () => {
        const map = severityByPond([
            brief({ topSeverity: 'watch' }),
            brief({ topSeverity: 'critical' }),
            brief({ topSeverity: 'info' }),
        ]);
        expect(map.get('p1')).toBe('critical');
    });

    it('ignores farm-level alerts that name no pond', () => {
        expect(severityByPond([brief({ pondId: null })]).size).toBe(0);
    });
});

describe('sortByHealth', () => {
    const row = (id: string, health: PondWithHealth['health'], name = id): PondWithHealth => ({
        pond: pond({ id, name }),
        health,
        reason: null,
        context: null,
    });

    it('puts the worst pond first and fallow last', () => {
        const sorted = sortByHealth([
            row('a', 'fine'),
            row('b', 'fallow'),
            row('c', 'critical'),
            row('d', 'watch'),
        ]);
        expect(sorted.map((r) => r.pond.id)).toEqual(['c', 'd', 'a', 'b']);
    });

    it('breaks ties by name so the order does not shuffle between loads', () => {
        const sorted = sortByHealth([
            row('x', 'fine', 'Pond 09'),
            row('y', 'fine', 'Pond 02'),
        ]);
        expect(sorted.map((r) => r.pond.id)).toEqual(['y', 'x']);
    });

    it('does not mutate the array it was given', () => {
        const input = [row('a', 'fine'), row('c', 'critical')];
        sortByHealth(input);
        expect(input[0].pond.id).toBe('a');
    });
});

describe('rollUpFarm', () => {
    it('counts stocked, act-now and watch, and sums biomass', () => {
        const rows = buildPondRows(
            [
                pond({ id: 'p1' }),
                pond({ id: 'p2' }),
                pond({ id: 'p3' }),
                pond({ id: 'p4', activeCycleId: null, status: 'fallow' }),
            ],
            [ctx({ pondId: 'p1', biomassKg: 412 }), ctx({ pondId: 'p2', biomassKg: 346.4 })],
            [
                brief({ pondId: 'p1', topSeverity: 'critical' }),
                brief({ pondId: 'p2', topSeverity: 'watch' }),
            ],
        );

        const roll = rollUpFarm(rows);
        expect(roll.stocked).toBe(3);
        expect(roll.total).toBe(4);
        expect(roll.actNow).toBe(1);
        expect(roll.watch).toBe(1);
        expect(roll.biomassKg).toBe(758); // 412 + 346.4, rounded
        expect(roll.strip).toEqual(['critical', 'watch', 'fine', 'fallow']);
    });

    it('reports biomass as unknown rather than zero when nothing is sampled', () => {
        // "0 kg" next to a stocked pond is a wrong answer; "—" is an honest one.
        const roll = rollUpFarm(buildPondRows([pond()], [], []));
        expect(roll.biomassKg).toBeNull();
    });

    it('has an empty strip and no biomass for a farm with no ponds', () => {
        const roll = rollUpFarm([]);
        expect(roll).toEqual({
            stocked: 0,
            total: 0,
            biomassKg: null,
            actNow: 0,
            watch: 0,
            strip: [],
        });
    });
});

describe('buildPondRows', () => {
    it('attaches the engine reason only to ponds that need attention', () => {
        const rows = buildPondRows(
            [pond({ id: 'p1' }), pond({ id: 'p2' })],
            [],
            [
                brief({ pondId: 'p1', topSeverity: 'critical', topTitle: 'Oxygen below 3' }),
                brief({ pondId: 'p2', topSeverity: 'info', topTitle: 'Logged an hour ago' }),
            ],
        );
        expect(rows[0].reason).toBe('Oxygen below 3');
        // An info-level note is not a problem to explain on the list.
        expect(rows[1].reason).toBeNull();
    });

    it('pairs each pond with its own context', () => {
        const rows = buildPondRows(
            [pond({ id: 'p1' }), pond({ id: 'p2' })],
            [ctx({ pondId: 'p2', biomassKg: 690 })],
            [],
        );
        expect(rows[0].context).toBeNull();
        expect(rows[1].context?.biomassKg).toBe(690);
    });
});

/**
 * The reported contradiction: a farm page saying "2/2 good" while Today showed
 * one of those two ponds amber. The farm screens judged health from the
 * PERSISTED briefing alone; Today merged it with the live one. They were
 * answering different questions and only one of them was about right now.
 */
describe('mergeBriefings', () => {
    const item = (over: Partial<BriefingItem>): BriefingItem => ({
        pondId: 'p1',
        topTitle: 'Low oxygen',
        topSeverity: 'watch',
        source: 'wq',
        steps: [],
        alertCount: 1,
        ...over,
    });

    it('keeps a pond the LIVE briefing flags but the persisted one has never heard of', () => {
        const out = mergeBriefings([item({ pondId: 'p1' })], []);

        // This is the whole bug: persisted-only screens saw nothing here and
        // rendered the pond as healthy.
        expect(out).toHaveLength(1);
        expect(out[0].pondId).toBe('p1');
    });

    it('takes the higher severity when both sources know the pond', () => {
        const out = mergeBriefings(
            [item({ topSeverity: 'critical' })],
            [item({ topSeverity: 'watch' })],
        );

        expect(out).toHaveLength(1);
        expect(out[0].topSeverity).toBe('critical');
    });

    // Two sources flagging one pond is two reasons to look at it, and the count
    // is what breaks ties in the hero's ranking.
    it('adds the counts rather than picking one', () => {
        const out = mergeBriefings(
            [item({ alertCount: 2 })],
            [item({ alertCount: 3 })],
        );

        expect(out[0].alertCount).toBe(5);
    });

    it('sorts worst first, so callers can take the top without re-sorting', () => {
        const out = mergeBriefings(
            [
                item({ pondId: 'p1', topSeverity: 'info' }),
                item({ pondId: 'p2', topSeverity: 'critical' }),
                item({ pondId: 'p3', topSeverity: 'watch' }),
            ],
            [],
        );

        expect(out.map((o) => o.pondId)).toEqual(['p2', 'p3', 'p1']);
    });

    // A farm-wide alert carries no pondId, so it cannot be keyed by pond —
    // without a distinct key two different farm-wide alerts would collapse.
    it('keeps two different farm-wide alerts apart', () => {
        const out = mergeBriefings(
            [
                item({ pondId: null, source: 'inventory', topTitle: 'Feed low' }),
                item({ pondId: null, source: 'weather', topTitle: 'Storm coming' }),
            ],
            [],
        );

        expect(out).toHaveLength(2);
    });
});
