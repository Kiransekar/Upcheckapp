import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './attendance.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let farmAccess: { assertCanAccessFarm: jest.Mock };

  beforeEach(async () => {
    attendanceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    farmAccess = { assertCanAccessFarm: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(AttendanceRecord), useValue: attendanceRepo },
        { provide: FarmAccessService, useValue: farmAccess },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  describe('checkIn', () => {
    it('creates a self check-in gated on WRITE_OPERATIONAL', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn('worker-1', { farmId: 'farm-1', id: 'rec-1' });

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('worker-1', 'farm-1', 'WRITE_OPERATIONAL');
      expect(attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rec-1', farmId: 'farm-1', userId: 'worker-1' }),
      );
      expect(result).toEqual(expect.objectContaining({ userId: 'worker-1' }));
    });

    it('requires WRITE_MANAGEMENT to back-fill a different worker\'s check-in', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await service.checkIn('manager-1', { farmId: 'farm-1', userId: 'worker-2', id: 'rec-2' });

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('manager-1', 'farm-1', 'WRITE_MANAGEMENT');
    });

    it('is idempotent on the client-minted id (offline replay)', async () => {
      const existing = { id: 'rec-1', farmId: 'farm-1', userId: 'worker-1' };
      attendanceRepo.findOne.mockResolvedValue(existing);

      const result = await service.checkIn('worker-1', { farmId: 'farm-1', id: 'rec-1' });

      expect(attendanceRepo.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('checkOut', () => {
    it('throws NotFoundException for a missing record', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);
      await expect(service.checkOut('worker-1', 'rec-1', {})).rejects.toThrow(NotFoundException);
    });

    it('allows the worker to check themselves out', async () => {
      attendanceRepo.findOne.mockResolvedValue({ id: 'rec-1', farmId: 'farm-1', userId: 'worker-1', checkOutAt: null });

      const result = await service.checkOut('worker-1', 'rec-1', {});

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('worker-1', 'farm-1', 'WRITE_OPERATIONAL');
      expect(result.checkOutAt).toBeInstanceOf(Date);
    });

    it("requires WRITE_MANAGEMENT to check out someone else's record", async () => {
      attendanceRepo.findOne.mockResolvedValue({ id: 'rec-1', farmId: 'farm-1', userId: 'worker-2', checkOutAt: null });

      await service.checkOut('manager-1', 'rec-1', {});

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('manager-1', 'farm-1', 'WRITE_MANAGEMENT');
    });

    it('propagates a ForbiddenException when the caller lacks access', async () => {
      attendanceRepo.findOne.mockResolvedValue({ id: 'rec-1', farmId: 'farm-1', userId: 'worker-2', checkOutAt: null });
      farmAccess.assertCanAccessFarm.mockRejectedValue(new ForbiddenException());

      await expect(service.checkOut('worker-1', 'rec-1', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findMine / findAllForFarm', () => {
    it('findMine scopes the query to the caller\'s own records', async () => {
      attendanceRepo.find.mockResolvedValue([]);

      await service.findMine('worker-1', 'farm-1');

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('worker-1', 'farm-1', 'READ');
      expect(attendanceRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ farmId: 'farm-1', userId: 'worker-1' }) }),
      );
    });

    // The month calendar asks for a whole month in one request. Without a
    // range the screen would fire 31 single-day calls to paint itself.
    it('filters on an inclusive IST day range when given from/to', async () => {
      attendanceRepo.find.mockResolvedValue([]);

      await service.findAllForFarm('owner-1', 'farm-1', undefined, '2026-08-01', '2026-08-31');

      const where = attendanceRepo.find.mock.calls[0][0].where;
      expect(where.checkInAt).toBeDefined();
      // Between(start, end) — IST midnight on the 1st through IST 23:59:59.999
      // on the 31st, expressed in UTC.
      const [start, end] = where.checkInAt.value;
      expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-08-31T18:29:59.999Z');
    });

    it('applies no date filter at all when neither date nor range is given', async () => {
      attendanceRepo.find.mockResolvedValue([]);

      await service.findMine('worker-1', 'farm-1');

      expect(attendanceRepo.find.mock.calls[0][0].where.checkInAt).toBeUndefined();
    });

    it('findAllForFarm requires WRITE_MANAGEMENT (owner/manager only)', async () => {
      attendanceRepo.find.mockResolvedValue([]);

      await service.findAllForFarm('manager-1', 'farm-1');

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('manager-1', 'farm-1', 'WRITE_MANAGEMENT');
    });

    it('findMine degrades to an empty array when the table is missing (42P01)', async () => {
      attendanceRepo.find.mockRejectedValue({ code: '42P01' });

      const result = await service.findMine('worker-1', 'farm-1');

      expect(result).toEqual([]);
    });
  });
});
