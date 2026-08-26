// The farm card's three numbers and its strip of coloured bars all come from
// here. If this ranks wrong, the Farms screen points a farmer at the wrong farm
// — so the ordering and the fallow rule are what these tests pin.
import {
    healthOf,
    severityByPond,
    sortByHealth,
    rollUpFarm,
    buildPondRows,
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
        expect(healthOf(pond({ status: 'fallow' }), 'critical')).toBe('fallow');
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
