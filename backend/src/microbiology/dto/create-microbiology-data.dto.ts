import { AtLeastOneOf } from '../../common/validators/at-least-one-of.validator';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * The measurements. Free-text notes are deliberately excluded — a note is
 * not a reading, and a record carrying only a note still counts as "logged"
 * while leaving every derived figure untouched.
 */
const MICROBIOLOGY_PARAMETERS = [
  'totalBacillusCfuMl',
  'totalVibrioCountTvcCfuMl',
  'yellowVibrioCountTvcCfuMl',
  'greenVibrioCountTvcCfuMl',
  'luminescentBacteriaLbCfuMl',
];

export class CreateMicrobiologyDataDto {
  /** A record must carry at least one reading — see the validator (L2). */
  @AtLeastOneOf(MICROBIOLOGY_PARAMETERS)
  readonly hasAtLeastOneReading!: unknown;

  // Client-minted idempotency key — lets offline replays be safe (insert-or-return).
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  cropId: string;

  @IsDateString()
  measurementDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBacillusCfuMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalVibrioCountTvcCfuMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yellowVibrioCountTvcCfuMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  greenVibrioCountTvcCfuMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  luminescentBacteriaLbCfuMl?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
