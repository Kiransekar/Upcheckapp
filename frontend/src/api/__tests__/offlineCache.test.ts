// The reported failure: "turn off internet and every screen shows Cannot reach
// the server", including screens whose data was on-screen a moment earlier.
//
// Only 7 of ~96 screens read through TanStack Query; the rest fetch straight
// into useState with no cache at all. Rather than migrate 89 screens, the HTTP
// layer serves the last-known-good GET when the network is gone — which fixes
// every screen at once, cached or not.
import { readCached, writeCached, clearOfflineCache } from '../offlineCache';

beforeEach(async () => {
    await clearOfflineCache();
});

it('returns what was stored', async () => {
    await writeCached('/farms', [{ id: 'f1' }]);
    expect((await readCached('/farms'))?.data).toEqual([{ id: 'f1' }]);
});

it('has nothing for a url never fetched', async () => {
    expect(await readCached('/never')).toBeNull();
});

it('stamps when the response came back, so screens can show its age', async () => {
    const before = Date.now();
    await writeCached('/farms', []);
    const at = (await readCached('/farms'))!.at;
    expect(at).toBeGreaterThanOrEqual(before);
});

// This is a SHARED-DEVICE app. These responses are the previous user's data,
// so sign-out must drop them — same reason clearSession() clears the query cache.
it('is wiped by clearOfflineCache, so the next user cannot read them', async () => {
    await writeCached('/farms', [{ id: 'f1' }]);
    await clearOfflineCache();
    expect(await readCached('/farms')).toBeNull();
});

// Android's AsyncStorage is one ~6MB blob and the ceiling cannot be raised over
// the air, so the cache is bounded and evicts oldest-first.
it('evicts the oldest entries past the cap instead of growing forever', async () => {
    for (let i = 0; i < 130; i++) await writeCached(`/u/${i}`, { i });
    expect(await readCached('/u/0')).toBeNull();       // oldest, evicted
    expect(await readCached('/u/129')).not.toBeNull(); // newest, kept
});

it('skips a response too large to be worth storing', async () => {
    await writeCached('/big', { blob: 'x'.repeat(300 * 1024) });
    expect(await readCached('/big')).toBeNull();
});
