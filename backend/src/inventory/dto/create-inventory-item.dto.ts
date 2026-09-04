import {
  IsArray,
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
  /**
   * Kept for backward compatibility with the shipped client, which still
   * sends a single farm. Now optional at the DTO layer only: the multi-farm
   * client sends `farmIds` instead — but `InventoryService.create` rejects
   * the request with a 400 unless `farmId` or `farmIds` resolves to at least
   * one farm. An item can never be created unpaired.
   */
  @IsUUID()
  @IsOptional()
  farmId?: string;

  /** The farms to pair this item to. See `farmId` above — at least one is required. */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  farmIds?: string[];

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
