import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveRequestStatus } from './leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';

/**
 * Postgres "undefined_table" (42P01) — same pattern as attendance.service.ts:
 * leave_requests is a brand-new table, so reads degrade to empty rather than
 * 500ing during a deploy-before-migrate window.
 */
/**
 * Only what is needed to render a name. A bare relation load selects every
 * mapped User column (password_hash included, plus any column a not-yet-run
 * migration has not created). Mirrors farm-members.service.ts.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
} as const;

function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /** Submit a leave request for the caller's own account. */
  async create(callerId: string, dto: CreateLeaveRequestDto) {
    if (dto.id) {
      const existing = await this.leaveRepo.findOne({ where: { id: dto.id } });
      if (existing) {
        await this.farmAccess.assertCanAccessFarm(
          callerId,
          existing.farmId,
          'READ',
        );
        return existing;
      }
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    await this.farmAccess.assertCanAccessFarm(
      callerId,
      dto.farmId,
      'WRITE_OPERATIONAL',
    );

    const record = this.leaveRepo.create({
      id: dto.id,
      farmId: dto.farmId,
      userId: callerId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason ?? null,
      status: 'pending',
    });
    return this.leaveRepo.save(record);
  }

  /** The caller's own leave requests for a farm, most recent first. */
  async findMine(callerId: string, farmId: string) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'READ');
    try {
      return await this.leaveRepo.find({
        where: { farmId, userId: callerId },
        order: { createdAt: 'DESC' },
        relations: { user: true },
        select: { user: PUBLIC_USER_SELECT },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'leave_requests table missing — run migrations; returning empty',
      );
      return [];
    }
  }

  /** Every member's leave requests for a farm (owner/manager only). */
  async findAllForFarm(callerId: string, farmId: string, status?: string) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'WRITE_MANAGEMENT',
    );
    try {
      return await this.leaveRepo.find({
        where: { farmId, ...(status ? { status: status as LeaveRequestStatus } : {}) },
        order: { createdAt: 'DESC' },
        relations: { user: true },
        select: { user: PUBLIC_USER_SELECT },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'leave_requests table missing — run migrations; returning empty',
      );
      return [];
    }
  }

  /** Owner/manager approves or rejects a pending request. */
  async decide(callerId: string, id: string, status: 'approved' | 'rejected') {
    const record = await this.leaveRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Leave request not found');
    }
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      record.farmId,
      'WRITE_MANAGEMENT',
    );
    if (record.status !== 'pending') {
      throw new ConflictException(
        `This request has already been ${record.status}`,
      );
    }

    record.status = status;
    record.decidedById = callerId;
    record.decidedAt = new Date();
    return this.leaveRepo.save(record);
  }
}
