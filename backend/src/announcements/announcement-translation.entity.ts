import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-locale override of an announcement's title and body, mirroring
 * `news_article_translations`. No `en` row is ever inserted: English lives
 * on the `announcements` row and AnnouncementsService falls back to it
 * whenever the requested locale has no row here — so a card is never blank,
 * only ever English.
 */
@Entity('announcement_translations')
@Index(['announcementId', 'locale'], { unique: true })
export class AnnouncementTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'announcement_id', type: 'uuid' })
  announcementId: string;

  /** hi | bn | ta | te | or — see ANNOUNCEMENT_LOCALES. */
  @Column({ type: 'varchar', length: 8 })
  locale: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
