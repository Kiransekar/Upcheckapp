/**
 * Completing a harvest plan has to actually harvest the pond.
 *
 * Reported as "the harvest feature is half baked and it feels like UI-only,
 * nothing happens". It wrote the plan, booked the income and marked the crop —
 * and then left the pond holding the cycle it had just been harvested out of.
 * Still stocked, still fed, still counted as active everywhere. From the
 * farmer's side that is indistinguishable from the button doing nothing.
 *
 * It also wrote crop status 'harvested', a word the crop entity's own
 * vocabulary (active | completed | cancelled) does not contain and nothing
 * else in the app recognises.
 */
import { ConflictException } from '@nestjs/common';
import { HarvestPlansService } from './harvest-plans.service';

const PLAN = {
  id: 'plan-1',
  pondId: 'pond-1',
  cropId: 'crop-1',
  status: 'planned',
  pond: { farmId: 'farm-1' },
};

const build = (plan: any = PLAN) => {
  const plansRepository = {
    findOne: jest.fn().mockResolvedValue(plan),
    update: jest.fn().mockResolvedValue(undefined),
    findOneBy: jest.fn().mockResolvedValue({ ...plan, status: 'completed' }),
  };
  const transactionsRepository = {
    create: jest.fn((x) => x),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const cropsRepository = { update: jest.fn().mockResolvedValue(undefined) };
  const pondsRepository = { update: jest.fn().mockResolvedValue(undefined) };

  const service = new HarvestPlansService(
    plansRepository as any,
    transactionsRepository as any,
    {} as any, // expensesRepository
    {} as any, // harvestsRepository
    cropsRepository as any,
    pondsRepository as any,
    {} as any, // farmAccess
  );
  return { service, plansRepository, transactionsRepository, cropsRepository, pondsRepository };
};

const payload = {
  actualHarvestDate: new Date('2026-08-27T00:00:00.000Z'),
  actualWeightKg: 400,
  actualPricePerKg: 300,
} as any;

describe('completePlan', () => {
  it('empties the pond it just harvested', async () => {
    const { service, pondsRepository } = build();

    await service.completePlan('plan-1', payload);

    expect(pondsRepository.update).toHaveBeenCalledWith(
      // Scoped to the crop that was actually harvested: if another cycle has
      // been started in the meantime, this must not clear that one.
      { id: 'pond-1', activeCycleId: 'crop-1' },
      { activeCycleId: null, status: 'fallow' },
    );
  });

  it("closes the crop with the vocabulary the rest of the app reads", async () => {
    const { service, cropsRepository } = build();

    await service.completePlan('plan-1', payload);

    expect(cropsRepository.update).toHaveBeenCalledWith(
      'crop-1',
      expect.objectContaining({ status: 'completed', harvestWeightKg: 400 }),
    );
  });

  it('books the sale as farm income', async () => {
    const { service, transactionsRepository } = build();

    await service.completePlan('plan-1', payload);

    expect(transactionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ farmId: 'farm-1', type: 'income', amount: 120000 }),
    );
  });

  // A double-tap or an offline retry must not book the income twice.
  it('refuses a second completion', async () => {
    const { service, pondsRepository } = build({ ...PLAN, status: 'completed' });

    await expect(service.completePlan('plan-1', payload)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(pondsRepository.update).not.toHaveBeenCalled();
  });

  // A plan can be drawn up for a pond with no cycle running. There is no crop
  // to close and no pond to empty; the money still books.
  it('books the income but touches no pond when the plan has no cycle', async () => {
    const { service, pondsRepository, cropsRepository, transactionsRepository } = build({
      ...PLAN,
      cropId: null,
    });

    await service.completePlan('plan-1', payload);

    expect(transactionsRepository.save).toHaveBeenCalled();
    expect(cropsRepository.update).not.toHaveBeenCalled();
    expect(pondsRepository.update).not.toHaveBeenCalled();
  });
});
