import { IsIn, IsOptional } from 'class-validator';

/**
 * Body for `POST /farms/:farmId/join-policy` — how this farm handles someone
 * redeeming its code. OWNER_ONLY: a manager must not be able to switch
 * approval off and then walk people in.
 */
export class JoinPolicyDto {
  /**
   * `manual` (default) puts a joiner in the "waiting to be let in" queue,
   * granting nothing until approved. `auto` admits them immediately.
   */
  @IsOptional()
  @IsIn(['manual', 'auto'])
  joinApproval?: 'manual' | 'auto';

  /**
   * Who may act on that queue: `managers` (owner + managers, matching
   * MANAGE_WORKERS) or `owner` (the owner alone).
   */
  @IsOptional()
  @IsIn(['owner', 'managers'])
  joinApprover?: 'owner' | 'managers';
}
