import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-language override for a news article's title and summary, mirroring
 * `disease_library_translations`.
 *
 * No `en` row is ever inserted: English lives on the `news_articles` row and
 * NewsService falls back to it whenever the requested locale has no row. The
 * table ships empty in v1 so `GET /news?locale=te` works from day one and
 * simply returns English — turning languages on later is a backfill job, not
 * a schema change or a client release.
 */
@Entity('news_article_translations')
@Index(['articleId', 'locale'], { unique: true })
export class NewsArticleTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId: string;

  /** App language code: hi/ta/te/bn/or (matches frontend i18n). */
  @Column({ type: 'varchar', length: 8 })
  locale: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
