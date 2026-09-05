import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull } from 'typeorm';
import { FarmsService } from './farms.service';
import { Farm } from './farm.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import {
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('FarmsService', () => {
  let service: FarmsService;
  let repository: any;
  let cropsRepo: any;
  let module: TestingModule;

  const mockFarm: Partial<Farm> = {
    id: 'farm-1',
    userId: 'user-1',
    name: 'Test Farm',
    farmCode: 'TF001234',
    areaHectares: 10.5,
    address: 'Test Address',
    longitude: 80.123,
    latitude: 13.456,
    waterSourceType: 'tidal',
    qrCodeUrl: '',
    privacySetting: 'private',
    deletedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    cropsRepo = { count: jest.fn().mockResolvedValue(0) };
    // remove() reaches the crops table through the farm repository's manager,
    // so it needs no extra constructor dependency.
    repository.manager = { getRepository: jest.fn(() => cropsRepo) };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        FarmsService,
        { provide: getRepositoryToken(Farm), useValue: repository },
        // create() now also writes the owner's farm_members row, so the owner
        // is visible to the roster rather than existing only as farm.userId.
        {
          provide: getRepositoryToken(FarmMember),
          useValue: { insert: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: FarmAccessService,
          useValue: {
            getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
            assertCanAccessFarm: jest.fn().mockResolvedValue(mockFarm),
          },
        },
      ],
    }).compile();

    service = module.get<FarmsService>(FarmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create farm with auto-generated farm code', async () => {
      repository.findOneBy.mockResolvedValue(null); // No collision
      repository.create.mockReturnValue(mockFarm);
      repository.save.mockResolvedValue(mockFarm);

      const result = await service.create({ name: 'New Farm' }, 'user-1');
      expect(result).toEqual(mockFarm);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Farm',
          userId: 'user-1',
        }),
      );
    });

    it('ignores a client-supplied farm code and generates one server-side', async () => {
      repository.create.mockReturnValue(mockFarm);
      repository.save.mockResolvedValue(mockFarm);
      repository.findOneBy.mockResolvedValue(null); // no collision

      // `farmCode` is no longer on CreateFarmDto; the global ValidationPipe
      // strips it in production. Cast here to prove the service ignores it even
      // if one reaches it another way.
      await service.create(
        { name: 'Farm', farmCode: 'CUSTOM01' } as any,
        'user-1',
      );

      const created = repository.create.mock.calls[0][0];
      expect(created.farmCode).not.toBe('CUSTOM01');
      expect(created.farmCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    });

    it('gives the owner a farm_members row, not just farm.userId', async () => {
      // The reported symptom was "1 of 0 checked in today" for an owner who
      // had just checked in. Ownership lived only in farm.userId, so the owner
      // was invisible to listMembers — the denominator counted members and the
      // owner was not one of them.
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(mockFarm);
      repository.save.mockResolvedValue(mockFarm);
      const membersRepo = module.get(getRepositoryToken(FarmMember));

      await service.create({ name: 'New Farm' }, 'user-1');

      expect(membersRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          farmId: 'farm-1',
          userId: 'user-1',
          role: 'owner',
          status: 'active',
        }),
      );
    });

    it('still returns the farm if the membership write fails', async () => {
      // Authorization does not depend on this row — the owner fast-path is
      // untouched — so a failure here must not fail farm creation.
      repository.findOneBy.mockResolvedValue(null);
      repository.create.mockReturnValue(mockFarm);
      repository.save.mockResolvedValue(mockFarm);
      const membersRepo = module.get(getRepositoryToken(FarmMember));
      membersRepo.insert.mockRejectedValueOnce(new Error('duplicate key'));

      await expect(service.create({ name: 'New Farm' }, 'user-1')).resolves.toEqual(
        mockFarm,
      );
    });

    it('throws rather than returning a colliding code after 10 attempts', async () => {
      // Every generated candidate already exists.
      repository.findOneBy.mockResolvedValue(mockFarm);

      await expect(service.create({ name: 'Farm' }, 'user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(repository.findOneBy).toHaveBeenCalledTimes(10);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all accessible farms for user', async () => {
      repository.find.mockResolvedValue([mockFarm]);
      const result = await service.findAll('user-1');
      expect(result).toEqual([mockFarm]);
      // Now scoped to the farm ids the user can access (owner or worker),
      // and archived farms are excluded unless asked for.
      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(['farm-1']), archivedAt: IsNull() },
      });
    });

    it('includes archived farms only when the flag is set', async () => {
      repository.find.mockResolvedValue([mockFarm]);
      await service.findAll('user-1', true);
      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(['farm-1']) },
      });
    });
  });

  describe('findOwnedByUser', () => {
    it('should return only owned farms (strict, for economics)', async () => {
      repository.find.mockResolvedValue([mockFarm]);
      const result = await service.findOwnedByUser('user-1');
      expect(result).toEqual([mockFarm]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', archivedAt: IsNull() },
      });
    });
  });

  describe('findOne', () => {
    it('should return farm', async () => {
      repository.findOneBy.mockResolvedValue(mockFarm);
      const result = await service.findOne('farm-1');
      expect(result).toEqual(mockFarm);
    });

    it('should throw NotFoundException when farm not found', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for soft-deleted farm', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockFarm,
        deletedAt: new Date(),
      });
      await expect(service.findOne('farm-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update farm', async () => {
      repository.findOneBy.mockResolvedValue(mockFarm);
      repository.update.mockResolvedValue(undefined);

      const result = await service.update('farm-1', { name: 'Updated' });
      expect(repository.update).toHaveBeenCalledWith('farm-1', {
        name: 'Updated',
      });
    });
  });

  describe('archive / unarchive', () => {
    it('archives a live farm', async () => {
      repository.update.mockResolvedValue(undefined);
      const result = await service.archive('farm-1', 'user-1');
      expect(repository.update).toHaveBeenCalledWith('farm-1', {
        archivedAt: expect.any(Date),
      });
      expect(result.message).toContain('archived');
    });

    it('asserts OWNER_ONLY before archiving', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockRejectedValueOnce(new ForbiddenException());

      await expect(service.archive('farm-1', 'manager-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(access.assertCanAccessFarm).toHaveBeenCalledWith(
        'manager-1',
        'farm-1',
        'OWNER_ONLY',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('refuses to re-archive', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockResolvedValueOnce({
        ...mockFarm,
        archivedAt: new Date(),
      });

      await expect(service.archive('farm-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('unarchives an archived farm', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockResolvedValueOnce({
        ...mockFarm,
        archivedAt: new Date(),
      });
      repository.update.mockResolvedValue(undefined);

      await service.unarchive('farm-1', 'user-1');
      expect(repository.update).toHaveBeenCalledWith('farm-1', {
        archivedAt: null,
      });
    });

    it('asserts OWNER_ONLY before unarchiving', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockRejectedValueOnce(new ForbiddenException());

      await expect(service.unarchive('farm-1', 'worker-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('refuses to unarchive a farm that is not archived', async () => {
      await expect(service.unarchive('farm-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft-delete a farm with no crop history', async () => {
      repository.findOneBy.mockResolvedValue(mockFarm);
      repository.update.mockResolvedValue(undefined);

      const result = await service.remove('farm-1', 'user-1');
      expect(repository.update).toHaveBeenCalledWith(
        'farm-1',
        expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      );
      expect(result.message).toContain('deleted');
    });

    // Mirrors the pond rule: deleting a farm that has held crops takes the
    // production history with it. Archive is the action for a used farm.
    it('refuses to delete a farm whose ponds have crop history', async () => {
      cropsRepo.count.mockResolvedValue(3);

      await expect(service.remove('farm-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('asserts OWNER_ONLY before deleting', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockRejectedValueOnce(new ForbiddenException());

      await expect(service.remove('farm-1', 'manager-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(cropsRepo.count).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // Per-role capability defaults for one farm — "my workers may record
  // harvests". Owner only: a manager who could widen their own role would
  // make the policy decorative.
  describe('setRolePolicy', () => {
    it('persists a valid policy and reports it back', async () => {
      repository.update.mockResolvedValue(undefined);
      const policy = { worker: { RECORD_HARVEST: true } };

      await expect(
        service.setRolePolicy('farm-1', 'user-1', policy),
      ).resolves.toEqual({ farmId: 'farm-1', rolePolicy: policy });
      expect(repository.update).toHaveBeenCalledWith('farm-1', {
        rolePolicy: policy,
      });
    });

    it('asserts OWNER_ONLY before writing anything', async () => {
      const access = module.get(FarmAccessService) as any;
      access.assertCanAccessFarm.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        service.setRolePolicy('farm-1', 'manager-1', {
          worker: { RECORD_HARVEST: true },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown role or capability', async () => {
      await expect(
        service.setRolePolicy('farm-1', 'user-1', {
          owner: { RECORD_HARVEST: true },
        } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setRolePolicy('farm-1', 'user-1', {
          worker: { OWNER_ONLY: true },
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('stores null for an empty policy, so "cleared" reads as never set', async () => {
      repository.update.mockResolvedValue(undefined);

      await expect(
        service.setRolePolicy('farm-1', 'user-1', {}),
      ).resolves.toEqual({ farmId: 'farm-1', rolePolicy: null });
    });
  });
});
