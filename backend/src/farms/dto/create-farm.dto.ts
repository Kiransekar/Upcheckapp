import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsLatitude,
  IsLongitude,
  IsIn,
  IsArray,
  IsNotEmpty,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BoundaryPointDto } from '../../common/dto/boundary-point.dto';

export class CreateFarmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // NOTE: no `farmCode` here on purpose. It used to be an optional
  // client-supplied 50-char string that `farms.service.create()` preferred over
  // `generateFarmCode()`, which defeated the generator's entropy entirely — and
  // while the farm code doubles as the join credential, that let an owner pick
  // a trivially guessable one. The code is always generated server-side now.

  @IsOptional()
  @IsNumber()
  areaHectares?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsIn(['tidal', 'river', 'borehole', 'reservoir', 'recycled'])
  waterSourceType?: string;

  // Number of ponds the owner declares at first-run setup (planning target).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  plannedPondCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  privacySetting?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BoundaryPointDto)
  boundary?: BoundaryPointDto[];

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  qrCodeUrl?: string;
}
