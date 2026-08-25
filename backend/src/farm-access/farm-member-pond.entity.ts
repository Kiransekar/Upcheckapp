import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { FarmMember } from './farm-member.entity';
import { Pond } from '../ponds/pond.entity';

/**
 * Restricts a membership to specific ponds.
 *
 * Membership used to be farm-level only: on a 20-pond farm every worker could
 * see and write to every pond, and the schema simply could not express "Ravi
 * looks after ponds 1, 4 and 7" — which is exactly what the farms big enough
 * to need pond supervisors want.
 *
 * SEMANTICS, and the reason this table needs no backfill:
 *   NO rows for a membership  = access to ALL ponds on that farm (the default,
 *                               and what every existing membership already has)
 *   one or more rows          = restricted to exactly those ponds
 *
 * Applies to `worker` and `viewer` only. Owners and managers are responsible
 * for the whole farm, so scoping rows are ignored for them rather than
 * silently half-applying — see FarmAccessService.assertCanAccessPond.
 */
@Entity('farm_member_ponds')
@Index(['farmMemberId'])
export class FarmMemberPond {
  @PrimaryColumn({ name: 'farm_member_id', type: 'uuid' })
  farmMemberId: string;

  @PrimaryColumn({ name: 'pond_id', type: 'uuid' })
  pondId: string;

  @ManyToOne(() => FarmMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_member_id' })
  farmMember: FarmMember;

  @ManyToOne(() => Pond, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pond_id' })
  pond: Pond;
}

/** Roles that pond scoping applies to. Owner/manager always see the whole farm. */
export const SCOPABLE_ROLES = ['worker', 'viewer'] as const;
