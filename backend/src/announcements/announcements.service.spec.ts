import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { Announcement } from './announcement.entity';
import { AnnouncementTranslation } from './announcement-translation.entity';
import { AnnouncementDismissal } from './announcement-dismissal.entity';

const FARMER_A = 'farmer-a';
const FARMER_B = 'farmer-b';

const announcement = (over: Partial<Announcement> = {}): Announcement =>
  ({
    id: 'ann-1',
    key: 'feed-advisor-launch',
    category: 'feature',
    title: 'Feed Advisor is here',
    body: 'Get feeding suggestions from your pond data.',
    isPublished: true,
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
    priority: 0,
    ...over,
  }) as Announcement;

const createAnnouncementsRepo = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((e) => Promise.resolve({ ...e, id: e.id ?? 'ann-1' })),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const createTranslationsRepo = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
});

const createDismissalsRepo = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
});

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let announcements: ReturnType<typeof createAnnouncementsRepo>;
  let translations: ReturnType<typeof createTranslationsRepo>;
  let dismissals: ReturnType<typeof createDismissalsRepo>;

  beforeEach(async () => {
    announcements = createAnnouncementsRepo();
    translations = createTranslationsRepo();
    dismissals = createDismissalsRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        {
          provide: getRepositoryToken(AnnouncementTranslation),
          useValue: translations,
        },
        {
          provide: getRepositoryToken(AnnouncementDismissal),
          useValue: dismissals,
        },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
  });

  describe('findForUser', () => {
    it('falls back to English when the requested locale has no translation row', async () => {
      announcements.find.mockResolvedValue([announcement()]);
      translations.find.mockResolvedValue([]);

      const cards = await service.findForUser(FARMER_A, 'te');

      expect(cards[0].title).toBe('Feed Advisor is here');
      expect(cards[0].translations.en).toEqual({
        title: 'Feed Advisor is here',
        body: 'Get feeding suggestions from your pond data.',
      });
    });

    it('uses the translation when one exists, and still carries every locale for switching in-card', async () => {
      announcements.find.mockResolvedValue([announcement()]);
      translations.find.mockResolvedValue([
        {
          announcementId: 'ann-1',
          locale: 'te',
          title: 'తెలుగు శీర్షిక',
          body: 'తెలుగు వివరణ',
        },
      ]);

      const cards = await service.findForUser(FARMER_A, 'te');

      expect(cards[0].title).toBe('తెలుగు శీర్షిక');
      expect(cards[0].translations.en.title).toBe('Feed Advisor is here');
      expect(cards[0].translations.te.title).toBe('తెలుగు శీర్షిక');
    });

    it('never returns an unpublished announcement', async () => {
      // The repo query itself filters isPublished: true — asserting the
      // filter was actually sent, not just trusting the mock's return value.
      await service.findForUser(FARMER_A);

      expect(announcements.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true }),
        }),
      );
    });

    it('honours priority then newest-published ordering', async () => {
      await service.findForUser(FARMER_A);

      expect(announcements.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { priority: 'ASC', publishedAt: 'DESC' },
        }),
      );
    });

    it('excludes an announcement this user dismissed', async () => {
      dismissals.find.mockResolvedValue([{ announcementId: 'ann-1' }]);
      announcements.find.mockResolvedValue([]);

      await service.findForUser(FARMER_A);

      const call = announcements.find.mock.calls[0][0];
      expect(call.where.id).toBeDefined();
    });

    it('dismissing for one farmer does not hide the card from another', async () => {
      // Farmer A dismissed it — their dismissals repo call returns the row.
      dismissals.find.mockImplementation(({ where }: any) =>
        Promise.resolve(where.userId === FARMER_A ? [{ announcementId: 'ann-1' }] : []),
      );
      announcements.find.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id ? [] : [announcement()]),
      );

      const forA = await service.findForUser(FARMER_A);
      const forB = await service.findForUser(FARMER_B);

      expect(forA).toEqual([]);
      expect(forB).toHaveLength(1);
    });

    it('degrades to no announcements instead of 500ing before the migration runs', async () => {
      const undefinedTable = Object.assign(new Error('relation does not exist'), {
        code: '42P01',
      });
      dismissals.find.mockRejectedValue(undefinedTable);

      await expect(service.findForUser(FARMER_A)).resolves.toEqual([]);
    });
  });

  describe('dismiss', () => {
    it('records a dismissal for that user', async () => {
      await service.dismiss(FARMER_A, 'ann-1');
      expect(dismissals.save).toHaveBeenCalledWith(
        expect.objectContaining({ announcementId: 'ann-1', userId: FARMER_A }),
      );
    });

    it('is a no-op, not an error, when already dismissed', async () => {
      dismissals.findOne.mockResolvedValue({ id: 'd1' });
      await service.dismiss(FARMER_A, 'ann-1');
      expect(dismissals.save).not.toHaveBeenCalled();
    });
  });

  describe('admin CRUD', () => {
    it('creates an announcement with its translations', async () => {
      announcements.save.mockResolvedValue(announcement());
      announcements.findOne.mockResolvedValue(announcement());

      await service.create({
        key: 'feed-advisor-launch',
        category: 'feature',
        title: 'Feed Advisor is here',
        body: 'Get feeding suggestions from your pond data.',
        translations: [{ locale: 'hi', title: 'हिंदी शीर्षक' }],
      });

      expect(announcements.save).toHaveBeenCalled();
      expect(translations.save).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'hi', title: 'हिंदी शीर्षक' }),
      );
    });

    it('publish stamps publishedAt and flips the flag', async () => {
      announcements.findOne
        .mockResolvedValueOnce(announcement({ isPublished: false, publishedAt: null }))
        .mockResolvedValueOnce(announcement({ isPublished: true }));

      await service.publish('ann-1');

      const saved = announcements.save.mock.calls[0][0];
      expect(saved.isPublished).toBe(true);
      expect(saved.publishedAt).toBeInstanceOf(Date);
    });

    it('unpublish flips the flag without erasing publishedAt', async () => {
      announcements.findOne
        .mockResolvedValueOnce(announcement())
        .mockResolvedValueOnce(announcement({ isPublished: false }));

      await service.unpublish('ann-1');

      const saved = announcements.save.mock.calls[0][0];
      expect(saved.isPublished).toBe(false);
      expect(saved.publishedAt).not.toBeNull();
    });

    it('404s updating, publishing or deleting an unknown announcement', async () => {
      announcements.findOne.mockResolvedValue(null);
      announcements.delete.mockResolvedValue({ affected: 0 });

      await expect(service.update('nope', { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.publish('nope')).rejects.toThrow(NotFoundException);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
