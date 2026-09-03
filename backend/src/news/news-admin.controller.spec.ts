import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsAdminController } from './news-admin.controller';
import { NewsIngestionService } from './news-ingestion.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/auth.decorators';
import { AdminKeyGuard } from '../feedback/admin-key.guard';

describe('NewsAdminController', () => {
  let controller: NewsAdminController;
  let ingestion: { run: jest.Mock };

  beforeEach(async () => {
    ingestion = { run: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsAdminController],
      providers: [
        { provide: NewsIngestionService, useValue: ingestion },
        // AdminKeyGuard is wired via @UseGuards(AdminKeyGuard) on the class,
        // which Nest resolves as a real provider even though it is never
        // invoked here (these tests call the controller method directly).
        AdminKeyGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-admin-key') },
        },
      ],
    }).compile();

    controller = module.get(NewsAdminController);
  });

  // Same shared-secret story as the staff feedback inbox: @Public() drops the
  // farmer JwtAuthGuard, AdminKeyGuard is the only thing standing guard.
  it('is public and gated by the admin key, not a farmer JWT', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, NewsAdminController)).toBe(true);
    expect(Reflect.getMetadata('__guards__', NewsAdminController)).toContain(
      AdminKeyGuard,
    );
  });

  it('maps ingestion stats into the small per-source summary a scheduler can log', async () => {
    ingestion.run.mockResolvedValue({
      fetched: 5,
      filtered: 1,
      deduped: 1,
      persisted: 3,
      failed: 1,
      error: null,
      sources: [
        {
          name: 'MPEDA',
          fetched: 5,
          filtered: 1,
          deduped: 1,
          persisted: 3,
          failed: 0,
          error: null,
        },
        {
          name: 'Dead Feed',
          fetched: 0,
          filtered: 0,
          deduped: 0,
          persisted: 0,
          failed: 1,
          error: 'timeout of 30000ms exceeded',
        },
      ],
    });

    const result = await controller.ingest();

    expect(result).toEqual({
      sources: [
        { source: 'MPEDA', fetched: 5, inserted: 3, skipped: 2, error: null },
        {
          source: 'Dead Feed',
          fetched: 0,
          inserted: 0,
          skipped: 0,
          error: 'timeout of 30000ms exceeded',
        },
      ],
    });
    expect(ingestion.run).toHaveBeenCalledTimes(1);
  });
});
