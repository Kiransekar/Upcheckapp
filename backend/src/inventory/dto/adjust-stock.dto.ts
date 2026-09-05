import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

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

  /**
   * What this stock cost. Present ⇒ this adjustment is a PURCHASE and writes
   * one linked 'inventory' expense (D2). Only meaningful on a positive
   * adjustment: `InventoryService.adjustStock` rejects an amount on a
   * reduction rather than dropping it, because consumption is cost
   * attribution, not a second rupee out of the account.
   */
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  /**
   * Which farm the purchase is billed to. Required when the item is stocked
   * for more than one farm — the server refuses to guess — and must be one of
   * them, checked against the farms this caller was just authorized on.
   */
  @IsUUID()
  @IsOptional()
  billToFarmId?: string;

  /**
   * Client-minted UUID making a retried adjustment a no-op (F1): one movement
   * row, one money row, quantity moved once. Optional so the shipped client
   * keeps working; the mobile app always sends one.
   */
  @IsUUID()
  @IsOptional()
  idempotencyKey?: string;
}
