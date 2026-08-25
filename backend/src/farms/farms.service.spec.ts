import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { FarmsService } from './farms.service';
import { Farm } from './farm.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('FarmsService', () => {
  let service: FarmsService;
  let repository: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        FarmsService,
        { provide: getRepositoryToken(Farm), useValue: repository },
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
      // Now scoped to the farm ids the user can access (owner or worker).
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
        where: { userId: 'user-1' },
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

  describe('remove', () => {
    it('should soft-delete farm with deletedAt', async () => {
      repository.findOneBy.mockResolvedValue(mockFarm);
      repository.update.mockResolvedValue(undefined);

      const result = await service.remove('farm-1');
      expect(repository.update).toHaveBeenCalledWith(
        'farm-1',
        expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      );
      expect(result.message).toContain('archived');
    });
  });
});
