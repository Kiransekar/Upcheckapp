/**
 * What the farmer can SEE of the offline queue — and, just as importantly,
 * what it must never touch.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixed-uuid' }));
jest.mock('../../api/client', () => ({
    __esModule: true,
    default: { post: jest.fn(), request: jest.fn() },
}));

import { useSyncStore, type QueuedOperation } from '../../store/syncStore';
import { pendingFor } from '../pending';
import { saveRecord } from '../recordSync';

const op = (over: Partial<QueuedOperation>): QueuedOperation => ({
    id: 'op-1',
    type: 'CREATE',
    entity: 'mortality',
    endpoint: '/mortality',
    method: 'POST',
    payload: { pondId: 'p1' },
    retryCount: 0,
    createdAt: '2026-08-27T09:00:00.000Z',
    ...over,
});

describe('pendingFor', () => {
    it('returns queued and parked ops together, newest first, flagging the parked ones', () => {
        const rows = pendingFor(
            [op({ id: 'a', createdAt: '2026-08-27T09:00:00.000Z' })],
            [op({ id: 'b', createdAt: '2026-08-27T10:00:00.000Z', entity: 'feed' })],
        );

        expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
        expect(rows[0].failed).toBe(true);
        expect(rows[1].failed).toBe(false);
    });

    it('narrows to one pond', () => {
        const rows = pendingFor(
            [op({ id: 'a', payload: { pondId: 'p1' } }), op({ id: 'b', payload: { pondId: 'p2' } })],
            [],
            { pondId: 'p2' },
        );
        expect(rows.map((r) => r.id)).toEqual(['b']);
    });

    it('narrows to one entity', () => {
        const rows = pendingFor(
            [op({ id: 'a', entity: 'mortality' }), op({ id: 'b', entity: 'feed' })],
            [],
            { entity: 'feed' },
        );
        expect(rows.map((r) => r.id)).toEqual(['b']);
    });

    it('carries the pond the record was logged against', () => {
        expect(pendingFor([op({ payload: { pondId: 'p9' } })], [])[0].pondId).toBe('p9');
    });
});

describe('an offline save becomes a visible pending record', () => {
    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(false);
    });

    it('shows up under its own pond straight away', async () => {
        const res = await saveRecord({
            entity: 'mortality',
            endpoint: '/mortality',
            payload: { pondId: 'p1', quantity: 5_000 },
        });

        expect(res.queued).toBe(true);
        const rows = pendingFor(useSyncStore.getState().queue, [], { pondId: 'p1' });
        expect(rows).toHaveLength(1);
        expect(rows[0].entity).toBe('mortality');
        // …and not under a different pond.
        expect(pendingFor(useSyncStore.getState().queue, [], { pondId: 'p2' })).toHaveLength(0);
    });
});
