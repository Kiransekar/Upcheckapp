/**
 * What analytics is told about a save — and, just as importantly, what it is
 * not told.
 *
 * `saveRecord` is the funnel every operational record goes through, so this is
 * where LOG_RECORDED / FIRST_LOG_RECORDED / SAVE_FAILED / SYNC_QUEUE_DRAINED
 * are emitted rather than in a dozen screens. Three properties are load-bearing
 * and each has a test below:
 *
 *  1. An event only fires for a record that actually LANDED. A queued write is
 *     counted when it replays, never when it was written.
 *  2. FIRST_LOG_RECORDED is once per farmer, FOREVER — which means it has to
 *     survive the process dying, so the "have they logged" flag lives in
 *     AsyncStorage and not in a module variable. The relaunch test below is the
 *     one that fails if someone "simplifies" that back to memory.
 *  3. A failure travels as a reason CATEGORY. Never a message: messages carry
 *     ids, emails and amounts, which the Privacy Policy says never reach
 *     analytics.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixed-uuid' }));
jest.mock('../../api/client', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), request: jest.fn() },
}));
jest.mock('../../utils/notifications', () => ({ syncReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../features/reminderTimes', () => ({
    loadReminderTimes: jest.fn().mockResolvedValue({}),
}));

// Only `capture` is stubbed. sizeBand and EVENTS stay real, so a test cannot
// pass against a band or an event name that does not exist.
jest.mock('../../features/analytics', () => ({
    ...jest.requireActual('../../features/analytics'),
    capture: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/client';
import { useSyncStore } from '../../store/syncStore';
import { capture, EVENTS } from '../../features/analytics';
import * as recordSync from '../recordSync';

const { saveRecord, replayQueuedOp, drainRecordQueue, failureReason } = recordSync;

const mockedPost = apiClient.post as jest.Mock;
const mockedRequest = (apiClient as any).request as jest.Mock;
const mockedCapture = capture as jest.Mock;

/**
 * Simulate the app being killed and reopened: everything the module kept in
 * memory is gone, everything on the device is not. (Re-requiring the module
 * with jest.isolateModules would also fork the zustand sync store out from
 * under the test, which is why this is a seam rather than a fresh require.)
 */
const coldStart = () => recordSync.__resetFirstLogCache();

/** noteLogRecorded is deliberately not awaited by the save path. */
const flush = () => new Promise((r) => setImmediate(r));

/** Props of every capture() of `event`, in order. */
const propsFor = (event: string): any[] =>
    mockedCapture.mock.calls.filter((c) => c[0] === event).map((c) => c[1]);

const okPost = () => mockedPost.mockResolvedValue({ data: { id: 'fixed-uuid' } });

/** An axios-shaped rejection: a response means the server answered. */
const httpError = (status: number) => ({ response: { status, data: { message: 'x' } } });

describe('a saved log is recorded', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
        coldStart();
        okPost();
    });

    it.each([
        ['water_quality', '/water-quality', { pondId: 'p1', ph: 7.8 }],
        ['feed', '/feed-records', { pondId: 'p1', quantityKg: 42.5 }],
    ])('fires LOG_RECORDED with kind %s once the POST succeeds', async (entity, endpoint, payload) => {
        okPost();

        await saveRecord({ entity, endpoint, payload });
        await flush();

        expect(propsFor(EVENTS.LOG_RECORDED)).toEqual([{ kind: entity, ok: true }]);
    });

    it('sends no reading, weight or amount along with it — only the kind', async () => {
        okPost();

        await saveRecord({
            entity: 'harvest',
            endpoint: '/harvests',
            payload: { pondId: 'p1', totalWeightKg: 1840, pricePerKg: 420, revenue: 772800 },
        });
        await flush();

        for (const props of propsFor(EVENTS.LOG_RECORDED)) {
            expect(Object.keys(props).sort()).toEqual(['kind', 'ok']);
        }
    });

    it('records nothing for a save that is not a farm log', async () => {
        okPost();

        await saveRecord({ entity: 'attendance', endpoint: '/attendance', payload: {} });
        await flush();

        expect(propsFor(EVENTS.LOG_RECORDED)).toEqual([]);
        expect(propsFor(EVENTS.FIRST_LOG_RECORDED)).toEqual([]);
    });

    it('counts an offline write when it replays, not when it was queued', async () => {
        useSyncStore.getState().setConnected(false);

        await saveRecord({ entity: 'sampling', endpoint: '/samplings', payload: { pondId: 'p1' } });
        await flush();
        expect(propsFor(EVENTS.LOG_RECORDED)).toEqual([]);

        mockedRequest.mockResolvedValue({ data: {} });
        useSyncStore.getState().setConnected(true);
        await drainRecordQueue();
        await flush();

        expect(propsFor(EVENTS.LOG_RECORDED)).toEqual([{ kind: 'sampling', ok: true }]);
    });
});

describe('the FIRST log a farmer ever records', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
        okPost();
    });

    it('fires FIRST_LOG_RECORDED on the first save and never on the ones after', async () => {
        coldStart();
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });
        await flush();
        await saveRecord({ entity: 'water_quality', endpoint: '/water-quality', payload: {} });
        await flush();
        await saveRecord({ entity: 'mortality', endpoint: '/mortalities', payload: {} });
        await flush();

        expect(propsFor(EVENTS.FIRST_LOG_RECORDED)).toEqual([{ kind: 'feed' }]);
        expect(propsFor(EVENTS.LOG_RECORDED)).toHaveLength(3);
    });

    /**
     * THE test. A module-level `let firstLogDone = false` passes every
     * assertion above and fails this one: relaunching the app resets module
     * state, and the farmer would be counted as newly activated on every cold
     * start forever. Only a persisted flag survives.
     */
    it('stays fired across an app relaunch, because the flag is persisted', async () => {
        coldStart();
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });
        await flush();
        expect(propsFor(EVENTS.FIRST_LOG_RECORDED)).toHaveLength(1);

        // Cold start: fresh module instance, same device storage.
        jest.clearAllMocks();
        coldStart();
        await saveRecord({ entity: 'sampling', endpoint: '/samplings', payload: {} });
        await flush();

        expect(propsFor(EVENTS.FIRST_LOG_RECORDED)).toEqual([]);
        expect(propsFor(EVENTS.LOG_RECORDED)).toEqual([{ kind: 'sampling', ok: true }]);
    });

    it('fires again for a device with no flag stored — the flag is what decides, not luck', async () => {
        coldStart();
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });
        await flush();

        await AsyncStorage.clear(); // reinstall
        jest.clearAllMocks();
        coldStart();
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });
        await flush();

        expect(propsFor(EVENTS.FIRST_LOG_RECORDED)).toEqual([{ kind: 'feed' }]);
    });
});

describe('a save that genuinely fails', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
        coldStart();
        okPost();
    });

    it.each([
        [400, 'validation'],
        [422, 'validation'],
        [401, 'auth'],
        [403, 'permission'],
        [409, 'conflict'],
        [500, 'unknown'],
    ])('maps HTTP %i to reason %s', async (status, reason) => {
        mockedPost.mockRejectedValue(httpError(status as number));

        await expect(
            saveRecord({ entity: 'treatment', endpoint: '/treatments', payload: {} }),
        ).rejects.toBeDefined();

        expect(propsFor(EVENTS.SAVE_FAILED)).toEqual([{ kind: 'treatment', reason }]);
    });

    it('calls a response-less failure network — and queues it rather than reporting a loss', async () => {
        expect(failureReason({})).toBe('network');

        mockedPost.mockRejectedValue({ message: 'Network Error' });
        const r = await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });

        expect(r.queued).toBe(true);
        expect(propsFor(EVENTS.SAVE_FAILED)).toEqual([]);
    });

    it('never lets an error message through, only the category', async () => {
        mockedPost.mockRejectedValue({
            response: { status: 400, data: { message: 'Pond 4a1b: harvest of 1840kg exceeds stock for anita@farm.in' } },
        });

        await expect(
            saveRecord({ entity: 'harvest', endpoint: '/harvests', payload: {} }),
        ).rejects.toBeDefined();

        const sent = JSON.stringify(propsFor(EVENTS.SAVE_FAILED));
        expect(sent).not.toMatch(/anita|1840|4a1b/);
        expect(propsFor(EVENTS.SAVE_FAILED)).toEqual([{ kind: 'harvest', reason: 'validation' }]);
    });

    it('reports a queued op the server permanently rejects on replay', async () => {
        mockedRequest.mockRejectedValue(httpError(422));

        await expect(
            replayQueuedOp({
                id: 'q1',
                type: 'CREATE',
                entity: 'water_quality',
                endpoint: '/water-quality',
                method: 'POST',
                payload: {},
                retryCount: 0,
                createdAt: new Date().toISOString(),
            }),
        ).resolves.toBe('failed');

        expect(propsFor(EVENTS.SAVE_FAILED)).toEqual([{ kind: 'water_quality', reason: 'validation' }]);
    });
});

describe('an offline backlog that drains', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        useSyncStore.getState().clearQueue();
        jest.clearAllMocks();
        coldStart();
        okPost();
    });

    it('reports the size as a BAND and ok when everything landed', async () => {
        useSyncStore.getState().setConnected(false);
        for (const entity of ['feed', 'water_quality', 'sampling']) {
            await saveRecord({ entity, endpoint: `/${entity}`, payload: {} });
        }
        expect(useSyncStore.getState().queue).toHaveLength(3);

        mockedRequest.mockResolvedValue({ data: {} });
        useSyncStore.getState().setConnected(true);
        await drainRecordQueue();

        expect(propsFor(EVENTS.SYNC_QUEUE_DRAINED)).toEqual([{ band: '2-5', ok: true }]);
    });

    it('says ok:false when an op was parked instead of landing', async () => {
        useSyncStore.getState().setConnected(false);
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: {} });

        mockedRequest.mockRejectedValue(httpError(422)); // permanent → parked
        useSyncStore.getState().setConnected(true);
        await drainRecordQueue();

        expect(propsFor(EVENTS.SYNC_QUEUE_DRAINED)).toEqual([{ band: '1', ok: false }]);
    });

    it('stays quiet when a drain moved nothing — NetInfo fires these constantly', async () => {
        useSyncStore.getState().setConnected(true);

        await drainRecordQueue();

        expect(propsFor(EVENTS.SYNC_QUEUE_DRAINED)).toEqual([]);
    });
});
