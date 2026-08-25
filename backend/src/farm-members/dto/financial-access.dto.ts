import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';

/**
 * Body for `PATCH /farms/:farmId/members/:userId/financials`.
 *
 * `null` is meaningful and distinct from omitted: it CLEARS the override,
 * restoring the role default. `ValidateIf` skips the boolean rule for an
 * explicit null so clearing does not read as a validation error.
 */
export class FinancialAccessDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsBoolean()
  canViewFinancials: boolean | null;
}
