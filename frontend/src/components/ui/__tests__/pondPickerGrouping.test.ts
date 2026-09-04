/**
 * §4.8: the picker gains farm grouping and search. Both are pure over the pond
 * list, so they are tested there rather than through the markup.
 */
import { groupPondsByFarm, filterPonds } from '../PondPicker';
import type { Pond } from '../../../api/ponds';

const pond = (id: string, farmId: string, displayName: string): Pond =>
    ({ id, farmId, name: id, displayName, status: 'active' } as unknown as Pond);

describe('groupPondsByFarm', () => {
    it('gives a single untitled section when every pond is on one farm', () => {
        const ponds = [pond('a', 'f1', 'North'), pond('b', 'f1', 'South')];
        const sections = groupPondsByFarm(ponds, { f1: 'Ravi Farm' });
        expect(sections).toHaveLength(1);
        // Naming the only farm you have is noise.
        expect(sections[0].title).toBe('');
        expect(sections[0].ponds).toHaveLength(2);
    });

    it('gives a titled section per farm, in first-appearance order', () => {
        const ponds = [pond('a', 'f1', 'North'), pond('b', 'f2', 'East'), pond('c', 'f1', 'South')];
        const sections = groupPondsByFarm(ponds, { f1: 'Ravi Farm', f2: 'Delta Farm' });
        expect(sections.map((s) => s.title)).toEqual(['Ravi Farm', 'Delta Farm']);
        expect(sections[0].ponds.map((p) => p.id)).toEqual(['a', 'c']);
        expect(sections[1].ponds.map((p) => p.id)).toEqual(['b']);
    });

    it('survives a farm whose name never arrived', () => {
        const ponds = [pond('a', 'f1', 'North'), pond('b', 'f2', 'East')];
        expect(groupPondsByFarm(ponds, {})[1].title).toBe('');
    });

    it('returns nothing for an empty list rather than one empty section', () => {
        expect(groupPondsByFarm([], {})).toEqual([]);
    });
});

describe('filterPonds', () => {
    const ponds = [pond('a', 'f1', 'North Pond'), pond('b', 'f1', 'South Pond'), pond('c', 'f2', 'Nursery')];

    it('matches case-insensitively on the visible label', () => {
        expect(filterPonds(ponds, 'nor').map((p) => p.id)).toEqual(['a']);
        expect(filterPonds(ponds, 'POND').map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('returns everything for a blank query', () => {
        expect(filterPonds(ponds, '   ')).toHaveLength(3);
    });

    it('returns nothing rather than everything when nothing matches', () => {
        expect(filterPonds(ponds, 'zzz')).toEqual([]);
    });
});
