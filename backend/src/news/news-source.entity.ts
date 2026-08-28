import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A publisher we aggregate headlines from.
 *
 * `permissionStatus` and `isActive` exist so consent is a row in a table
 * rather than a promise in a document: a source stays dark until a human has
 * read its terms and (for trade press) has a written yes on file. Government
 * and institutional sources ship active, since their material is
 * public-interest and carries far less risk.
 */
@Entity('news_sources')
export class NewsSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'homepage_url', type: 'text', nullable: true })
  homepageUrl: string | null;

  @Index({ unique: true })
  @Column({ name: 'feed_url', type: 'text' })
  feedUrl: string;

  /** `rss | atom | html | manual`. Only `rss`/`atom` are polled in v1. */
  @Column({ name: 'feed_type', type: 'varchar', length: 16, default: 'rss' })
  feedType: string;

  @Column({
    name: 'default_category',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  defaultCategory: string | null;

  /** Ranking and relevance bias, 0–100. Institutional sources sit above 50. */
  @Column({ type: 'int', default: 50 })
  weight: number;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'terms_url', type: 'text', nullable: true })
  termsUrl: string | null;

  @Column({
    name: 'terms_checked_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  termsCheckedAt: Date | null;

  /** `unknown | granted | denied` — the §2.7 consent record. */
  @Column({
    name: 'permission_status',
    type: 'varchar',
    length: 16,
    default: 'unknown',
  })
  permissionStatus: string;

  @Column({ name: 'permission_note', type: 'text', nullable: true })
  permissionNote: string | null;

  @Column({
    name: 'last_fetched_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastFetchedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
