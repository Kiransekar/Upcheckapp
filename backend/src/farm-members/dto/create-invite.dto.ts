import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { AssignableRole } from './add-member.dto';

/**
 * Body for `POST /farms/:farmId/invites`. Every field is optional; the defaults
 * (a single-use worker invite valid for 7 days) are the common case, so the
 * owner can mint one without choosing anything.
 */
export class CreateInviteDto {
  /**
   * Role the invite grants. Checked against `canAssignRole(callerRole, role)`
   * in the service — a manager cannot mint a manager invite and so escalate
   * past what they could assign directly.
   */
  @IsOptional()
  @IsIn(['manager', 'worker', 'viewer'])
  role?: AssignableRole;

  /** 1 hour to 90 days. Defaults to 7 days. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 90)
  expiresInHours?: number;

  /**
   * How many people may join with this code. Capped at 50 — an unlimited
   * invite is exactly the shared-static-string problem this replaces, so it is
   * deliberately not offered here. (The migration's backfilled legacy codes
   * carry max_uses 0 / unlimited; those are grandfathered, not mintable.)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxUses?: number;

  /**
   * Whether whoever redeems this code still waits for approval (W5).
   *
   * Defaults to false — see the migration for why. The farm-level
   * `joinApproval` policy is unchanged and still governs the open farm-code
   * path; this is the invite saying what IT does.
   */
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
