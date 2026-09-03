import { DataSource } from 'typeorm';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

describe('FarmsController', () => {
  let controller: FarmsController;
  let farmsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    archive: jest.Mock;
    unarchive: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    farmsService = {
      create: jest.fn().mockResolvedValue({ id: 'farm-new' }),
      findAll: jest.fn().mockResolvedValue([]),
      archive: jest.fn().mockResolvedValue({ message: 'ok' }),
      unarchive: jest.fn().mockResolvedValue({ message: 'ok' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FarmsController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        { provide: FarmsService, useValue: farmsService },
        { provide: DataSource, useValue: {} },
        {
          provide: FarmAccessService,
          useValue: {
            getRoleOnFarm: jest.fn().mockResolvedValue('owner'),
            assertCanAccessFarm: jest.fn(),
            assertCanAccessPond: jest.fn(),
            getAccessibleFarmIds: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: 'EmailService', useValue: {} },
        { provide: 'PondsService', useValue: {} },
        { provide: 'InventoryService', useValue: {} },
      ],
    }).compile();

    controller = module.get<FarmsController>(FarmsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // W3 — `create` used to throw ForbiddenException when
  // `user.accountType === 'worker'`. That was the ONLY authorization decision
  // in the backend that read the global account flag, and it never actually
  // held: `account_type` lived in client-mutable Supabase user_metadata. It
  // also contradicted the per-farm role model — the same account could be
  // handed full ownership of an existing farm via transferOwnership while
  // being blocked from creating one of its own.
  describe('create — open to every account', () => {
    it('creates the farm for a user with no accountType at all', async () => {
      await expect(
        controller.create({ name: 'New Farm' } as any, { id: 'user-1' }),
      ).resolves.toEqual({ id: 'farm-new' });
      expect(farmsService.create).toHaveBeenCalledWith(
        { name: 'New Farm' },
        'user-1',
      );
    });

    it('creates the farm even for a user still carrying a stale worker flag', async () => {
      // Old sessions may still have `account_type: 'worker'` in their Supabase
      // metadata. The guard no longer reads it onto req.user, but prove the
      // controller ignores it even if something puts it back.
      await expect(
        controller.create({ name: 'Leased Pond' } as any, {
          id: 'user-2',
          accountType: 'worker',
        }),
      ).resolves.toEqual({ id: 'farm-new' });
      expect(farmsService.create).toHaveBeenCalledWith(
        { name: 'Leased Pond' },
        'user-2',
      );
    });
  });

  describe('listing and lifecycle', () => {
    it('excludes archived farms unless includeArchived=true is asked for', async () => {
      await controller.findAll({ id: 'user-1' });
      expect(farmsService.findAll).toHaveBeenCalledWith('user-1', false);

      await controller.findAll({ id: 'user-1' }, 'true');
      expect(farmsService.findAll).toHaveBeenCalledWith('user-1', true);

      // Anything else is not the flag — a stray `?includeArchived=1` must not
      // silently widen the listing.
      await controller.findAll({ id: 'user-1' }, '1');
      expect(farmsService.findAll).toHaveBeenLastCalledWith('user-1', false);
    });

    it('passes the caller through to the owner-only lifecycle actions', async () => {
      await controller.archive('farm-1', { id: 'user-1' });
      expect(farmsService.archive).toHaveBeenCalledWith('farm-1', 'user-1');

      await controller.unarchive('farm-1', { id: 'user-1' });
      expect(farmsService.unarchive).toHaveBeenCalledWith('farm-1', 'user-1');

      await controller.remove('farm-1', { id: 'user-1' });
      expect(farmsService.remove).toHaveBeenCalledWith('farm-1', 'user-1');
    });
  });
});
