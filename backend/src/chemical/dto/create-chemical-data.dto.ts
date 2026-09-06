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
const CHEMICAL_PARAMETERS = [
  'alkalinityPpm',
  'hardnessPpm',
  'calciumCaPpm',
  'magnesiumMgPpm',
  'tomPpm',
  'totalAmmoniaPpm',
  'potassiumPpm',
];

export class CreateChemicalDataDto {
  /** A record must carry at least one reading — see the validator (L2). */
  @AtLeastOneOf(CHEMICAL_PARAMETERS)
  readonly hasAtLeastOneReading!: unknown;

  // Client-minted idempotency key — lets offline replays be safe (insert-or-return).
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  cropId: string;

  @IsDateString()
  measurementDate: string;

  @IsString()
  measurementTime: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ammoniaNh3Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nitriteNo2Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alkalinityPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nitrateNo3Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hardnessPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  calciumCaPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  magnesiumMgPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbonateCo3Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bicarbonateHco3Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tomPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ammoniumNh4Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  phosphatePo4Ppm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmmoniaPpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  potassiumPpm?: number;
}
