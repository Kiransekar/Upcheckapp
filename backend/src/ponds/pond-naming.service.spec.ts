import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Not } from 'typeorm';
import { PondNamingService } from './pond-naming.service';
import { Pond } from './pond.entity';

describe('PondNamingService', () => {
  let service: PondNamingService;
  let mockQueryBuilder: any;
  let mockRepository: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxSeq: 0 }),
    };

    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        PondNamingService,
        {
          provide: getRepositoryToken(Pond),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PondNamingService>(PondNamingService);
  });

  // ── getNextSequenceNumber ──────────────────────────────────

  describe('getNextSequenceNumber', () => {
    it('should return 1 when no existing ponds', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: null });
      const result = await service.getNextSequenceNumber('farm-1', 'A');
      expect(result).toBe(1);
    });

    it('should return next number after existing max', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 5 });
      const result = await service.getNextSequenceNumber('farm-1', 'A');
      expect(result).toBe(6);
    });

    it('should preserve gaps — deleted A03 still returns 6 after A05', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 5 });
      const result = await service.getNextSequenceNumber('farm-1', 'A');
      expect(result).toBe(6); // Not 3 (the gap)
    });
  });

  // ── generateName ───────────────────────────────────────────

  describe('generateName', () => {
    it('should generate name with padded sequence number', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 0 });
      const result = await service.generateName('farm-1', 'F001', 'a');
      expect(result.name).toBe('A01');
      expect(result.pondCode).toBe('F001:A01');
      expect(result.sequenceNumber).toBe(1);
    });

    it('should normalize prefix to uppercase', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 0 });
      const result = await service.generateName('farm-1', 'F001', 'pond');
      expect(result.name).toBe('POND01');
    });

    it('should continue from existing max', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 12 });
      const result = await service.generateName('farm-1', 'F001', 'B');
      expect(result.name).toBe('B13');
      expect(result.sequenceNumber).toBe(13);
    });
  });

  // ── generateBatchNames ─────────────────────────────────────

  describe('generateBatchNames', () => {
    it('should generate sequential batch names', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 0 });
      mockRepository.count.mockResolvedValue(0);

      const names = await service.generateBatchNames('farm-1', 'F001', 'A', 3);
      expect(names).toHaveLength(3);
      expect(names[0].name).toBe('A01');
      expect(names[1].name).toBe('A02');
      expect(names[2].name).toBe('A03');
    });

    it('should continue from existing max for batch', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxSeq: 5 });
      mockRepository.count.mockResolvedValue(5);

      const names = await service.generateBatchNames('farm-1', 'F001', 'A', 3);
      expect(names[0].name).toBe('A06');
      expect(names[1].name).toBe('A07');
      expect(names[2].name).toBe('A08');
    });

    it('should throw when batch count exceeds 50', async () => {
      await expect(
        service.generateBatchNames('farm-1', 'F001', 'A', 51),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw when batch count is 0', async () => {
      await expect(
        service.generateBatchNames('farm-1', 'F001', 'A', 0),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── getPondCount ───────────────────────────────────────────

  describe('getPondCount', () => {
    it('excludes archived ponds from the farm cap count', async () => {
      mockRepository.count.mockResolvedValue(3);
      await service.getPondCount('farm-1');
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { farmId: 'farm-1', status: Not('archived') },
      });
    });
  });

  // ── validatePondLimit ──────────────────────────────────────

  describe('validatePondLimit', () => {
    it('should pass when under limit', async () => {
      mockRepository.count.mockResolvedValue(100);
      await expect(
        service.validatePondLimit('farm-1', 10),
      ).resolves.not.toThrow();
    });

    it('should throw when adding ponds would exceed 500', async () => {
      mockRepository.count.mockResolvedValue(498);
      await expect(service.validatePondLimit('farm-1', 5)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw with detailed error message', async () => {
      mockRepository.count.mockResolvedValue(500);
      try {
        await service.validatePondLimit('farm-1', 1);
        fail('Expected ConflictException');
      } catch (e) {
        expect(e.response.current).toBe(500);
        expect(e.response.limit).toBe(500);
      }
    });
  });

  // ── validatePrefix ─────────────────────────────────────────

  describe('validatePrefix', () => {
    it('should accept valid single-letter prefix', () => {
      expect(() => service.validatePrefix('A')).not.toThrow();
    });

    it('should accept valid multi-char prefix', () => {
      expect(() => service.validatePrefix('AB12')).not.toThrow();
    });

    it('should throw for empty prefix', () => {
      expect(() => service.validatePrefix('')).toThrow(ConflictException);
    });

    it('should throw for prefix longer than 4 characters', () => {
      expect(() => service.validatePrefix('ABCDE')).toThrow(ConflictException);
    });

    it('should throw for non-alphanumeric prefix', () => {
      expect(() => service.validatePrefix('A-B')).toThrow(ConflictException);
    });
  });
});
