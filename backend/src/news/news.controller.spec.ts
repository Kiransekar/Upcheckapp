import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('NewsController', () => {
  let controller: NewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        { provide: NewsService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: 'EmailService', useValue: {} },
        { provide: 'PondsService', useValue: {} },
        { provide: 'InventoryService', useValue: {} },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // News is operator-published content every tenant sees. A farmer must not be
  // able to write to it, and the moderation status this feature adds is only
  // meaningful if the write routes stay admin-only.
  describe('write access', () => {
    it.each(['create', 'update', 'remove'])(
      'restricts %s to SUPER_ADMIN',
      (method) => {
        const roles = Reflect.getMetadata(
          ROLES_KEY,
          NewsController.prototype[method],
        );
        expect(roles).toEqual([Role.SUPER_ADMIN]);
      },
    );

    it.each(['findAll', 'findOne'])('leaves %s open to read', (method) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, NewsController.prototype[method]),
      ).toBeUndefined();
    });

    it('puts RolesGuard on the controller so the metadata is enforced', () => {
      const guards = Reflect.getMetadata('__guards__', NewsController) ?? [];
      expect(guards).toContain(RolesGuard);
    });
  });
});
