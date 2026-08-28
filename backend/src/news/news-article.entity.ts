import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A feed item: a headline, OUR short summary, and a link out to the publisher.
 *
 * ── LEGAL BOUNDARY — READ BEFORE ADDING A COLUMN ───────────────────────────
 * This table must NEVER hold a publisher's article body. The aggregate-and-
 * link model is what makes showing third-party journalism to farmers lawful;
 * storing the body turns it into republication. The ingestion pipeline may
 * hold fetched text in memory long enough to summarise it, but the body is
 * discarded before the row is built — NewsIngestionService.assertNoBody()
 * enforces that, and `news.ingestion.service.spec.ts` fails the build if a
 * refactor quietly reintroduces it.
 *
 * Facts are not copyrightable; sentences are. `summary` is ours, ≤300 chars,
 * and every rendered item shows `sourceName` and links to `canonicalUrl`.
 * ───────────────────────────────────────────────────────────────────────────
 */
@Entity('news_articles')
@Index(['status', 'publishedAt'])
@Index(['category', 'publishedAt'])
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  /** Stored as published, kept short, always shown next to `sourceName`. */
  @Column({ type: 'text' })
  title: string;

  /**
   * HAND-WRITTEN EDITORIAL ONLY — Upcheck's own posts, written by an admin
   * through `POST /news`. Ingested items always store `null` here. This is
   * NOT a place to cache a publisher's text; see the class comment above.
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Our summary of the facts, never the publisher's own standfirst. */
  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  category: string;

  /**
   * Publisher images are neither hotlinked nor re-hosted (§2.4) — ingested
   * items render a category icon instead. Non-null only for our own posts.
   */
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  author: string;

  @Column({
    name: 'published_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  publishedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ── Ingestion / attribution ───────────────────────────────────────────────

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  /** Denormalised so a list render needs no join to attribute the item. */
  @Column({ name: 'source_name', type: 'text', nullable: true })
  sourceName: string | null;

  /** Where the reader is sent. Required for every ingested item. */
  @Column({ name: 'canonical_url', type: 'text', nullable: true })
  canonicalUrl: string | null;

  /** sha256 of normalised title + publication day; collapses syndication. */
  @Column({ name: 'dedupe_hash', type: 'varchar', length: 64, nullable: true })
  dedupeHash: string | null;

  /** `draft | needs_summary | pending_review | published | rejected`. */
  @Column({ type: 'varchar', length: 20, default: 'published' })
  status: string;

  /** 0–100 from the relevance filter — used for ranking and for debugging. */
  @Column({ name: 'relevance_score', type: 'int', nullable: true })
  relevanceScore: number | null;

  /** Language of THIS row. Translations live in news_article_translations. */
  @Column({ type: 'varchar', length: 8, default: 'en' })
  locale: string;

  @Column({
    name: 'ingested_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  ingestedAt: Date | null;
}
