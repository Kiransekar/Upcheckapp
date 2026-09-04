import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './leave-request.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmMember } from '../farm-access/farm-member.entity';
import { PushService } from '../push/push.service';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let leaveRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let membersRepo: { find: jest.Mock };
  let farmAccess: { assertCanAccessFarm: jest.Mock };
  let push: { sendToUser: jest.Mock };

  const FARM = { id: 'farm-1', userId: 'owner-1' };

  beforeEach(async () => {
    leaveRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    membersRepo = { find: jest.fn().mockResolvedValue([{ userId: 'manager-1' }]) };
    farmAccess = { assertCanAccessFarm: jest.fn().mockResolvedValue(FARM) };
    push = { sendToUser: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: leaveRepo },
        { provide: getRepositoryToken(FarmMember), useValue: membersRepo },
        { provide: FarmAccessService, useValue: farmAccess },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(LeaveRequestsService);
  });

  describe('create', () => {
    it('creates a pending request for the caller, gated on WRITE_OPERATIONAL', async () => {
      leaveRepo.findOne.mockResolvedValue(null);

      const result = await service.create('worker-1', {
        id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03', reason: 'Family event',
      });

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('worker-1', 'farm-1', 'WRITE_OPERATIONAL');
      expect(leaveRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'req-1', farmId: 'farm-1', userId: 'worker-1', status: 'pending',
      }));
      expect(result).toEqual(expect.objectContaining({ status: 'pending' }));
    });

    it('rejects endDate before startDate', async () => {
      leaveRepo.findOne.mockResolvedValue(null);

      await expect(service.create('worker-1', {
        farmId: 'farm-1', startDate: '2026-08-05', endDate: '2026-08-01',
      })).rejects.toThrow(BadRequestException);
    });

    it('is idempotent on the client-minted id (offline replay)', async () => {
      const existing = { id: 'req-1', farmId: 'farm-1', userId: 'worker-1', status: 'pending' };
      leaveRepo.findOne.mockResolvedValue(existing);

      const result = await service.create('worker-1', {
        id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03',
      });

      expect(leaveRepo.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    describe('push on submit', () => {
      it('notifies the owner and every active manager, unconditionally', async () => {
        leaveRepo.findOne.mockResolvedValue(null);

        await service.create('worker-1', {
          id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03',
        });

        expect(push.sendToUser).toHaveBeenCalledWith('owner-1', expect.anything());
        expect(push.sendToUser).toHaveBeenCalledWith('manager-1', expect.anything());
      });

      it('does not push on an offline-replay hit — the guard returns before the save', async () => {
        const existing = { id: 'req-1', farmId: 'farm-1', userId: 'worker-1', status: 'pending' };
        leaveRepo.findOne.mockResolvedValue(existing);

        await service.create('worker-1', {
          id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03',
        });

        expect(push.sendToUser).not.toHaveBeenCalled();
      });

      it('does not fail the request when the push fails', async () => {
        leaveRepo.findOne.mockResolvedValue(null);
        push.sendToUser.mockResolvedValue(false);

        await expect(service.create('worker-1', {
          id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03',
        })).resolves.toBeDefined();
      });

      it('does not fail the request when resolving recipients throws', async () => {
        leaveRepo.findOne.mockResolvedValue(null);
        membersRepo.find.mockRejectedValue(new Error('db down'));

        await expect(service.create('worker-1', {
          id: 'req-1', farmId: 'farm-1', startDate: '2026-08-01', endDate: '2026-08-03',
        })).resolves.toBeDefined();
      });
    });
  });

  describe('findMine / findAllForFarm', () => {
    it('findMine scopes to the caller\'s own requests', async () => {
      leaveRepo.find.mockResolvedValue([]);
      await service.findMine('worker-1', 'farm-1');
      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('worker-1', 'farm-1', 'READ');
      expect(leaveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId: 'farm-1', userId: 'worker-1' } }),
      );
    });

    it('findAllForFarm requires WRITE_MANAGEMENT', async () => {
      leaveRepo.find.mockResolvedValue([]);
      await service.findAllForFarm('manager-1', 'farm-1', 'pending');
      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('manager-1', 'farm-1', 'WRITE_MANAGEMENT');
      expect(leaveRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId: 'farm-1', status: 'pending' } }),
      );
    });

    it('degrades to an empty array when the table is missing (42P01)', async () => {
      leaveRepo.find.mockRejectedValue({ code: '42P01' });
      const result = await service.findMine('worker-1', 'farm-1');
      expect(result).toEqual([]);
    });
  });

  describe('decide', () => {
    it('throws NotFoundException for a missing request', async () => {
      leaveRepo.findOne.mockResolvedValue(null);
      await expect(service.decide('manager-1', 'req-1', 'approved')).rejects.toThrow(NotFoundException);
    });

    it('approves a pending request, gated on WRITE_MANAGEMENT', async () => {
      leaveRepo.findOne.mockResolvedValue({ id: 'req-1', farmId: 'farm-1', userId: 'worker-1', status: 'pending' });

      const result = await service.decide('manager-1', 'req-1', 'approved');

      expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith('manager-1', 'farm-1', 'WRITE_MANAGEMENT');
      expect(result.status).toBe('approved');
      expect(result.decidedById).toBe('manager-1');
      expect(result.decidedAt).toBeInstanceOf(Date);
    });

    it('rejects re-deciding an already-decided request', async () => {
      leaveRepo.findOne.mockResolvedValue({ id: 'req-1', farmId: 'farm-1', userId: 'worker-1', status: 'approved' });

      await expect(service.decide('manager-1', 'req-1', 'rejected')).rejects.toThrow(ConflictException);
    });
  });
});
