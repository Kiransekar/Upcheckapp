import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

/**
 * Body for `POST /farms/:farmId/recovery-contact`.
 *
 * `userId: null` is meaningful — it CLEARS the nomination. `ValidateIf` skips
 * the UUID rule for an explicit null so clearing does not look like a
 * validation error.
 */
export class RecoveryContactDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  userId: string | null;
}
