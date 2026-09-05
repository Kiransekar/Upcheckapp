import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';
import type { RolePolicy } from '../farm-access/farm-capability';

// Valid values: 'tidal' | 'river' | 'borehole' | 'reservoir' | 'recycled'
export type WaterSourceType = string;

@Entity('farms')
export class Farm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'text' })
  name: string;

  @Column({
    name: 'farm_code',
    type: 'varchar',
    length: 8,
    unique: true,
    nullable: true,
  })
  farmCode: string;

  @Column({ name: 'area_hectares', type: 'numeric', nullable: true })
  areaHectares: number;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'numeric', nullable: true })
  longitude: number;

  @Column({ type: 'numeric', nullable: true })
  latitude: number;

  @Column({
    name: 'water_source_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  waterSourceType: string;

  // Declared by the owner during first-run farm setup; the guided pond-creation
  // step uses it to know how many ponds to scaffold. Nullable for legacy farms.
  @Column({ name: 'planned_pond_count', type: 'integer', nullable: true })
  plannedPondCount: number;

  @Column({ name: 'qr_code_url', type: 'text', nullable: true })
  qrCodeUrl: string;

  @Column({ name: 'privacy_setting', type: 'text', default: 'private' })
  privacySetting: string;

  /**
   * What happens when someone redeems this farm's join code.
   *
   *   manual — they land in the "waiting to be let in" queue as a `pending`
   *            member, granting nothing until an owner taps Let in. Default,
   *            because the code is shareable and an owner should decide who
   *            actually gets into their farm.
   *   auto   — they become an active member immediately, which is the old
   *            pre-approval behaviour. For farms where the code only ever
   *            circulates among people the owner already trusts.
   */
  @Column({ name: 'join_approval', type: 'varchar', length: 10, default: 'manual' })
  joinApproval: 'manual' | 'auto';

  /**
   * Who may act on the "waiting to be let in" queue.
   *
   *   managers — owner and any manager, matching MANAGE_WORKERS (who can
   *              already add and remove members directly). The default, since
   *              tightening it silently would surprise farms that delegate.
   *   owner    — owner only. For farms where letting someone in is the owner's
   *              call alone, even though managers still manage everyone else.
   *
   * Only the owner can change this — see canApproveJoins / setJoinPolicy.
   */
  @Column({
    name: 'join_approver',
    type: 'varchar',
    length: 10,
    default: 'managers',
  })
  joinApprover: 'owner' | 'managers';

  @Column({ type: 'jsonb', nullable: true })
  boundary: { latitude: number; longitude: number }[];

  /**
   * Per-role capability defaults for THIS farm, e.g.
   * `{ worker: { RECORD_HARVEST: true } }`. null = the built-in matrix.
   *
   * A per-member override (farm_members.capability_overrides) wins over this;
   * this wins over the matrix. Owner-settable only, and the `owner` role is not
   * expressible here — an owner is never reducible.
   */
  @Column({ name: 'role_policy', type: 'jsonb', nullable: true })
  rolePolicy: RolePolicy | null;

  /**
   * Nominated recovery contact — a member who may claim ownership if the owner
   * account is lost (phone lost, number changed, person leaves).
   *
   * `farm.userId` is single-valued and `transferOwnership` requires the
   * CURRENT owner to act, so without this a lost owner account means the farm
   * has no recovery path inside the app at all. Family- and partnership-run
   * farms are the norm in this market, so that is a real dead end, not a
   * theoretical one.
   *
   * Nullable: recovery is opt-in, and a farm with no nominee simply has none.
   */
  @Column({ name: 'recovery_contact_id', type: 'uuid', nullable: true })
  recoveryContactId: string | null;

  /**
   * When the recovery contact asked to take over. The claim only completes
   * after RECOVERY_WAIT_DAYS have passed with no cancellation, so a lost phone
   * cannot become an instant silent takeover — the real owner has a window to
   * notice and stop it.
   */
  @Column({
    name: 'recovery_claim_started_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  recoveryClaimStartedAt: Date | null;

  /**
   * Put away, not deleted. An archived farm stays fully readable and its
   * history intact; it just drops out of the default listings until the owner
   * unarchives it. Distinct from `deletedAt`, which is the DELETE tombstone —
   * a soft-deleted farm 404s everywhere.
   */
  @Column({
    name: 'archived_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  archivedAt: Date | null;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt: Date;
}
