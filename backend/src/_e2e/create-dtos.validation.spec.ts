import { ValidationPipe } from '@nestjs/common';
import { CreateFarmDto } from '../farms/dto/create-farm.dto';
import { CreatePondDto } from '../ponds/dto/create-pond.dto';
import { CreateCropDto } from '../crops/dto/create-crop.dto';

/**
 * Proves the entity-creation inputs survive the GLOBAL pipe the app runs
 * (`main.ts`: whitelist+transform). For each create DTO we push a full,
 * realistic payload through the real pipe and assert (a) validation passes and
 * (b) NO field is silently dropped by the whitelist.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});
const run = (metatype: any, value: any) =>
  pipe.transform(value, { type: 'body', metatype });

const UUID = '11111111-1111-4111-8111-111111111111';

describe('Create-DTO acceptance through the global ValidationPipe', () => {
  it('Farm: every submitted field is accepted and retained', async () => {
    const payload = {
      name: 'Konaseema Farm',
      areaHectares: 2.5,
      address: 'West Godavari, AP',
      waterSourceType: 'borehole',
      latitude: 16.5,
      longitude: 80.6,
      privacySetting: 'private',
      boundary: [{ latitude: 16.5, longitude: 80.6 }],
    };
    const out = await run(CreateFarmDto, { ...payload });
    expect(out).toMatchObject(payload);
    for (const k of Object.keys(payload)) expect(out).toHaveProperty(k); // nothing dropped
  });

  it('Farm: a client-supplied farmCode is stripped by the pipe', async () => {
    // The farm code is the join credential; it must always be generated
    // server-side. It is not on CreateFarmDto, so `whitelist: true` drops it.
    const out = await run(CreateFarmDto, {
      name: 'Konaseema Farm',
      farmCode: 'FARM0001',
    });
    expect(out).not.toHaveProperty('farmCode');
    expect(out).toMatchObject({ name: 'Konaseema Farm' });
  });

  it('Pond: every submitted field is accepted and retained', async () => {
    const payload = {
      farmId: UUID,
      namePrefix: 'P1',
      geometryType: 'rectangular',
      constructionType: 'lined',
      lengthM: 50,
      widthM: 100,
      depthM: 1.5,
      channelCount: 2,
      overrideAreaM2: 4900,
      displayName: 'Pond 1',
      batchCount: 1,
    };
    const out = await run(CreatePondDto, { ...payload });
    expect(out).toMatchObject(payload);
    for (const k of Object.keys(payload)) expect(out).toHaveProperty(k); // nothing dropped
  });

  it('Crop: every submitted field is accepted and retained', async () => {
    const payload = {
      pondId: UUID,
      name: 'Crop 1',
      cropCode: 'C-01',
      speciesType: 'Vannamei',
      seedType: 'PL-10',
      stockingDensity: 80,
      stockingCount: 400000,
      stockingDate: '2026-06-01',
      expectedHarvestDate: '2026-09-01',
      status: 'active',
      // Cycle targets the decision engines/simulation consume:
      totalSeed: 400000,
      feedPriceRpPerKg: 95,
      carryingCapacityKgM2: 1.25,
      targetCultivationDays: 120,
      targetSize: 40,
      targetSrPercent: 75,
      srPredictionMethod: 'feed_ratio',
    };
    const out = await run(CreateCropDto, { ...payload });
    expect(out).toMatchObject(payload);
    for (const k of Object.keys(payload)) expect(out).toHaveProperty(k); // nothing dropped
  });

  // Species/seed are closed lists: prod picked up a crop with
  // speciesType 'VannameiVannamei' from the old free-text field, which broke
  // threshold lookup. Both stay optional.
  it('Crop: rejects a species outside the canonical list', async () => {
    await expect(
      run(CreateCropDto, {
        pondId: UUID,
        name: 'Crop 1',
        speciesType: 'VannameiVannamei',
      }),
    ).rejects.toBeDefined();
  });

  it('Crop: rejects a seed type outside the list', async () => {
    await expect(
      run(CreateCropDto, { pondId: UUID, name: 'Crop 1', seedType: 'net' }),
    ).rejects.toBeDefined();
  });

  it('Crop: accepts a canonical species and seed type, and omitting both', async () => {
    await expect(
      run(CreateCropDto, {
        pondId: UUID,
        name: 'Crop 1',
        speciesType: 'Vannamei',
        seedType: 'PL-10',
      }),
    ).resolves.toMatchObject({ speciesType: 'Vannamei', seedType: 'PL-10' });
    await expect(
      run(CreateCropDto, { pondId: UUID, name: 'Crop 1' }),
    ).resolves.toMatchObject({ name: 'Crop 1' });
  });

  it('rejects an invalid field value (validation actually runs)', async () => {
    await expect(
      run(CreatePondDto, {
        farmId: 'not-a-uuid',
        namePrefix: 'P1',
        geometryType: 'rectangular',
        constructionType: 'lined',
        lengthM: 50,
        widthM: 100,
        depthM: 1.5,
      }),
    ).rejects.toBeDefined();
  });

  it('strips an unknown/extra field (whitelist works — extra data cannot sneak in)', async () => {
    const out = await run(CreateFarmDto, {
      name: 'X',
      hacker: 'DROP TABLE',
      isAdmin: true,
    });
    expect(out).toEqual({ name: 'X' });
  });
});
