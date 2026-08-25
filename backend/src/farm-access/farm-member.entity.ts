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

// Per-farm membership role (blueprint §7). Authority order: owner > manager >
// worker > viewer.
//   owner   — full control: farm/pond lifecycle, ownership transfer, roles, economics.
//   manager — operations + team: create ponds/cycles/tasks, record, verify,
//             view financials, invite/remove workers. Not farm/role lifecycle.
//   worker  — field operations: record logs, complete own tasks, read. No economics.
//   viewer  — read-only (banks/insurers/consultants). No writes, no economics
//             unless the owner grants cost visibility per-farm.
// Stored as varchar(20) — no DB enum — so this list extends without a migration.
export type FarmRole = 'owner' | 'manager' | 'worker' | 'viewer';

/**
 * Whether this membership actually grants anything yet.
 *
 *   active  — a real member; the role applies.
 *   pending — someone redeemed the farm code but the owner has not let them
 *             in. Grants NOTHING: FarmAccessService filters these out of every
 *             role lookup and every accessible-farm list, so a pending row is
 *             inert until approved. Only the members screen sees them, as the
 *             "waiting to be let in" queue.
 *
 * Stored as varchar(20) with an 'active' default so every pre-existing row
 * (and any insert that predates this column) stays a full member.
 */
export type FarmMemberStatus = 'active' | 'pending';

@Entity('farm_members')
@Index(['farmId', 'userId'], { unique: true })
export class FarmMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, default: 'worker' })
  role: FarmRole;

  // See FarmMemberStatus. A pending row must never satisfy a capability check.
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: FarmMemberStatus;

  /**
   * Per-farm cost-visibility grant, overriding the role default for
   * VIEW_FINANCIALS only. null = use the role default (owner + manager).
   * Consulted inside roleSatisfies() so one grant means one thing everywhere.
   * Nullable rather than boolean-with-default so "never decided" stays
   * distinguishable from "deliberately denied".
   */
  @Column({ name: 'can_view_financials', type: 'boolean', nullable: true })
  canViewFinancials: boolean | null;

  // Who added this member (the owner who scanned/entered them). Nullable so a
  // user deletion doesn't cascade-remove the membership row.
  @Column({ name: 'added_by_id', type: 'uuid', nullable: true })
  addedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'added_by_id' })
  addedBy: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
