import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Announcement } from './announcement.entity';
import { AnnouncementTranslation } from './announcement-translation.entity';
import { AnnouncementDismissal } from './announcement-dismissal.entity';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';
import {
  TRANSLATABLE_LOCALES,
  type AnnouncementCategory,
} from './announcement-locale';

/** 42P01 undefined_table — same story as feedback/news: these are brand-new
 *  tables and `migrationsRun` is false, so a deploy-before-migrate window is
 *  real. The read the app calls on every open must degrade to "nothing new"
 *  rather than 500. */
function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

/** What the app renders: the resolved locale plus every translation that
 *  exists, so switching language inside the card costs no round trip. */
export interface AnnouncementCardView {
  id: string;
  key: string;
  category: AnnouncementCategory;
  priority: number;
  publishedAt: Date | null;
  title: string;
  body: string;
  translations: Record<string, { title: string; body: string }>;
}

/** What the admin dashboard sees: the full row plus its translation rows. */
export interface AnnouncementAdminView extends Announcement {
  translations: AnnouncementTranslation[];
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    @InjectRepository(AnnouncementTranslation)
    private readonly translationsRepo: Repository<AnnouncementTranslation>,
    @InjectRepository(AnnouncementDismissal)
    private readonly dismissalsRepo: Repository<AnnouncementDismissal>,
  ) {}

  // ───────────────────────────────── app ──────────────────────────────────

  /**
   * Published announcements this user has not dismissed, ordered by
   * priority then newest-published-first, localized to `locale` with an
   * `en` fallback and every existing translation attached so the farmer can
   * switch language in the card without another request.
   */
  async findForUser(
    userId: string,
    locale?: string,
  ): Promise<AnnouncementCardView[]> {
    let announcements: Announcement[];
    let dismissedIds: string[];
    try {
      const dismissals = await this.dismissalsRepo.find({
        where: { userId },
        select: ['announcementId'],
      });
      dismissedIds = dismissals.map((d) => d.announcementId);

      announcements = await this.repo.find({
        where: {
          isPublished: true,
          ...(dismissedIds.length > 0
            ? { id: Not(In(dismissedIds)) }
            : {}),
        },
        order: { priority: 'ASC', publishedAt: 'DESC' },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'announcements tables missing — run migrations; serving none',
      );
      return [];
    }

    if (announcements.length === 0) return [];

    const translations = await this.translationsRepo.find({
      where: { announcementId: In(announcements.map((a) => a.id)) },
    });
    const byAnnouncement = new Map<string, AnnouncementTranslation[]>();
    for (const t of translations) {
      const list = byAnnouncement.get(t.announcementId) ?? [];
      list.push(t);
      byAnnouncement.set(t.announcementId, list);
    }

    return announcements.map((a) => this.toCardView(a, byAnnouncement.get(a.id) ?? [], locale));
  }

  /** Record that this user closed the card. Idempotent — dismissing twice
   *  is a no-op, not an error, so a retried request on a flaky connection
   *  is harmless. */
  async dismiss(userId: string, announcementId: string): Promise<void> {
    const exists = await this.dismissalsRepo.findOne({
      where: { announcementId, userId },
    });
    if (exists) return;
    await this.dismissalsRepo.save(
      this.dismissalsRepo.create({ announcementId, userId }),
    );
  }

  // ──────────────────────────────── admin ─────────────────────────────────

  async findAll(): Promise<AnnouncementAdminView[]> {
    const announcements = await this.repo.find({
      order: { priority: 'ASC', createdAt: 'DESC' },
    });
    if (announcements.length === 0) return [];
    const translations = await this.translationsRepo.find({
      where: { announcementId: In(announcements.map((a) => a.id)) },
    });
    return announcements.map((a) => ({
      ...a,
      translations: translations.filter((t) => t.announcementId === a.id),
    }));
  }

  async findOne(id: string): Promise<AnnouncementAdminView> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    const translations = await this.translationsRepo.find({
      where: { announcementId: id },
    });
    return { ...announcement, translations };
  }

  async create(dto: CreateAnnouncementDto): Promise<AnnouncementAdminView> {
    const announcement = await this.repo.save(
      this.repo.create({
        key: dto.key.trim(),
        category: dto.category as AnnouncementCategory,
        title: dto.title.trim(),
        body: dto.body.trim(),
        priority: dto.priority ?? 0,
        isPublished: false,
        publishedAt: null,
      }),
    );
    if (dto.translations?.length) {
      await this.saveTranslations(announcement.id, dto.translations);
    }
    return this.findOne(announcement.id);
  }

  async update(
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementAdminView> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');

    if (dto.key !== undefined) announcement.key = dto.key.trim();
    if (dto.category !== undefined)
      announcement.category = dto.category as AnnouncementCategory;
    if (dto.title !== undefined) announcement.title = dto.title.trim();
    if (dto.body !== undefined) announcement.body = dto.body.trim();
    if (dto.priority !== undefined) announcement.priority = dto.priority;
    await this.repo.save(announcement);

    if (dto.translations?.length) {
      await this.saveTranslations(id, dto.translations);
    }
    return this.findOne(id);
  }

  /** Goes live (or re-live): stamps `publishedAt` now so it sorts as the
   *  freshest thing in its priority band. */
  async publish(id: string): Promise<AnnouncementAdminView> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    announcement.isPublished = true;
    announcement.publishedAt = new Date();
    await this.repo.save(announcement);
    return this.findOne(id);
  }

  /** Pulls the card from every farmer's home screen. `publishedAt` is left
   *  alone — it is the record of when this last went live, not a live flag. */
  async unpublish(id: string): Promise<AnnouncementAdminView> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    announcement.isPublished = false;
    await this.repo.save(announcement);
    return this.findOne(id);
  }

  /** Cascades to its translations and dismissals via the FK. */
  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Announcement not found');
  }

  // ──────────────────────────────── helpers ───────────────────────────────

  private async saveTranslations(
    announcementId: string,
    inputs: { locale: string; title?: string; body?: string }[],
  ): Promise<void> {
    for (const input of inputs) {
      if (!TRANSLATABLE_LOCALES.includes(input.locale as any)) continue;
      const existing = await this.translationsRepo.findOne({
        where: { announcementId, locale: input.locale },
      });
      const row =
        existing ??
        this.translationsRepo.create({ announcementId, locale: input.locale });
      if (input.title !== undefined) row.title = input.title.trim() || null;
      if (input.body !== undefined) row.body = input.body.trim() || null;
      await this.translationsRepo.save(row);
    }
  }

  /** Resolve one announcement + its translation rows into what the app
   *  renders: the requested locale (falling back to English) plus every
   *  translation that exists, so the card can switch language locally. */
  private toCardView(
    announcement: Announcement,
    translations: AnnouncementTranslation[],
    locale?: string,
  ): AnnouncementCardView {
    const byLocale: Record<string, { title: string; body: string }> = {
      en: { title: announcement.title, body: announcement.body },
    };
    for (const t of translations) {
      if (t.title || t.body) {
        byLocale[t.locale] = {
          title: t.title || announcement.title,
          body: t.body || announcement.body,
        };
      }
    }
    const resolved = (locale && byLocale[locale]) || byLocale.en;
    return {
      id: announcement.id,
      key: announcement.key,
      category: announcement.category,
      priority: announcement.priority,
      publishedAt: announcement.publishedAt,
      title: resolved.title,
      body: resolved.body,
      translations: byLocale,
    };
  }
}
