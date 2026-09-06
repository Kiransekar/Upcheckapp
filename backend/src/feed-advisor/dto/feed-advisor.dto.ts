import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  IsDateString,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TrayResidue } from '../feed-advisor.service';

const TRAY: TrayResidue[] = ['empty', 'few_left', 'a_lot_left'];

export class RationInputDto {
  @IsNumber()
  @Min(0)
  livePopulation: number;

  @IsNumber()
  @Min(0)
  abwG: number;

  @IsString()
  @IsOptional()
  species?: string;

  @IsNumber()
  @IsOptional()
  fr?: number;

  @IsIn(TRAY)
  @IsOptional()
  lastTray?: TrayResidue;

  @IsBoolean()
  @IsOptional()
  inMoltPeak?: boolean;

  @IsNumber()
  @IsOptional()
  do?: number;

  @IsNumber()
  @IsOptional()
  nh3?: number;

  @IsNumber()
  @IsOptional()
  temp?: number;

  @IsBoolean()
  @IsOptional()
  fasting?: boolean;

  @IsNumber()
  @IsOptional()
  mealsPerDay?: number;

  /**
   * Pond-context confidence, 0-100 (E2). Optional: an older client sends
   * nothing and gets the old point-value behaviour, unchanged.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;
}

export class GenerateFeedPlanDto {
  @IsUUID()
  pondId: string;

  @IsUUID()
  @IsOptional()
  cropId?: string;

  @IsDateString()
  date: string;

  @ValidateNested()
  @Type(() => RationInputDto)
  input: RationInputDto;
}

export class LogActualDto {
  @IsNumber()
  @Min(0)
  actualKg: number;
}
