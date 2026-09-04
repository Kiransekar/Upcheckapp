import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdjustStockDto {
  /**
   * Signed delta applied to the current quantity (negative to consume stock).
   * The delta itself may be negative — that is the whole point — but the
   * RESULT may not be: `adjustStock` rejects anything that would drive the
   * quantity below zero, atomically, in the UPDATE's WHERE clause.
   */
  @IsNumber()
  adjustment: number;

  /** Persisted to `last_adjustment_reason` (it used to be silently dropped). */
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
