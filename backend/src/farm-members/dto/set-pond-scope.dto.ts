import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/**
 * Body for `PATCH /farms/:farmId/members/:userId/ponds`.
 *
 * An EMPTY array is meaningful and allowed: it clears the scope, restoring
 * whole-farm access. That is the deliberate way to un-scope someone, so it must
 * not be confused with "field omitted".
 */
export class SetPondScopeDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  pondIds: string[];
}
