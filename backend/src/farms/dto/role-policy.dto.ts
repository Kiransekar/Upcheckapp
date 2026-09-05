import { IsObject, IsOptional, ValidateIf } from 'class-validator';
import { RolePolicy } from '../../farm-access/farm-capability';

/**
 * Body for `PATCH /farms/:id/role-policy` — the per-role capability defaults
 * for one farm, e.g. `{ worker: { RECORD_HARVEST: true } }`.
 *
 * `null` clears the policy. Roles and capability keys are validated in the
 * service (invalidPolicyKey), beside the resolution they protect.
 */
export class RolePolicyDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsObject()
  policy: RolePolicy | null;
}
