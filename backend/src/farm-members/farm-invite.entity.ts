import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Farm } from '../farms/farm.entity';
import type { FarmRole } from '../farm-access/farm-member.entity';

/**
 * A single-purpose join credential for a farm.
 *
 * Before this existed, `farms.farm_code` was doing two incompatible jobs at
 * once: it was the farm's PUBLIC IDENTITY (displayed on the members screen,
 * copyable, embedded in QR payloads) *and* its JOIN CREDENTIAL — anyone holding
 * it could `POST /farm-members/join` and land a `worker` membership with no
 * owner approval, no expiry, no revocation and no record of who let them in.
 *
 * Splitting them means the farm code can stay visible as identity while the
 * thing that actually grants access is per-invite, expiring, revocable, usage-
 * capped, and attributed to the person who issued it.
 */
@Entity('farm_invites')
@Index(['farmId'])
export class FarmInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  /**
   * The code a joiner types or scans. Same 8-char shape and charset as
   * `generateFarmCode()` (A–Z minus I/O, 2–9), so existing muscle memory, the
   * existing input field and the existing QR payload all still work.
   */
  @Column({ type: 'varchar', length: 8, unique: true })
  code: string;

  /** What membership this invite grants. Validated with `canAssignRole`. */
  @Column({ type: 'varchar', length: 20, default: 'worker' })
  role: FarmRole;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  /**
   * Null means never expires — used only by the codes backfilled from
   * `farms.farm_code`, which are already written on whiteboards and must not
   * stop working the moment this ships.
   */
  @Column({
    name: 'expires_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  expiresAt: Date | null;

  /** 0 means unlimited uses. Backfilled legacy codes use 0. */
  @Column({ name: 'max_uses', type: 'int', default: 1 })
  maxUses: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({
    name: 'revoked_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}

/** Why a code was rejected — surfaced so the client can translate each case. */
export type InviteRejection = 'not_found' | 'revoked' | 'expired' | 'exhausted';

/** Is this invite currently usable? Pure, so it is trivially testable. */
export function inviteRejection(
  invite: FarmInvite | null,
  now: Date,
): InviteRejection | null {
  if (!invite) return 'not_found';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }
  // maxUses 0 = unlimited.
  if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
    return 'exhausted';
  }
  return null;
}
