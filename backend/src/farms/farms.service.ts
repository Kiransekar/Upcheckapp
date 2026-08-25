import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { Farm } from './farm.entity';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmCapability } from '../farm-access/farm-capability';

@Injectable()
export class FarmsService {
  constructor(
    @InjectRepository(Farm)
    private farmsRepository: Repository<Farm>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Verify that the user OWNS the farm (strict). Returns the farm or throws.
   * Used for owner-only operations (economics, farm/pond lifecycle).
   */
  async verifyOwnership(farmId: string, userId: string): Promise<Farm> {
    const farm = await this.farmsRepository.findOneBy({ id: farmId });
    if (!farm) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }
    if (farm.deletedAt) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }
    if (farm.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this farm',
      );
    }
    return farm;
  }

  /**
   * Member-aware access check: passes for owner OR worker per the requested
   * capability. Use for worker-permitted reads/writes (e.g. viewing inventory).
   */
  async verifyAccess(
    farmId: string,
    userId: string,
    capability: FarmCapability,
  ): Promise<Farm> {
    return this.farmAccess.assertCanAccessFarm(userId, farmId, capability);
  }

  /**
   * Internal method to fetch farm by ID (e.g. for system alerts)
   */
  async findOneInternal(farmId: string): Promise<Farm | null> {
    return this.farmsRepository.findOneBy({ id: farmId });
  }

  /**
   * Generate a unique 8-character alphanumeric farm code.
   *
   * Throws if it cannot find a free code in 10 attempts. It used to fall out of
   * the loop and return the last (colliding) candidate, which then hit the
   * UNIQUE constraint on insert and surfaced as an opaque driver error — better
   * to fail here, where the cause is obvious.
   */
  private async generateFarmCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I/O/0/1 for readability

    for (let attempts = 0; attempts < 10; attempts++) {
      let code = '';
      const bytes = randomBytes(8);
      for (let i = 0; i < 8; i++) {
        code += chars[bytes[i] % chars.length];
      }
      const existing = await this.farmsRepository.findOneBy({ farmCode: code });
      if (!existing) return code;
    }

    throw new InternalServerErrorException(
      'Could not allocate a unique farm code. Please try again.',
    );
  }

  async create(createFarmDto: CreateFarmDto, userId: string) {
    // Always server-generated — see the NOTE in create-farm.dto.ts.
    const farmCode = await this.generateFarmCode();

    const farm = this.farmsRepository.create({
      name: createFarmDto.name,
      areaHectares: createFarmDto.areaHectares,
      address: createFarmDto.address,
      longitude: createFarmDto.longitude,
      latitude: createFarmDto.latitude,
      waterSourceType: createFarmDto.waterSourceType as any,
      plannedPondCount: createFarmDto.plannedPondCount,
      qrCodeUrl: createFarmDto.qrCodeUrl,
      privacySetting: createFarmDto.privacySetting as any,
      boundary: createFarmDto.boundary,
      userId,
      farmCode,
    });
    return this.farmsRepository.save(farm);
  }

  /** Farms the user can access — owned plus any they're a member (worker) of. */
  async findAll(userId: string) {
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) return [];
    return this.farmsRepository.find({
      where: { id: In(farmIds) },
    });
  }

  /**
   * Farms the user OWNS (strict). Used by economic listings (e.g. transactions)
   * that must never surface a member-farm owner's financial data to a worker.
   */
  async findOwnedByUser(userId: string) {
    return this.farmsRepository.find({ where: { userId } });
  }

  async findOne(id: string) {
    const farm = await this.farmsRepository.findOneBy({ id });
    if (!farm || farm.deletedAt)
      throw new NotFoundException(`Farm with ID ${id} not found`);
    return farm;
  }

  async update(id: string, updateFarmDto: UpdateFarmDto) {
    await this.farmsRepository.update(id, updateFarmDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    // Soft delete
    await this.farmsRepository.update(id, { deletedAt: new Date() });
    return { message: 'Farm archived successfully' };
  }
}
