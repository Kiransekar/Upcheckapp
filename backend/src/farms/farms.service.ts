import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { randomBytes } from 'crypto';
import { Farm } from './farm.entity';
import { Crop } from '../crops/crop.entity';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmMember } from '../farm-access/farm-member.entity';
import {
  FarmCapability,
  RolePolicy,
  invalidPolicyKey,
} from '../farm-access/farm-capability';

@Injectable()
export class FarmsService {
  constructor(
    @InjectRepository(Farm)
    private farmsRepository: Repository<Farm>,
    @InjectRepository(FarmMember)
    private readonly farmMembersRepository: Repository<FarmMember>,
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
    const saved = await this.farmsRepository.save(farm);

    // Give the owner a real membership row.
    //
    // Ownership has been carried by `farm.userId` alone, with every capability
    // check falling back to an owner fast-path. That is fine for authorization
    // but it makes the owner INVISIBLE to anything that reads the roster:
    // listMembers returned everyone except the person who owns the farm. Hence
    // "1 of 0 checked in today" — the owner checked themselves in, but the
    // denominator counts members and the owner was not one of them.
    //
    // Best-effort on purpose: a farm without this row behaves exactly as it did
    // before, because the fast-path is untouched. Failing to write it must not
    // fail the farm creation that already succeeded.
    try {
      await this.farmMembersRepository.insert({
        farmId: saved.id,
        userId,
        role: 'owner',
        status: 'active',
      } as any);
    } catch {
      // Already present, or farm_members has not been migrated in this env.
    }

    return saved;
  }

  /**
   * Farms the user can access — owned plus any they're a member (worker) of.
   *
   * Archived farms are excluded unless `includeArchived` is set: archiving
   * exists so a finished farm stops cluttering every picker, list and engine,
   * and a default that still returned them would make the action decorative.
   */
  async findAll(userId: string, includeArchived = false) {
    // `includeArchived` MUST be threaded into the access lookup, not just the
    // where-clause below. getAccessibleFarmIds defaults to excluding archived
    // farms, so omitting it here filtered them out of `farmIds` first and the
    // where-clause was then choosing between two archive-free sets — making
    // `?includeArchived=true` return an empty list, always. The "include
    // archived" toggle on the farms list looked broken because it was.
    const farmIds = await this.farmAccess.getAccessibleFarmIds(
      userId,
      includeArchived,
    );
    if (farmIds.length === 0) return [];
    return this.farmsRepository.find({
      where: includeArchived
        ? { id: In(farmIds) }
        : { id: In(farmIds), archivedAt: IsNull() },
    });
  }

  /**
   * Farms the user OWNS (strict). Used by economic listings (e.g. transactions)
   * that must never surface a member-farm owner's financial data to a worker.
   * Archived farms are excluded, same as findAll.
   */
  async findOwnedByUser(userId: string) {
    return this.farmsRepository.find({
      where: { userId, archivedAt: IsNull() },
    });
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

  /**
   * Set this farm's per-role capability defaults. Owner only — a manager who
   * could widen their own role would make the policy decorative.
   *
   * Stored whole (null clears it), because a partial merge would give an owner
   * no way to take a grant back.
   */
  async setRolePolicy(farmId: string, callerId: string, policy: RolePolicy | null) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');
    const bad = invalidPolicyKey(policy);
    if (bad) {
      throw new BadRequestException(
        `"${bad}" is not a role/permission that can be set by policy`,
      );
    }
    const rolePolicy = policy && Object.keys(policy).length > 0 ? policy : null;
    await this.farmsRepository.update(farmId, { rolePolicy });
    return { farmId, rolePolicy };
  }

  /**
   * Archive a farm. Owner only — the route guard says so and this says it
   * again, because the guard is a declaration and the service is the
   * enforcement (same reasoning as setRolePolicy).
   */
  async archive(id: string, callerId: string) {
    const farm = await this.farmAccess.assertCanAccessFarm(
      callerId,
      id,
      'OWNER_ONLY',
    );
    if (farm.archivedAt) {
      throw new BadRequestException('Farm is already archived');
    }
    await this.farmsRepository.update(id, { archivedAt: new Date() });
    return { message: 'Farm archived successfully' };
  }

  async unarchive(id: string, callerId: string) {
    const farm = await this.farmAccess.assertCanAccessFarm(
      callerId,
      id,
      'OWNER_ONLY',
    );
    if (!farm.archivedAt) {
      throw new BadRequestException('Farm is not archived');
    }
    await this.farmsRepository.update(id, { archivedAt: null });
    return { message: 'Farm unarchived successfully' };
  }

  async remove(id: string, callerId: string) {
    await this.farmAccess.assertCanAccessFarm(callerId, id, 'OWNER_ONLY');

    // Mirrors the pond rule (PondsService.remove): a farm whose ponds have
    // held crops carries production history, and deleting it takes that with
    // it. Archive is the reversible action; delete is only for a farm that was
    // never really used. Crops carry `farm_id`, so this is one count rather
    // than a join through ponds.
    const cropCount = await this.farmsRepository.manager
      .getRepository(Crop)
      .count({ where: { farmId: id } });
    if (cropCount > 0) {
      throw new ConflictException({
        error: 'crop_history_exists',
        message: 'Cannot delete a farm with crop history — archive it instead',
      });
    }

    // Soft delete
    await this.farmsRepository.update(id, { deletedAt: new Date() });
    return { message: 'Farm deleted successfully' };
  }
}
