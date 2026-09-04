import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Transaction } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmCapability } from '../farm-access/farm-capability';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateTransactionDto, userId: string) {
    // Idempotent replay guard for offline-queue drains — a retried timed-out
    // POST must not double-record. Verify the caller can view the found row's
    // farm financials BEFORE returning it so a guessed id can't leak another
    // farm's transaction.
    if (createDto.id) {
      const existing = await this.transactionsRepository.findOneBy({
        id: createDto.id,
      });
      if (existing) {
        await this.farmAccess.assertCanAccessFarm(
          userId,
          existing.farmId,
          'VIEW_FINANCIALS',
        );
        return existing;
      }
    }

    // Financials are owner/manager only (VIEW_FINANCIALS); workers/viewers denied.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      createDto.farmId,
      'VIEW_FINANCIALS',
    );
    // Stamp the actor so money rows say who entered them.
    const transaction = this.transactionsRepository.create({
      ...createDto,
      createdById: userId,
      updatedById: userId,
    });
    return this.transactionsRepository.save(transaction);
  }

  /**
   * INTERNAL, unchecked — no VIEW_FINANCIALS assert. Mirrors
   * InventoryService.countLowStock: exists for another module (currently
   * only an inventory purchase) that has already authorized the write under
   * ITS OWN capability (e.g. MANAGE_INVENTORY) and must not be forced to
   * also hold VIEW_FINANCIALS, a financial READ capability, just to record
   * the money it just spent. The CALLER is responsible for authorization —
   * this method trusts it completely. Do not expose this over HTTP.
   */
  async createInternal(createDto: CreateTransactionDto, userId: string) {
    const transaction = this.transactionsRepository.create({
      ...createDto,
      createdById: userId,
      updatedById: userId,
    });
    return this.transactionsRepository.save(transaction);
  }

  async findAll(userId: string, farmId?: string, type?: string) {
    const where: any = {};
    if (type) where.type = type;

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        farmId,
        'VIEW_FINANCIALS',
      );
      where.farmId = farmId;
    } else {
      // Restrict to farms where the caller may view financials (owner/manager).
      const farmIds = await this.farmAccess.getFarmIdsWithCapability(
        userId,
        'VIEW_FINANCIALS',
      );
      if (farmIds.length === 0) return [];
      where.farmId = In(farmIds);
    }

    return this.transactionsRepository.find({
      where,
      order: { transactionDate: 'DESC' },
    });
  }

  private async findWithCapability(
    id: string,
    userId: string,
    capability: FarmCapability,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneBy({ id });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    // Throws Forbidden/NotFound unless the caller holds this capability on the farm.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      transaction.farmId,
      capability,
    );
    return transaction;
  }

  private findOwned(id: string, userId: string): Promise<Transaction> {
    return this.findWithCapability(id, userId, 'VIEW_FINANCIALS');
  }

  findOne(id: string, userId: string) {
    return this.findOwned(id, userId);
  }

  async update(id: string, updateDto: UpdateTransactionDto, userId: string) {
    // Rewriting money is a write, not a view — gated on WRITE_MANAGEMENT, not
    // VIEW_FINANCIALS (which anyone with read access to financials also has).
    await this.findWithCapability(id, userId, 'WRITE_MANAGEMENT');
    // Never allow re-pointing a transaction at a farm the caller can't manage financially.
    if (updateDto.farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        updateDto.farmId,
        'WRITE_MANAGEMENT',
      );
    }
    // `id` rides on the DTO for create-time idempotency only — spreading it
    // into an UPDATE would reassign the primary key.
    const { id: _id, ...columns } = updateDto;
    await this.transactionsRepository.update(id, {
      ...columns,
      updatedById: userId,
    });
    return this.transactionsRepository.findOneBy({ id });
  }

  async remove(id: string, userId: string) {
    // Hard delete — same reasoning as update: erasing money is a write.
    await this.findWithCapability(id, userId, 'WRITE_MANAGEMENT');
    return this.transactionsRepository.delete(id);
  }

  async getSummaryByFarm(farmId: string, userId: string) {
    await this.farmAccess.assertCanAccessFarm(
      userId,
      farmId,
      'VIEW_FINANCIALS',
    );
    const income = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.farmId = :farmId', { farmId })
      .andWhere('t.type = :type', { type: 'income' })
      .getRawOne();

    const expense = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.farmId = :farmId', { farmId })
      .andWhere('t.type = :type', { type: 'expense' })
      .getRawOne();

    return {
      totalIncome: Number(income?.total || 0),
      totalExpense: Number(expense?.total || 0),
      netProfit: Number(income?.total || 0) - Number(expense?.total || 0),
    };
  }
}
