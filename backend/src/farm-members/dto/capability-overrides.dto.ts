import { IsObject, IsOptional, ValidateIf } from 'class-validator';
import { CapabilityOverrides } from '../../farm-access/farm-capability';

/**
 * Body for `PATCH /farms/:farmId/members/:userId/capabilities`.
 *
 * `null` is meaningful and distinct from omitted: it CLEARS every override,
 * restoring the farm's role policy and then the role default.
 *
 * The KEYS are validated in the service (invalidOverrideKey), not here: the
 * per-role route needs exactly the same rule one level deeper, and one shared
 * function next to the resolution it protects cannot drift from it the way two
 * hand-written decorators would.
 */
export class CapabilityOverridesDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsObject()
  overrides: CapabilityOverrides | null;
}
