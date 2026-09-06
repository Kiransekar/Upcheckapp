import { AtLeastOneOf } from '../../common/validators/at-least-one-of.validator';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

/**
 * Physical-range bounds (VALID-1). Deliberately permissive — they catch
 * fat-finger typos (pH 999, negative DO) that would trip false "critical"
 * alerts, without rejecting unusual-but-real field readings. Ranges also
 * propagate to the update DTO via PartialType.
 *
 *   Field          | Min | Max  | Unit
 *   ---------------|-----|------|------
 *   ph             |  0  | 14   | pH
 *   temperature    |  0  | 50   | °C
 *   dissolvedOxygen|  0  | 30   | mg/L
 *   salinity       |  0  | 60   | ppt
 *   ammonia        |  0  | 100  | mg/L
 *   nitrite        |  0  | 100  | mg/L
 *   nitrate        |  0  | 500  | mg/L
 *   alkalinity     |  0  | 1000 | mg/L
 *   hardness       |  0  | 5000 | mg/L
 *   transparency   |  0  | 300  | cm
 */
/**
 * The measurements. `notes` is deliberately NOT among them — a note is not a
 * reading, and a record carrying only a note leaves every `*AsOf` untouched
 * while still counting as "logged".
 */
const WATER_QUALITY_PARAMETERS = [
  'ph',
  'temperature',
  'dissolvedOxygen',
  'salinity',
  'ammonia',
  'nitrite',
  'nitrate',
  'alkalinity',
  'hardness',
  'transparency',
];

export class CreateWaterQualityRecordDto {
  /**
   * A record must carry at least one reading (L2 / D2).
   *
   * Every parameter here is optional, so a completely blank payload used to
   * save — and `logProgress.pondSlotDone` only asks whether a record EXISTS in
   * the slot, so the reminder stopped, the Today card went green and the
   * streak held on no data at all.
   */
  @AtLeastOneOf(WATER_QUALITY_PARAMETERS)
  readonly hasAtLeastOneReading!: unknown;

  // Client-minted idempotency key — lets offline replays be safe (insert-or-return).
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  pondId: string;

  // Actual measurement time, for offline-queued records synced later. Falls
  // back to server insert time when omitted (AUDIT id 31).
  @IsDateString()
  @IsOptional()
  recordedAt?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(14)
  ph?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(30)
  dissolvedOxygen?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(60)
  salinity?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  ammonia?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  nitrite?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  nitrate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1000)
  alkalinity?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5000)
  hardness?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(300)
  transparency?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
