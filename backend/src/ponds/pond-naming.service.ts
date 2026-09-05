import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Pond } from './pond.entity';

export interface GeneratedPondName {
  name: string;
  pondCode: string;
  sequenceNumber: number;
}

@Injectable()
export class PondNamingService {
  private static readonly MAX_PONDS_PER_FARM = 500;

  constructor(
    @InjectRepository(Pond)
    private pondsRepository: Repository<Pond>,
  ) {}

  /**
   * Get the next available sequence number for a prefix within a farm.
   * Respects gaps — never reuses deleted sequence numbers.
   */
  async getNextSequenceNumber(farmId: string, prefix: string): Promise<number> {
    const result = await this.pondsRepository
      .createQueryBuilder('pond')
      .select('MAX(pond.sequence_number)', 'maxSeq')
      .where('pond.farm_id = :farmId', { farmId })
      .andWhere('pond.name_prefix = :prefix', { prefix: prefix.toUpperCase() })
      .getRawOne();

    return (result?.maxSeq ?? 0) + 1;
  }

  /**
   * Get the current count of ponds in a farm (excluding archived).
   */
  async getPondCount(farmId: string): Promise<number> {
    // Archived ponds must not consume the 500-pond budget — the doc comment
    // always said "excluding archived", the query never did.
    return this.pondsRepository.count({
      where: { farmId, status: Not('archived') },
    });
  }

  /**
   * Validate that adding `count` ponds won't exceed the farm limit.
   */
  async validatePondLimit(farmId: string, count: number): Promise<void> {
    const currentCount = await this.getPondCount(farmId);
    if (currentCount + count > PondNamingService.MAX_PONDS_PER_FARM) {
      throw new ConflictException({
        error: 'pond_limit_reached',
        current: currentCount,
        limit: PondNamingService.MAX_PONDS_PER_FARM,
        requested: count,
        message: `Farm pond limit is ${PondNamingService.MAX_PONDS_PER_FARM}. Current: ${currentCount}, requested: ${count}.`,
      });
    }
  }

  /**
   * Generate a single pond name with the given prefix.
   */
  async generateName(
    farmId: string,
    farmCode: string,
    prefix: string,
  ): Promise<GeneratedPondName> {
    const normalizedPrefix = prefix.toUpperCase();
    const seqNum = await this.getNextSequenceNumber(farmId, normalizedPrefix);
    const paddedNum = String(seqNum).padStart(2, '0');

    return {
      name: `${normalizedPrefix}${paddedNum}`,
      pondCode: `${farmCode}:${normalizedPrefix}${paddedNum}`,
      sequenceNumber: seqNum,
    };
  }

  /**
   * Generate names for a batch of ponds.
   * Returns names in sequential order starting from the next available number.
   */
  async generateBatchNames(
    farmId: string,
    farmCode: string,
    prefix: string,
    count: number,
  ): Promise<GeneratedPondName[]> {
    if (count < 1 || count > 50) {
      throw new ConflictException('Batch count must be between 1 and 50');
    }

    await this.validatePondLimit(farmId, count);

    const normalizedPrefix = prefix.toUpperCase();
    const startSeq = await this.getNextSequenceNumber(farmId, normalizedPrefix);

    const names: GeneratedPondName[] = [];
    for (let i = 0; i < count; i++) {
      const seqNum = startSeq + i;
      const paddedNum = String(seqNum).padStart(2, '0');
      names.push({
        name: `${normalizedPrefix}${paddedNum}`,
        pondCode: `${farmCode}:${normalizedPrefix}${paddedNum}`,
        sequenceNumber: seqNum,
      });
    }

    return names;
  }

  /**
   * Validate that a prefix follows the rules: 1-4 alphanumeric characters.
   */
  validatePrefix(prefix: string): void {
    if (!prefix || prefix.length < 1 || prefix.length > 4) {
      throw new ConflictException('Prefix must be 1-4 characters');
    }
    if (!/^[A-Za-z0-9]+$/.test(prefix)) {
      throw new ConflictException('Prefix must be alphanumeric only');
    }
  }
}
