/**
 * L2 / D2 — a log must carry at least one reading.
 *
 * Every parameter on these DTOs is optional, so a completely blank payload
 * saved happily. The empty row was never the real damage: `logProgress
 * .pondSlotDone` asks only whether a record EXISTS in the slot, so a blank
 * save stopped the reminder, turned the Today card green and held the streak
 * — while every `*AsOf` stayed old and `computeConfidence` kept decaying. The
 * app showed the farmer the optimistic half of its own disagreement.
 *
 * Driven through the REAL ValidationPipe with the app's real settings
 * (`whitelist: true, forbidNonWhitelisted: false, transform: true`), because
 * the guard hangs off a property no client ever sends — and whitelisting is
 * exactly the mechanism that could have silently stripped it before it ran.
 */
import { ValidationPipe } from '@nestjs/common';

import { CreateWaterQualityRecordDto } from '../../water-quality/dto/create-water-quality-record.dto';
import { CreatePlanktonDataDto } from '../../plankton/dto/create-plankton-data.dto';
import { CreateMicrobiologyDataDto } from '../../microbiology/dto/create-microbiology-data.dto';
import { CreateChemicalDataDto } from '../../chemical/dto/create-chemical-data.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

const run = (metatype: any, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

/**
 * The validation messages the client would receive. `BadRequestException`'s
 * own `message` is just "Bad Request Exception" — the useful part is the
 * response body, which is what a farmer's device actually parks in
 * `failedOperations`.
 */
const messagesFrom = async (metatype: any, value: unknown): Promise<string[]> => {
  try {
    await run(metatype, value);
    throw new Error('expected the payload to be rejected, but it was accepted');
  } catch (err: any) {
    if (typeof err?.getResponse !== 'function') throw err;
    const body = err.getResponse();
    return Array.isArray(body?.message) ? body.message : [String(body?.message)];
  }
};

/** Did it fail for the reason we care about, rather than some other one? */
const rejectedForEmptiness = async (metatype: any, value: unknown) =>
  expect((await messagesFrom(metatype, value)).join(' ')).toMatch(
    /At least one of the following must have a value/,
  );

const POND = '11111111-1111-4111-8111-111111111111';
const CROP = '22222222-2222-4222-8222-222222222222';

describe('water quality — at least one reading', () => {
  it('rejects a record with no parameters at all', async () => {
    await rejectedForEmptiness(CreateWaterQualityRecordDto, { pondId: POND });
  });

  /**
   * The case that actually happened: a farmer taps Save on a blank form and
   * the app congratulates them. A note is not a reading — it moves no `*AsOf`
   * and feeds no engine — so it must not be what makes the day count.
   */
  it('rejects a record carrying only notes', async () => {
    await rejectedForEmptiness(CreateWaterQualityRecordDto, {
      pondId: POND,
      notes: 'looked fine',
    });
  });

  it('rejects a record whose every parameter was explicitly cleared to null', async () => {
    await rejectedForEmptiness(CreateWaterQualityRecordDto, {
      pondId: POND,
      ph: null,
      temperature: null,
      dissolvedOxygen: null,
    });
  });

  it('accepts a quick-mode record with a single value', async () => {
    await expect(
      run(CreateWaterQualityRecordDto, { pondId: POND, ph: 7.8 }),
    ).resolves.toMatchObject({ ph: 7.8 });
  });

  /**
   * ZERO IS A READING, and an important one — dissolved oxygen at 0 is the
   * emergency this whole product exists to catch. A falsy-check here would
   * have thrown away the most urgent record a farmer can file.
   */
  it('accepts a zero, which is a measurement and not an absence', async () => {
    await expect(
      run(CreateWaterQualityRecordDto, { pondId: POND, dissolvedOxygen: 0 }),
    ).resolves.toMatchObject({ dissolvedOxygen: 0 });
  });

  it('still enforces the physical ranges it enforced before', async () => {
    await expect(
      run(CreateWaterQualityRecordDto, { pondId: POND, ph: 99 }),
    ).rejects.toThrow();
  });
});

describe('the other parameter logs carry the same rule', () => {
  it.each([
    ['plankton', CreatePlanktonDataDto, { cropId: CROP, measurementDate: '2026-09-06', measurementTime: '06:00' }, { greenAlgaeGaCellMl: 120 }],
    ['microbiology', CreateMicrobiologyDataDto, { cropId: CROP, measurementDate: '2026-09-06' }, { totalBacillusCfuMl: 40 }],
    ['chemical', CreateChemicalDataDto, { cropId: CROP, measurementDate: '2026-09-06', measurementTime: '06:00' }, { alkalinityPpm: 120 }],
  ])('%s rejects an empty record and accepts one with a value', async (_l, dto, base, value) => {
    await rejectedForEmptiness(dto, base);
    await expect(run(dto, { ...base, ...value })).resolves.toMatchObject(value);
  });
});
