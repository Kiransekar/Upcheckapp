import { BadRequestException } from '@nestjs/common';
import { MeasurementService } from './measurement.service';
import { DataDictionaryService } from './data-dictionary.service';
import { DataDictionaryEntry } from './data-dictionary.entity';
import {
  DATA_DICTIONARY_SEED,
  DATA_DICTIONARY_VERSION,
} from './data-dictionary.seed';

/**
 * Minimal in-memory stand-in for the subset of TypeORM Repository the
 * Measurement + DataDictionary services use (create/save/findOne/find/count).
 * Avoids booting a real DB while still exercising the real service logic.
 */
function fakeRepo<T extends { id?: string }>(seed: T[] = []) {
  const store = new Map<string, T>();
  let seq = 0;
  for (const s of seed) {
    const id = s.id ?? `seed-${++seq}`;
    store.set(id, { ...s, id } as T);
  }
  const matches = (v: any, where: any) =>
    !where || Object.entries(where).every(([k, val]) => v[k] === val);
  const saveOne = async (x: any) => {
    if (!x.id) x.id = `gen-${++seq}`;
    store.set(x.id, { ...x });
    return store.get(x.id);
  };
  const api = {
    store,
    create: (x: any) => ({ ...x }),
    save: async (x: any): Promise<any> =>
      Array.isArray(x) ? Promise.all(x.map(saveOne)) : saveOne(x),
    findOne: async ({ where }: any) => {
      for (const v of store.values()) if (matches(v, where)) return { ...v };
      return null;
    },
    find: async ({ where }: any) =>
      [...store.values()]
        .filter((v) => matches(v, where))
        .map((v) => ({ ...v })),
    count: async () => store.size,
  };
  return api;
}

function buildDictionary(): DataDictionaryEntry[] {
  return DATA_DICTIONARY_SEED.map((s, i) => ({
    id: `dict-${i}`,
    param: s.param,
    label: s.label,
    category: s.category,
    valueType: s.valueType,
    unit: s.unit,
    allowedValues: s.allowedValues ?? null,
    minValue: s.minValue ?? null,
    maxValue: s.maxValue ?? null,
    version: DATA_DICTIONARY_VERSION,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as DataDictionaryEntry[];
}

const USER = 'user-1';
const POND = 'pond-1';

function makeService(opts?: { stockingDate?: string }) {
  const dictRepo = fakeRepo<DataDictionaryEntry>(buildDictionary());
  const dictionary = new DataDictionaryService(dictRepo as any);

  const measRepo = fakeRepo<any>();
  const cropRepo = fakeRepo<any>(
    opts?.stockingDate
      ? [{ id: 'crop-1', pondId: POND, stockingDate: opts.stockingDate }]
      : [],
  );
  const pondsService = {
    findOne: jest.fn().mockResolvedValue({ id: POND }),
    // Capability-bearing access check — every MeasurementService call site uses
    // this now, so the IDOR re-check below is asserted against it.
    verifyAccess: jest.fn().mockResolvedValue(undefined),
  };

  const service = new MeasurementService(
    measRepo as any,
    cropRepo as any,
    dictionary,
    pondsService as any,
  );
  return { service, measRepo, pondsService };
}

describe('MeasurementService', () => {
  it('stores a valid numeric reading with the canonical unit and manual defaults', async () => {
    const { service } = makeService();
    const m = await service.create(
      { pondId: POND, param: 'do', valueNum: 4.2 },
      USER,
    );
    expect(m.valueNum).toBe(4.2);
    expect(m.unit).toBe('mg/L'); // inherited canonical unit
    expect(m.source).toBe('manual');
    expect(m.confidence).toBe(1);
    expect(m.enteredBy).toBe(USER);
    expect(m.isSuperseded).toBe(false);
  });

  it('rejects an unknown param', async () => {
    const { service } = makeService();
    await expect(
      service.create({ pondId: POND, param: 'nonsense', valueNum: 1 }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-range numeric value', async () => {
    const { service } = makeService();
    await expect(
      service.create({ pondId: POND, param: 'ph', valueNum: 99 }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a categorical value outside the allowed set', async () => {
    const { service } = makeService();
    await expect(
      service.create(
        { pondId: POND, param: 'water_color', valueText: 'purple' },
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const ok = await service.create(
      { pondId: POND, param: 'water_color', valueText: 'green' },
      USER,
    );
    expect(ok.valueText).toBe('green');
  });

  it('preserves null ≠ 0 for a missing reading', async () => {
    const { service } = makeService();
    const m = await service.create(
      { pondId: POND, param: 'do', isMissingReason: 'sensor_fail' },
      USER,
    );
    expect(m.valueNum).toBeNull();
    expect(m.isMissingReason).toBe('sensor_fail');
    // A missing reading that still carries a value is rejected.
    await expect(
      service.create(
        {
          pondId: POND,
          param: 'do',
          valueNum: 4.2,
          isMissingReason: 'not_measured',
        },
        USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent on a client-supplied id', async () => {
    const { service, measRepo } = makeService();
    const id = '11111111-1111-4111-8111-111111111111';
    const a = await service.create(
      { id, pondId: POND, param: 'ph', valueNum: 7.5 },
      USER,
    );
    const b = await service.create(
      { id, pondId: POND, param: 'ph', valueNum: 9.9 },
      USER,
    );
    expect(a.id).toBe(id);
    expect(b.id).toBe(id);
    expect(b.valueNum).toBe(7.5); // second call returns the stored row, not the new value
    expect(measRepo.store.size).toBe(1);
  });

  it('IDOR-1: rejects a replayed id whose stored row is on a pond the caller does not own', async () => {
    const { service, measRepo, pondsService } = makeService();
    const id = '22222222-2222-4222-8222-222222222222';
    // Seed a row owned by another tenant on a foreign pond.
    measRepo.store.set(id, {
      id,
      pondId: 'foreign-pond',
      param: 'ph',
      valueNum: 7.0,
    });

    // Access check passes for the caller's own pond (dto.pondId) but MUST be
    // re-run against the found row's own pond — which the caller cannot access.
    pondsService.verifyAccess
      .mockImplementationOnce(async () => undefined) // dto.pondId access OK
      .mockImplementationOnce(async () => {
        throw new BadRequestException('not your pond'); // existing.pondId access fails
      });

    await expect(
      service.create({ id, pondId: POND, param: 'ph', valueNum: 1 }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pondsService.verifyAccess).toHaveBeenCalledWith(
      'foreign-pond',
      USER,
      'WRITE_OPERATIONAL',
    );
  });

  it('derives DOC from the crop stocking date (stocking day = DOC 1)', async () => {
    const { service } = makeService({ stockingDate: '2026-06-01' });
    const m = await service.create(
      {
        pondId: POND,
        cropId: 'crop-1',
        param: 'abw',
        valueNum: 12,
        measuredAt: '2026-06-11T08:00:00.000Z',
      },
      USER,
    );
    expect(m.doc).toBe(11); // 10 days after stocking, +1
  });

  it('edits by appending a corrected row and superseding the original (raw preserved)', async () => {
    const { service, measRepo } = makeService();
    const original = await service.create(
      { pondId: POND, param: 'ph', valueNum: 7.0 },
      USER,
    );
    const edited = await service.edit(original.id, { valueNum: 7.8 }, USER);

    expect(edited.id).not.toBe(original.id);
    expect(edited.valueNum).toBe(7.8);
    expect(edited.editedFrom).toBe(original.id);

    // Original is preserved with its raw value, flagged superseded.
    const stored = measRepo.store.get(original.id);
    expect(stored.valueNum).toBe(7.0);
    expect(stored.isSuperseded).toBe(true);
  });
});
