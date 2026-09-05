import {
  ActivityService,
  decodeCursor,
  encodeCursor,
} from './activity.service';

/**
 * The timeline is one raw UNION, so the things worth holding still are the
 * ones a query builder would normally guarantee: that the caller's farm scope
 * and the financial gate really reach the SQL, and that the cursor survives a
 * round trip.
 */
function makeService(over: any = {}) {
  const query = jest.fn().mockResolvedValue(over.rows ?? []);
  const farmAccess = {
    getAccessibleFarmIds: jest
      .fn()
      .mockResolvedValue(over.farmIds ?? ['f1', 'f2']),
    getFarmIdsWithCapability: jest
      .fn()
      .mockResolvedValue(over.financialFarmIds ?? []),
    assertCanAccessFarm: jest.fn().mockResolvedValue({ id: 'f1' }),
    assertCanAccessPond: jest.fn().mockResolvedValue({ id: 'p1' }),
  };
  const svc = new ActivityService({ query } as any, farmAccess as any);
  return { svc, query, farmAccess };
}

/** The SQL text of the single query the service issued. */
const sqlOf = (query: jest.Mock) => query.mock.calls[0][0] as string;
const paramsOf = (query: jest.Mock) => query.mock.calls[0][1] as any[];

describe('ActivityService', () => {
  describe('scope', () => {
    it('constrains every row to the accessible farm ids', async () => {
      const { svc, query } = makeService({ farmIds: ['f1', 'f9'] });

      await svc.list('u', {});

      expect(sqlOf(query)).toContain('e.farm_id = ANY($1)');
      expect(paramsOf(query)[0]).toEqual(['f1', 'f9']);
    });

    it('returns nothing, and asks the database nothing, with no farms', async () => {
      const { svc, query } = makeService({ farmIds: [] });

      await expect(svc.list('u', {})).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('asserts READ before narrowing to a farm or a pond', async () => {
      const { svc, farmAccess } = makeService();

      await svc.list('u', { farmId: 'f1', pondId: 'p1' });

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        'u',
        'f1',
        'READ',
      );
      expect(farmAccess.assertCanAccessPond).toHaveBeenCalledWith(
        'u',
        'p1',
        'READ',
      );
    });

    it('does not run the query when the farm assertion throws', async () => {
      const { svc, query, farmAccess } = makeService();
      farmAccess.assertCanAccessFarm.mockRejectedValue(new Error('nope'));

      await expect(svc.list('u', { farmId: 'f1' })).rejects.toThrow('nope');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('financial branches', () => {
    it('omits the money tables entirely without VIEW_FINANCIALS', async () => {
      const { svc, query } = makeService({ financialFarmIds: [] });

      await svc.list('u', {});

      const sql = sqlOf(query);
      expect(sql).not.toContain('FROM transactions');
      expect(sql).not.toContain('FROM expenses');
      // …but the operational branches are all still there.
      expect(sql).toContain('FROM water_quality_records');
      expect(sql).toContain('FROM harvests');
    });

    it('includes them, scoped to the financially-visible farms only', async () => {
      const { svc, query } = makeService({ financialFarmIds: ['f1'] });

      await svc.list('u', {});

      const sql = sqlOf(query);
      expect(sql).toContain('FROM transactions');
      expect(sql).toContain('FROM expenses');
      expect(sql).toContain('t.farm_id = ANY($2)');
      expect(paramsOf(query)[1]).toEqual(['f1']);
    });

    it('refuses a financial kind that was explicitly asked for', async () => {
      const { svc, query } = makeService({ financialFarmIds: [] });

      await expect(
        svc.list('u', { kinds: ['transaction'] }),
      ).resolves.toEqual({ items: [], nextCursor: null });
      expect(query).not.toHaveBeenCalled();
    });

    it('rejects an unknown kind rather than silently ignoring it', async () => {
      const { svc } = makeService();

      await expect(svc.list('u', { kinds: ['bogus'] })).rejects.toThrow(
        /Unknown activity kind/,
      );
    });
  });

  describe('pagination', () => {
    it('round-trips a cursor', () => {
      const c = { at: '2026-09-03T10:00:00.000Z', id: 'r1' };

      expect(decodeCursor(encodeCursor(c))).toEqual(c);
    });

    it('rejects a malformed cursor', () => {
      expect(() => decodeCursor('not-base64-json')).toThrow(/Invalid cursor/);
    });

    it('feeds the cursor back as the keyset bound', async () => {
      const at = '2026-09-03T10:00:00.000Z';
      const { svc, query } = makeService();

      await svc.list('u', { cursor: encodeCursor({ at, id: 'r1' }) });

      expect(sqlOf(query)).toContain('(e.at, e.id) < ($7::timestamptz, $8::uuid)');
      expect(paramsOf(query)[6]).toBe(at);
      expect(paramsOf(query)[7]).toBe('r1');
    });

    it('emits a next cursor only on a full page', async () => {
      const row = (id: string) => ({
        at: new Date('2026-09-03T10:00:00.000Z'),
        kind: 'feed',
        pond_id: 'p1',
        crop_id: null,
        actor_id: 'u1',
        actor_name: 'Ravi K',
        summary: 'starter, 12 kg',
        id,
      });
      const { svc } = makeService({ rows: [row('r1'), row('r2')] });

      const full = await svc.list('u', { limit: 2 });
      expect(full.nextCursor).toBe(
        encodeCursor({ at: '2026-09-03T10:00:00.000Z', id: 'r2' }),
      );
      expect(full.items[0]).toEqual({
        at: '2026-09-03T10:00:00.000Z',
        kind: 'feed',
        pondId: 'p1',
        cropId: null,
        actorId: 'u1',
        actorName: 'Ravi K',
        summary: 'starter, 12 kg',
        recordId: 'r1',
      });

      const partial = await svc.list('u', { limit: 50 });
      expect(partial.nextCursor).toBeNull();
    });

    it('clamps the limit to 200 and defaults to 50', async () => {
      const { svc, query } = makeService();

      await svc.list('u', { limit: 5000 });
      expect(paramsOf(query)[8]).toBe(200);

      const b = makeService();
      await b.svc.list('u', {});
      expect(paramsOf(b.query)[8]).toBe(50);
    });
  });
});
