import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Farm } from '../farms/farm.entity';
import type { FeedbackCategory, FeedbackStatus } from './feedback-status';

/**
 * A farmer's report about the app itself — not farm data.
 *
 * Note the id: @PrimaryGeneratedColumn, NOT the client-minted @PrimaryColumn
 * every loggable entity uses. Feedback deliberately does not ride the offline
 * sync queue (see the comment in `frontend/src/screens/settings/
 * ReportIssueScreen.tsx`), so there is no replay to be idempotent about.
 */
@Entity('feedback_reports')
export class FeedbackReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Which farm they were looking at when it went wrong. Nullable because a
  // farmer with no farm yet (onboarding) is exactly the person most likely to
  // be stuck, and requiring a farm would silence them. ON DELETE SET NULL:
  // deleting a farm must not delete the complaint about it.
  @Column({ name: 'farm_id', type: 'uuid', nullable: true })
  farmId: string | null;

  @ManyToOne(() => Farm, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm | null;

  @Column({ type: 'varchar', length: 32 })
  category: FeedbackCategory;

  // Optional one-liner. Most farmers will not write one, so every list view
  // falls back to the first line of `message` rather than showing a blank row.
  @Column({ type: 'varchar', length: 160, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  message: string;

  /**
   * Supabase Storage object PATHS, not URLs.
   *
   * The bucket is private, so a stored URL would be either useless (expired)
   * or a permanent public link to a farmer's photo. Paths are signed on read
   * instead — see FeedbackStorageService.signAttachments.
   */
  @Column({ name: 'attachment_paths', type: 'jsonb', default: () => "'[]'" })
  attachmentPaths: string[];

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'new' })
  status: FeedbackStatus;

  @Column({ name: 'admin_response', type: 'text', nullable: true })
  adminResponse: string | null;

  @Column({
    name: 'responded_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  respondedAt: Date | null;

  // Free text, not a user id: staff use the dashboard behind a shared key and
  // have no row in `users`. It is a byline for the farmer ("Ravi from Upcheck"),
  // not an authorization subject — nothing keys off it.
  @Column({
    name: 'responded_by',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  respondedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
