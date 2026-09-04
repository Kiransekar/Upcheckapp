import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  // Optional client-minted id for offline-queue idempotency (mirrors feed-
  // records/sampling): a retried timed-out POST returns the existing row
  // instead of double-recording income/expense into the farm P&L.
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  farmId: string;

  @IsDateString()
  transactionDate: string;

  @IsString()
  @IsIn(['income', 'expense'])
  type: string;

  @IsString()
  category: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;
}
