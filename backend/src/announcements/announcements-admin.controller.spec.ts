import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnnouncementsAdminController } from './announcements-admin.controller';
import { AnnouncementsService } from './announcements.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/auth.decorators';
import { AdminKeyGuard } from '../feedback/admin-key.guard';

/**
 * Same shared-secret story as `feedback-admin.controller.ts` and
 * `news-admin.controller.ts`: @Public() drops the farmer JwtAuthGuard,
 * AdminKeyGuard is the only thing standing guard here. The guard's own
 * accept/reject behaviour (missing key, wrong key, mismatched length,
 * unconfigured ADMIN_API_KEY) is exhaustively covered by
 * `admin-key.guard.spec.ts` — this file's job is only to confirm the
 * announcements admin routes are actually wired to that guard, not to a
 * farmer JWT or nothing at all.
 */
describe('AnnouncementsAdminController', () => {
  let controller: AnnouncementsAdminController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    publish: jest.Mock;
    unpublish: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnnouncementsAdminController],
      providers: [
        { provide: AnnouncementsService, useValue: service },
        // Wired via @UseGuards(AdminKeyGuard) on the class; Nest resolves it
        // as a real provider even though these tests call the controller
        // methods directly rather than going through the guard.
        AdminKeyGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-admin-key') },
        },
      ],
    }).compile();

    controller = module.get(AnnouncementsAdminController);
  });

  it('is public and gated by the admin key, not a farmer JWT', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AnnouncementsAdminController)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata('__guards__', AnnouncementsAdminController),
    ).toContain(AdminKeyGuard);
  });

  it('rejects a request with the wrong admin key before it reaches the controller', () => {
    const guard = new AdminKeyGuard({ get: () => 'test-admin-key' } as unknown as ConfigService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-admin-key': 'wrong-key' },
          method: 'GET',
          url: '/api/admin/announcements',
        }),
      }),
    } as any;
    expect(() => guard.canActivate(context)).toThrow();
  });

  it('rejects a request with no admin key header at all', () => {
    const guard = new AdminKeyGuard({ get: () => 'test-admin-key' } as unknown as ConfigService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, method: 'GET', url: '/api/admin/announcements' }),
      }),
    } as any;
    expect(() => guard.canActivate(context)).toThrow();
  });

  it('routes CRUD and publish/unpublish to the service', async () => {
    await controller.list();
    expect(service.findAll).toHaveBeenCalled();

    await controller.one('ann-1');
    expect(service.findOne).toHaveBeenCalledWith('ann-1');

    const dto = {
      key: 'k',
      category: 'feature',
      title: 't',
      body: 'b',
    } as any;
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);

    await controller.update('ann-1', { title: 'new' } as any);
    expect(service.update).toHaveBeenCalledWith('ann-1', { title: 'new' });

    await controller.publish('ann-1');
    expect(service.publish).toHaveBeenCalledWith('ann-1');

    await controller.unpublish('ann-1');
    expect(service.unpublish).toHaveBeenCalledWith('ann-1');

    await controller.remove('ann-1');
    expect(service.remove).toHaveBeenCalledWith('ann-1');
  });
});
