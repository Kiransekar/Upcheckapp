import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HarvestPlan } from './harvest-plan.entity';
import { CreateHarvestPlanDto } from './dto/create-harvest-plan.dto';
import { UpdateHarvestPlanDto } from './dto/update-harvest-plan.dto';
import { CompletePlanDto } from './dto/complete-plan.dto';
import { Transaction } from '../transactions/transaction.entity';
import { Expense } from '../finances/expense.entity';
import { Harvest } from '../harvests/harvest.entity';
import { Crop } from '../crops/crop.entity';
import { Pond } from '../ponds/pond.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class HarvestPlansService {
  constructor(
    @InjectRepository(HarvestPlan)
    private plansRepository: Repository<HarvestPlan>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(Harvest)
    private harvestsRepository: Repository<Harvest>,
    @InjectRepository(Crop)
    private cropsRepository: Repository<Crop>,
    @InjectRepository(Pond)
    private pondsRepository: Repository<Pond>,
    private farmAccess: FarmAccessService,
  ) {}

  create(createDto: CreateHarvestPlanDto) {
    const plan = this.plansRepository.create(createDto);
    return this.plansRepository.save(plan);
  }

  /** Scoped to farms the caller can access — never returns plans from other farms. */
  async findAll(userId: string, pondId?: string) {
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) return [];

    const qb = this.plansRepository
      .createQueryBuilder('hp')
      .innerJoin('hp.pond', 'pond')
      .where('pond.farmId IN (:...farmIds)', { farmIds })
      .orderBy('hp.createdAt', 'DESC');
    if (pondId) qb.andWhere('hp.pondId = :pondId', { pondId });
    return qb.getMany();
  }

  findOne(id: string) {
    return this.plansRepository.findOneBy({ id });
  }

  async update(id: string, updateDto: UpdateHarvestPlanDto) {
    await this.plansRepository.update(id, updateDto);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.plansRepository.delete(id);
  }

  async completePlan(id: string, payload: CompletePlanDto) {
    // Load with the pond relation so the farm for the money-writing Transaction
    // below is resolved server-side — never trust a client-supplied farmId here.
    const plan = await this.plansRepository.findOne({
      where: { id },
      relations: ['pond'],
    });
    if (!plan) {
      throw new NotFoundException('Harvest plan not found');
    }
    // Idempotency: a double-tap or offline retry of complete must not book the
    // harvest-sale income twice into the farm P&L.
    if (plan.status === 'completed') {
      throw new ConflictException('Harvest plan is already completed');
    }

    const actualRevenue = payload.actualWeightKg * payload.actualPricePerKg;

    await this.plansRepository.update(id, {
      actualHarvestDate: payload.actualHarvestDate,
      actualWeightKg: payload.actualWeightKg,
      actualPricePerKg: payload.actualPricePerKg,
      actualRevenue,
      status: 'completed',
    });

    await this.transactionsRepository.save(
      this.transactionsRepository.create({
        farmId: plan.pond.farmId,
        transactionDate: payload.actualHarvestDate,
        type: 'income',
        category: 'harvest_sale',
        amount: actualRevenue,
        description: `Harvest sale from plan ${plan.id}`,
      }),
    );

    // Use the crop already linked to this (ownership-checked) plan — not a
    // client-supplied cropId — so completing a plan can't overwrite an
    // arbitrary crop in another farm.
    if (plan.cropId) {
      // 'completed', not 'harvested'. The crop entity documents the vocabulary
      // as active | completed | cancelled, and every other close path writes
      // 'completed' — this one invented a fourth word that nothing else
      // recognises, so a plan-completed cycle stayed "not completed" to the
      // idempotency guard, the reports and the active-cycle checks alike.
      await this.cropsRepository.update(plan.cropId, {
        actualHarvestDate: payload.actualHarvestDate,
        harvestWeightKg: payload.actualWeightKg,
        status: 'completed',
      });

      // And FREE THE POND. This is what made the feature feel like it did
      // nothing: the plan went green, the money was booked, and the pond still
      // held the cycle it had just been harvested out of — still stocked, still
      // being fed, still counted as active everywhere. Harvesting a pond is
      // exactly the event that empties it, and the other close path
      // (CropsService.closeCycle) has always done this.
      await this.pondsRepository.update(
        { id: plan.pondId, activeCycleId: plan.cropId },
        { activeCycleId: null, status: 'fallow' } as any,
      );
    }

    return this.findOne(id);
  }

  async getCycleSummary(pondId: string, farmId: string) {
    // Scope to THIS pond, not the whole farm. Transactions carry no pond/crop
    // link, so source pond-scoped economics from the same tables PnL uses:
    // expenses (pondId) and harvest sale revenue (via crop.pondId).
    // ponytail: this mirrors getCycleFinancials/PnL basis; plan-completion
    // income that completePlan writes to `transactions` (no pond column) is
    // out of this basis — unify the two revenue paths if that matters.
    const revenue = await this.harvestsRepository
      .createQueryBuilder('h')
      .innerJoin('h.crop', 'crop')
      .select('SUM(h.salePriceTotal)', 'total')
      .where('crop.pondId = :pondId', { pondId })
      .getRawOne();

    const expenses = await this.expensesRepository
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.pondId = :pondId', { pondId })
      .getRawOne();

    const totalRevenue = round2(Number(revenue?.total || 0));
    const totalExpense = round2(Number(expenses?.total || 0));

    // Only return a plan that actually belongs to the requested (guard-checked)
    // farm — pondId alone isn't authorized, so it must be cross-checked against farmId.
    const plan = await this.plansRepository
      .createQueryBuilder('hp')
      .innerJoin('hp.pond', 'pond')
      .where('hp.pondId = :pondId', { pondId })
      .andWhere('pond.farmId = :farmId', { farmId })
      .orderBy('hp.createdAt', 'DESC')
      .getOne();

    return {
      pondId,
      totalRevenue,
      totalExpense,
      netProfit: round2(totalRevenue - totalExpense),
      latestPlan: plan,
    };
  }
}
