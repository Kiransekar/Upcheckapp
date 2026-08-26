import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AttendanceRecord } from './attendance.entity';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { istDayRangeUtc } from '../common/ist-date';

/**
 * Only the fields needed to show a name. A bare relation load selects every
 * mapped User column — including password_hash, and including columns a
 * not-yet-run migration may not have created. Mirrors PUBLIC_USER_SELECT in
 * farm-members.service.ts.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
} as const;

/**
 * Postgres "undefined_table" (42P01) — same pattern as farm-access.service.ts
 * and disease.service.ts: attendance_records is a brand-new table, so a
 * deploy-before-migrate window is possible. Reads degrade to empty rather
 * than 500ing; writes naturally fail until the migration runs (there's
 * nothing safe to write to).
 */
function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Check in. Defaults to the caller's own record; a manager/owner may
   * back-fill a different worker's check-in by supplying userId, gated on
   * WRITE_MANAGEMENT. Idempotent on the client-minted id (offline replay).
   */
  async checkIn(callerId: string, dto: CheckInDto) {
    if (dto.id) {
      const existing = await this.attendanceRepo.findOne({
        where: { id: dto.id },
      });
      if (existing) {
        await this.farmAccess.assertCanAccessFarm(
          callerId,
          existing.farmId,
          'WRITE_OPERATIONAL',
        );
        return existing;
      }
    }

    const targetUserId = dto.userId ?? callerId;
    if (targetUserId !== callerId) {
      await this.farmAccess.assertCanAccessFarm(
        callerId,
        dto.farmId,
        'WRITE_MANAGEMENT',
      );
    } else {
      await this.farmAccess.assertCanAccessFarm(
        callerId,
        dto.farmId,
        'WRITE_OPERATIONAL',
      );
    }

    const record = this.attendanceRepo.create({
      id: dto.id,
      farmId: dto.farmId,
      userId: targetUserId,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
    });
    return this.attendanceRepo.save(record);
  }

  /**
   * Check out. Own record always allowed; checking out someone else's
   * requires WRITE_MANAGEMENT (owner/manager correcting a worker's record).
   */
  async checkOut(callerId: string, id: string, dto: CheckOutDto) {
    const record = await this.attendanceRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }
    if (record.userId !== callerId) {
      await this.farmAccess.assertCanAccessFarm(
        callerId,
        record.farmId,
        'WRITE_MANAGEMENT',
      );
    } else {
      await this.farmAccess.assertCanAccessFarm(
        callerId,
        record.farmId,
        'WRITE_OPERATIONAL',
      );
    }

    record.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : new Date();
    return this.attendanceRepo.save(record);
  }

  /** The caller's own attendance records for a farm, most recent first. */
  async findMine(callerId: string, farmId: string, date?: string) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'READ');
    try {
      return await this.attendanceRepo.find({
        where: {
          farmId,
          userId: callerId,
          ...(date ? { checkInAt: dayRange(date) } : {}),
        },
        order: { checkInAt: 'DESC' },
        relations: { user: true },
        select: { user: PUBLIC_USER_SELECT },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'attendance_records table missing — run migrations; returning empty',
      );
      return [];
    }
  }

  /** Every farm member's attendance for a farm (owner/manager only). */
  async findAllForFarm(callerId: string, farmId: string, date?: string) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'WRITE_MANAGEMENT',
    );
    try {
      return await this.attendanceRepo.find({
        where: {
          farmId,
          ...(date ? { checkInAt: dayRange(date) } : {}),
        },
        order: { checkInAt: 'DESC' },
        relations: { user: true },
        select: { user: PUBLIC_USER_SELECT },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'attendance_records table missing — run migrations; returning empty',
      );
      return [];
    }
  }
}

/** [00:00, 24:00) UTC range for a plain `YYYY-MM-DD` day string. */
function dayRange(date: string) {
  const { start, end } = istDayRangeUtc(date);
  return Between(start, end);
}
