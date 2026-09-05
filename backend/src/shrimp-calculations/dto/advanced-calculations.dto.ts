import { IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CultivationPerformanceDto {
  @IsNumber()
  @Min(0)
  dailyFeed: number;

  @IsNumber()
  @Min(0)
  fr: number; // Feeding Rate %

  @IsNumber()
  @Min(0)
  abw: number; // Average Body Weight (g)

  @IsNumber()
  @Min(0)
  cumulativeFeed: number;

  @IsNumber()
  @Min(0)
  initialStocking: number;
}

export class FreeAmmoniaDto {
  @IsNumber()
  @Min(0)
  tan: number; // Total Ammonia Nitrogen (mg/L or ppm)

  @IsNumber()
  @Min(0)
  @Max(14)
  ph: number;

  @IsNumber()
  @Min(0)
  temperature: number; // Celsius

  @IsNumber()
  @Min(0)
  @IsOptional()
  salinity?: number; // ppt — Bower & Bidwell salinity correction (default 0 = freshwater)
}

export class ProductDosageDto {
  @IsNumber()
  @Min(0)
  pondArea: number; // m2

  @IsNumber()
  @Min(0)
  waterLevel: number; // m or cm? Formula usually uses depth. Let's assume meters.

  @IsNumber()
  @Min(0)
  dosage: number; // ppm
}
