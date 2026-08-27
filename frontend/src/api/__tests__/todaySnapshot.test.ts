// The home screen used to compute every pond's context TWICE per visit —
// once inside live-briefing, which threw them away, and again through one
// pond-context call per farm. Measured at 54 database queries for a three-pond
// owner. `GET /alert-center/today` returns both from one pass: 25.
//
// The fallback is the part that matters operationally. The app ships as an OTA
// update and the backend deploys separately, so a phone will run this code
// against an API that has never heard of /today. Without the fallback that
// window is a blank home screen.
jest.mock('../alertCenter', () => ({
    alertCenterApi: { today: jest.fn(), liveBriefing: jest.fn(), briefing: jest.fn() },
}));
jest.mock('../pondContext', () => ({
    pondContextApi: { forFarm: jest.fn() },
}));

import { fetchTodaySnapshot } from '../todaySnapshot';
import { alertCenterApi } from '../alertCenter';
import { pondContextApi } from '../pondContext';

const today = alertCenterApi.today as jest.Mock;
const liveBriefing = alertCenterApi.liveBriefing as jest.Mock;
const briefing = alertCenterApi.briefing as jest.Mock;
const forFarm = pondContextApi.forFarm as jest.Mock;

const ctx = (pondId: string) => ({ pondId, biomassKg: 100 }) as any;
const alert = (pondId: string, severity = 'watch') =>
    ({ pondId, topTitle: 'Ammonia rising', topSeverity: severity, source: 'water', steps: [], alertCount: 1 }) as any;

const notFound = Object.assign(new Error('Request failed'), { response: { status: 404 } });

beforeEach(() => {
    jest.clearAllMocks();
    briefing.mockResolvedValue({ data: [] });
});

describe('the fast path', () => {
    it('takes contexts and alerts from one request', async () => {
        today.mockResolvedValue({ data: { contexts: [ctx('p1')], briefing: [alert('p1')] } });

        const snap = await fetchTodaySnapshot(['farm-1']);

        expect(snap.contexts).toHaveLength(1);
        expect(snap.briefing).toHaveLength(1);
        // The whole point: the old two calls are not made at all.
        expect(liveBriefing).not.toHaveBeenCalled();
        expect(forFarm).not.toHaveBeenCalled();
    });

    // The persisted stream is a separate cheap read — it lists unread alerts
    // and computes no contexts — and both are needed. See mergeBriefings.
    it('still merges the persisted stream in', async () => {
        today.mockResolvedValue({ data: { contexts: [], briefing: [alert('p1')] } });
        briefing.mockResolvedValue({ data: [alert('p2')] });

        const snap = await fetchTodaySnapshot(['farm-1']);

        expect(snap.briefing.map((b) => b.pondId).sort()).toEqual(['p1', 'p2']);
    });
});

describe('the fallback, for a backend older than the app', () => {
    it('falls back to the two-call shape on a 404', async () => {
        today.mockRejectedValue(notFound);
        liveBriefing.mockResolvedValue({ data: [alert('p1')] });
        forFarm.mockResolvedValue({ data: [ctx('p1')] });

        const snap = await fetchTodaySnapshot(['farm-1']);

        expect(snap.contexts).toHaveLength(1);
        expect(snap.briefing).toHaveLength(1);
        expect(forFarm).toHaveBeenCalledWith('farm-1');
    });

    // A 500 is the endpoint existing and failing. Quietly serving the slow path
    // would hide a broken deploy behind a working screen.
    it('does not swallow a real server error', async () => {
        today.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));

        await expect(fetchTodaySnapshot(['farm-1'])).rejects.toThrow('boom');
        expect(forFarm).not.toHaveBeenCalled();
    });

    // One farm silently contributing nothing is how "All farms" comes to show a
    // total that is short by a third. The caller renders absent, not wrong.
    it('fails the whole snapshot when one farm cannot be read', async () => {
        today.mockRejectedValue(notFound);
        liveBriefing.mockResolvedValue({ data: [] });
        forFarm.mockImplementation((id: string) =>
            id === 'farm-2' ? Promise.reject(new Error('timeout')) : Promise.resolve({ data: [ctx('p1')] }),
        );

        await expect(fetchTodaySnapshot(['farm-1', 'farm-2'])).rejects.toThrow(/could not be read/);
    });
});
