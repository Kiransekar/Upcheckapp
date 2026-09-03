import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  IsInt,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { CANONICAL_SPECIES, SEED_TYPES } from '../species';

export class CreateCropDto {
  @IsUUID()
  pondId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  cropCode?: string;

  // Closed lists (see species.ts) — free text let 'VannameiVannamei' into prod
  // and broke threshold lookup. Still optional.
  @IsString()
  @IsOptional()
  @IsIn(CANONICAL_SPECIES)
  speciesType?: string;

  @IsString()
  @IsOptional()
  @IsIn(SEED_TYPES)
  seedType?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stockingDensity?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  stockingCount?: number;

  @IsDateString()
  @IsOptional()
  stockingDate?: string;

  @IsDateString()
  @IsOptional()
  expectedHarvestDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  status?: string;

  // ── Stocking detail + cycle targets (consumed by the decision engines /
  //    simulation: carrying capacity, target SR, feed price, target size). ──
  @IsInt()
  @IsOptional()
  @Min(0)
  totalSeed?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  feedPriceRpPerKg?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  carryingCapacityKgM2?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  targetCultivationDays?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  targetSize?: number; // pieces/kg

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  targetSrPercent?: number;

  @IsString()
  @IsOptional()
  @IsIn(['feed_ratio', 'fixed', 'measurements', 'stp_table', 'custom_table'])
  srPredictionMethod?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  initialAgeDays?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  preparationDays?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  totalFeedingTrays?: number;

  @IsUUID()
  @IsOptional()
  hatcheryId?: string;

  @IsUUID()
  @IsOptional()
  speciesId?: string;

  @IsUUID()
  @IsOptional()
  broodstockId?: string;
}
