import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CropsService } from './crops.service';
import { Crop } from './crop.entity';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PondsService } from '../ponds/ponds.service';

describe('CropsService', () => {
  let service: CropsService;
  let repository: MockRepository;
  let pondsService: jest.Mocked<PondsService>;
  // Transaction EntityManager stand-in — create() now claims the pond's active
  // cycle inside a locked dataSource.transaction.
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const mockCrop = new Crop();
  mockCrop.id = 'crop-1';
  mockCrop.pondId = 'pond-1';
  mockCrop.name = 'Test Crop';
  mockCrop.cropCode = 'TC001';
  mockCrop.speciesType = 'vannamei';
  mockCrop.stockingDate = new Date('2024-01-01');
  mockCrop.stockingDensity = 10;
  mockCrop.stockingCount = 10000;
  mockCrop.status = 'active';
  mockCrop.createdAt = new Date();
  mockCrop.updatedAt = new Date();

  const mockPond = { id: 'pond-1', activeCycleId: 'crop-1' };

  const mockCreateCropDto: CreateCropDto = {
    pondId: 'pond-1',
    name: 'New Crop',
    cropCode: 'NC001',
    speciesType: 'vannamei',
    stockingDensity: 10,
    stockingCount: 10000,
    stockingDate: '2024-01-01',
    status: 'active',
  };

  const mockUpdateCropDto: UpdateCropDto = {
    status: 'completed',
  };

  type MockRepository = Partial<Record<keyof Repository<any>, jest.Mock>> & {
    [K in keyof Repository<any>]?: jest.Mock;
  };

  const createMockRepository = (): MockRepository => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CropsService,
        {
          provide: getRepositoryToken(Crop),
          useValue: createMockRepository(),
        },
        {
          provide: PondsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockPond),
            // Member-aware variants — every capability-bearing call site in
            // CropsService now goes through these.
            findOneAccessible: jest.fn().mockResolvedValue(mockPond),
            verifyAccess: jest.fn().mockResolvedValue(undefined),
            verifyOwner: jest.fn().mockResolvedValue(true),
            update: jest.fn().mockResolvedValue(mockPond),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: typeof manager) => unknown) =>
              cb(manager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CropsService>(CropsService);
    repository = module.get(getRepositoryToken(Crop));
    pondsService = module.get(PondsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new crop', async () => {
      const userId = 'user-1';

      pondsService.findOneAccessible.mockResolvedValue({} as any);
      manager.findOne.mockResolvedValue({ id: 'pond-1', activeCycleId: null });
      manager.create.mockReturnValue(mockCrop);
      manager.save.mockResolvedValue(mockCrop);

      const result = await service.create(mockCreateCropDto, userId);

      expect(pondsService.findOneAccessible).toHaveBeenCalledWith(
        mockCreateCropDto.pondId,
        userId,
        'WRITE_MANAGEMENT',
      );
      expect(manager.create).toHaveBeenCalled();
      expect(result).toEqual(mockCrop);
    });

    it('marks the pond ACTIVE, not merely linked, when a cycle starts', async () => {
      // The reported bug — "I can add infinite cycles, one by one", and cycles
      // not showing on the pond or farm pages — was one cause. Starting a cycle
      // set activeCycleId but left status at 'fallow', so the pond went on
      // reporting itself empty and every screen kept offering "Start a cycle".
      const pond = { id: 'pond-1', activeCycleId: null, status: 'fallow' };
      pondsService.findOneAccessible.mockResolvedValue({} as any);
      manager.findOne.mockResolvedValue(pond);
      manager.create.mockReturnValue(mockCrop);
      manager.save.mockImplementation(async (e: any) => e);

      await service.create(mockCreateCropDto, 'user-1');

      expect(pond.activeCycleId).toBe(mockCrop.id);
      expect(pond.status).toBe('active');
    });

    it('rejects a second concurrent active cycle for the same pond', async () => {
      pondsService.findOneAccessible.mockResolvedValue({} as any);
      // Locked pond row already carries an active cycle.
      manager.findOne.mockResolvedValue({
        id: 'pond-1',
        activeCycleId: 'crop-existing',
      });

      await expect(
        service.create(mockCreateCropDto, 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all crops for a pond', async () => {
      const pondId = 'pond-1';
      const userId = 'user-1';
      const crops = [mockCrop];

      pondsService.verifyOwner.mockResolvedValue(undefined as any);
      (repository.find as jest.Mock).mockResolvedValue(crops);

      const result = await service.findAll(pondId, userId);

      expect(pondsService.verifyOwner).toHaveBeenCalledWith(pondId, userId);
      expect(repository.find).toHaveBeenCalledWith({
        where: { pondId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(crops);
    });
  });

  describe('findOne', () => {
    it('should return a crop by id', async () => {
      const cropId = 'crop-1';
      const userId = 'user-1';

      (repository.findOneBy as jest.Mock).mockResolvedValue(mockCrop);
      pondsService.findOneAccessible.mockResolvedValue({} as any);

      const result = await service.findOne(cropId, userId);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: cropId });
      expect(pondsService.findOneAccessible).toHaveBeenCalledWith(
        mockCrop.pondId,
        userId,
        'VIEW_FINANCIALS',
      );
      // findOne enriches the entity with a derived `computedDOC` field, so assert
      // the original fields are present rather than strict equality.
      expect(result).toEqual(expect.objectContaining(mockCrop));
    });

    it('should throw NotFoundException when crop not found', async () => {
      const cropId = 'non-existent';
      const userId = 'user-1';

      (repository.findOneBy as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(cropId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a crop', async () => {
      const cropId = 'crop-1';
      const userId = 'user-1';
      const updatedCrop = Object.assign(new Crop(), mockCrop, {
        status: 'completed',
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(mockCrop);
      (repository.update as jest.Mock).mockResolvedValue(undefined);
      jest.spyOn(service, 'findOneAccessible').mockResolvedValue(updatedCrop);

      const result = await service.update(cropId, mockUpdateCropDto, userId);

      // WRITE_MANAGEMENT, matching the route guard — not the VIEW_FINANCIALS
      // `findOne`, which would 403 a member granted WRITE_MANAGEMENT.
      expect(service.findOneAccessible).toHaveBeenCalledWith(
        cropId,
        userId,
        'WRITE_MANAGEMENT',
      );
      expect(repository.update).toHaveBeenCalledWith(cropId, mockUpdateCropDto);
      expect(result).toEqual(updatedCrop);
    });
  });

  describe('remove', () => {
    it('should remove a crop', async () => {
      const cropId = 'crop-1';
      const userId = 'user-1';

      jest.spyOn(service, 'findOne').mockResolvedValue(mockCrop);
      pondsService.findOneAccessible.mockResolvedValue(mockPond as any);
      (repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.remove(cropId, userId);

      expect(service.findOne).toHaveBeenCalledWith(cropId, userId);
      expect(repository.delete).toHaveBeenCalledWith(cropId);
      expect(result).toEqual({ affected: 1 });
    });
  });

  describe('harvest', () => {
    it('should record harvest data', async () => {
      const cropId = 'crop-1';
      const userId = 'user-1';
      const harvestData = {
        actualHarvestDate: '2024-06-01',
        harvestWeightKg: 2500,
      };

      pondsService.findOneAccessible.mockResolvedValue(mockPond as any);
      (repository.update as jest.Mock).mockResolvedValue(undefined);
      jest.spyOn(service, 'findOneAccessible').mockResolvedValue(
        Object.assign(new Crop(), mockCrop, {
          status: 'completed',
          actualHarvestDate: harvestData.actualHarvestDate,
          harvestWeightKg: harvestData.harvestWeightKg,
        }),
      );

      const result = await service.harvest(cropId, harvestData, userId);

      // Completing a cycle is RECORD_HARVEST end to end — crop read AND pond.
      expect(service.findOneAccessible).toHaveBeenCalledWith(
        cropId,
        userId,
        'RECORD_HARVEST',
      );
      expect(pondsService.findOneAccessible).toHaveBeenCalledWith(
        'pond-1',
        userId,
        'RECORD_HARVEST',
      );
      expect(repository.update).toHaveBeenCalledWith(cropId, {
        actualHarvestDate: new Date(harvestData.actualHarvestDate),
        harvestWeightKg: harvestData.harvestWeightKg,
        status: 'completed',
      });
      expect(result.status).toBe('completed');
    });
  });

  describe('closeCycle', () => {
    it('rejects a second close (idempotent) with ConflictException', async () => {
      jest.spyOn(service, 'findOneAccessible').mockResolvedValue(mockCrop);
      pondsService.findOneAccessible.mockResolvedValue(mockPond as any);
      // Guarded UPDATE matched no open row → already closed.
      (repository.update as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(
        service.closeCycle('crop-1', '2024-06-01', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('closes an open cycle and unlinks it from the pond', async () => {
      jest.spyOn(service, 'findOneAccessible').mockResolvedValue(mockCrop);
      pondsService.findOneAccessible.mockResolvedValue(mockPond as any);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.closeCycle('crop-1', '2024-06-01', 'user-1');

      // The whole close path runs on RECORD_HARVEST. It used to read the crop
      // through the VIEW_FINANCIALS `findOne`, which 403'd a granted worker
      // AFTER `harvests.create` had already committed the harvest row.
      expect(service.findOneAccessible).toHaveBeenCalledWith(
        'crop-1',
        'user-1',
        'RECORD_HARVEST',
      );
      expect(pondsService.findOneAccessible).toHaveBeenCalledWith(
        'pond-1',
        'user-1',
        'RECORD_HARVEST',
      );
      expect(repository.update).toHaveBeenCalled();
      // The pond returns to 'fallow' as well as losing its cycle link. These
      // two fields describe the same fact and were previously allowed to
      // disagree — a pond could report status 'active' with no cycle, or
      // 'fallow' with one, and every screen that asked "is this stocked?" via
      // status then got the wrong answer.
      expect(pondsService.update).toHaveBeenCalledWith(
        'pond-1',
        { activeCycleId: null, status: 'fallow' },
        'user-1',
      );
    });
  });

  describe('findOneForVerifiedPond', () => {
    it('skips the redundant pond re-check when the crop is on the cleared pond', async () => {
      repository.findOneBy!.mockResolvedValue(mockCrop); // pondId: 'pond-1'

      const result = await service.findOneForVerifiedPond(
        'crop-1',
        'pond-1',
        'user-1',
      );

      expect(result.id).toBe('crop-1');
      expect(pondsService.verifyAccess).not.toHaveBeenCalled();
    });

    it('still checks when the crop is NOT on the cleared pond', async () => {
      // A grant on pond-1 says nothing about pond-9 — the shortcut must not
      // become a way to read another pond's cycle.
      const stray = Object.assign(new Crop(), mockCrop, { pondId: 'pond-9' });
      repository.findOneBy!.mockResolvedValue(stray);
      pondsService.verifyAccess.mockRejectedValue(
        new ForbiddenException('nope'),
      );

      await expect(
        service.findOneForVerifiedPond('crop-1', 'pond-1', 'worker'),
      ).rejects.toThrow(ForbiddenException);
      expect(pondsService.verifyAccess).toHaveBeenCalledWith(
        'pond-9',
        'worker',
        'READ',
      );
    });

    it('404s a missing crop', async () => {
      repository.findOneBy!.mockResolvedValue(null);

      await expect(
        service.findOneForVerifiedPond('nope', 'pond-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

