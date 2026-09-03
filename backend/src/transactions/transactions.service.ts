import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Transaction } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';

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

  private async findOwned(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneBy({ id });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    // Throws Forbidden/NotFound unless the caller may view this farm's financials.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      transaction.farmId,
      'VIEW_FINANCIALS',
    );
    return transaction;
  }

  findOne(id: string, userId: string) {
    return this.findOwned(id, userId);
  }

  async update(id: string, updateDto: UpdateTransactionDto, userId: string) {
    await this.findOwned(id, userId);
    // Never allow re-pointing a transaction at a farm the caller can't manage financially.
    if (updateDto.farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        updateDto.farmId,
        'VIEW_FINANCIALS',
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
    await this.findOwned(id, userId);
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
