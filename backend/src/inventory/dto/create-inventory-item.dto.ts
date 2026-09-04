import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../inventory.constants';

export class CreateInventoryItemDto {
  @IsUUID()
  farmId: string;

  @IsString()
  name: string;

  @IsIn(INVENTORY_CATEGORIES as unknown as string[])
  category: string;

  /** MCI glyph name from the icon picker. */
  @IsString()
  @IsOptional()
  icon?: string;

  @IsNumber()
  @Min(0) // you cannot hold minus five bags of feed
  @IsOptional()
  quantity?: number;

  @IsIn(INVENTORY_UNITS as unknown as string[])
  @IsOptional()
  unit?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
