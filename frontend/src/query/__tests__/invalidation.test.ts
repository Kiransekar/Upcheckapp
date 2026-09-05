/**
 * "POND SHOWS IDLE AFTER CREATING A CYCLE."
 *
 * `/crops` was missing from URL_ENTITY_MAP, so the response interceptor
 * resolved `undefined` for every cycle write and invalidated nothing. The pond
 * dashboard kept serving its cached "no cycle" read against a 5-minute
 * staleTime — create, close, update and delete were all affected.
 *
 * These pin both halves: the path resolves to an entity, and that entity
 * actually marks the pond query stale.
 */
import { queryClient, qk, resolveEntityForUrl, invalidateForEntity } from '../client';

describe('cycle writes invalidate the pond caches', () => {
    afterEach(() => {
        queryClient.clear();
    });

    it('resolves /crops to the crop entity', () => {
        expect(resolveEntityForUrl('/crops')).toBe('crop');
    });

    it('resolves a nested crop path (close/update) to the crop entity', () => {
        expect(resolveEntityForUrl('/crops/abc/close')).toBe('crop');
    });

    it('marks a cached pond dashboard invalidated', () => {
        queryClient.setQueryData(qk.pond('p1'), { id: 'p1', activeCrop: null });

        invalidateForEntity('crop');

        expect(queryClient.getQueryState(qk.pond('p1'))?.isInvalidated).toBe(true);
    });
});
