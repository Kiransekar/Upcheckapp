import { IsIn, IsOptional } from 'class-validator';
import type { AssignableRole } from './add-member.dto';

/**
 * Body for `POST /farms/:farmId/pending/:userId/approve`.
 *
 * `role` optionally overrides what the code granted, so an owner can promote
 * someone on the way in rather than approving and then editing. Bounded by
 * `canAssignRole` in the service, exactly as a direct add would be.
 */
export class ApproveMemberDto {
  @IsOptional()
  @IsIn(['manager', 'worker', 'viewer'])
  role?: AssignableRole;
}
