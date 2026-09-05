import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { AnnouncementCategory } from './announcement-locale';

/**
 * A "what's new" card an admin publishes for farmers to see on app open —
 * a feature launch, a bug fix, or something that moved.
 *
 * English lives directly on this row (required, never null); every other
 * locale is an optional override in `announcement_translations` — the same
 * split `NewsArticle`/`NewsArticleTranslation` uses, chosen here over a
 * six-columns-per-locale row because most announcements will only ever be
 * translated into a handful of the six languages, and a sidecar keeps this
 * row (and the payload the app fetches on every open) small.
 */
@Entity('announcements')
@Index(['isPublished', 'priority', 'publishedAt'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Stable, admin-chosen slug (e.g. `2026-09-feed-advisor`) — lets staff
   * reference "the harvest planner announcement" across edits without
   * hunting for a uuid, and gives the dashboard a human-readable list key.
   * Not used for lookups by the app; the app only ever sees `id`.
   */
  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 16 })
  category: AnnouncementCategory;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @Column({
    name: 'published_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  publishedAt: Date | null;

  /**
   * Defined order for two live announcements: lower shows first. Ties break
   * on `publishedAt` (newest first) — see AnnouncementsService.findForUser.
   */
  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
