import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-user, server-side "seen it" mark. Dismissing on one phone must not
 * resurrect the card on another — so this is a row keyed by (announcement,
 * user), not a client-side flag. `AnnouncementsService.findForUser` left-
 * anti-joins on this table.
 */
@Entity('announcement_dismissals')
@Index(['announcementId', 'userId'], { unique: true })
export class AnnouncementDismissal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'announcement_id', type: 'uuid' })
  announcementId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'dismissed_at', type: 'timestamp with time zone' })
  dismissedAt: Date;
}
