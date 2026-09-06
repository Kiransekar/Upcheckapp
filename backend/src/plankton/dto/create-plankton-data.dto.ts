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
const PLANKTON_PARAMETERS = [
  'greenAlgaeGaCellMl',
  'blueGreenAlgaeBgaCellMl',
  'dinoflagellataCellMl',
  'diatomCellMl',
  'protozoaCellMl',
  'flocCellMl',
  'goldenBrownAlgaeCellMl',
  'euglenophytaCellMl',
  'zooCellMl',
  'haptoyphytaCellMl',
  'goldenGreenAlgaeCellMl',
  'yellowGreenAlgaeCellMl',
  'otherPlanktonCellMl',
];

export class CreatePlanktonDataDto {
  /** A record must carry at least one reading — see the validator (L2). */
  @AtLeastOneOf(PLANKTON_PARAMETERS)
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
  greenAlgaeGaCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  blueGreenAlgaeBgaCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dinoflagellataCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diatomCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  protozoaCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flocCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldenBrownAlgaeCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  euglenophytaCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  zooCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  haptoyphytaCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldenGreenAlgaeCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yellowGreenAlgaeCellMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherPlanktonCellMl?: number;
}
