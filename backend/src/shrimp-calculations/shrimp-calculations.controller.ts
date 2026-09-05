import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Query,
} from '@nestjs/common';
import { ShrimpCalculationsService } from './shrimp-calculations.service';
import {
  CalculateFcrDto,
  CalculateAdgDto,
  CalculateSurvivalRateDto,
  CalculateFeedingRateDto,
  CalculateExpectedHarvestDto,
  GrowthProjectionDto,
} from './dto/calculation.dto';
import {
  CultivationPerformanceDto,
  FreeAmmoniaDto,
  ProductDosageDto,
} from './dto/advanced-calculations.dto';

@Controller('shrimp-calculations')
export class ShrimpCalculationsController {
  constructor(
    private readonly calculationsService: ShrimpCalculationsService,
  ) {}

  @Post('fcr')
  calculateFcr(@Body() dto: CalculateFcrDto) {
    return {
      fcr: this.calculationsService.calculateFcr(
        dto.totalFeedKg,
        dto.harvestWeightKg,
      ),
    };
  }

  @Post('adg')
  calculateAdg(@Body() dto: CalculateAdgDto) {
    return {
      adgG: this.calculationsService.calculateAdg(
        dto.initialWeightG,
        dto.finalWeightG,
        dto.daysOfCulture,
      ),
    };
  }

  @Post('survival-rate')
  calculateSurvivalRate(@Body() dto: CalculateSurvivalRateDto) {
    return {
      survivalRatePercent: this.calculationsService.calculateSurvivalRate(
        dto.initialStock,
        dto.harvestedCount,
      ),
    };
  }

  @Post('daily-feed')
  calculateDailyFeed(@Body() dto: CalculateFeedingRateDto) {
    return {
      dailyFeedKg: this.calculationsService.calculateDailyFeed(
        dto.biomassKg,
        dto.feedingPercentage,
      ),
    };
  }

  @Post('expected-harvest')
  calculateExpectedHarvest(@Body() dto: CalculateExpectedHarvestDto) {
    return this.calculationsService.calculateExpectedHarvest(
      dto.stockingCount,
      dto.survivalRatePercent,
      dto.targetWeightG,
    );
  }

  @Post('growth-projection')
  projectGrowth(@Body() dto: GrowthProjectionDto) {
    return this.calculationsService.projectGrowth(
      dto.currentWeightG,
      dto.adgG,
      dto.daysToProject,
    );
  }

  @Post('cultivation-performance')
  calculatePerformance(@Body() dto: CultivationPerformanceDto) {
    return this.calculationsService.calculateCultivationPerformance(
      dto.dailyFeed,
      dto.fr,
      dto.abw,
      dto.cumulativeFeed,
      dto.initialStocking,
    );
  }

  @Post('free-ammonia')
  calculateFreeAmmonia(@Body() dto: FreeAmmoniaDto) {
    return this.calculationsService.calculateFreeAmmonia(
      dto.tan,
      dto.ph,
      dto.temperature,
      dto.salinity,
    );
  }

  @Post('product-amount')
  calculateProductAmount(@Body() dto: ProductDosageDto) {
    return this.calculationsService.calculateProductDosage(
      dto.pondArea,
      dto.waterLevel,
      dto.dosage,
    );
  }

  @Get('biomass')
  calculateBiomass(
    @Query('stockCount') stockCount: string,
    @Query('averageWeightG') averageWeightG: string,
  ) {
    const stock = Number(stockCount);
    const weight = Number(averageWeightG);
    if (!Number.isFinite(stock) || !Number.isFinite(weight)) {
      throw new BadRequestException(
        'stockCount and averageWeightG must be numbers',
      );
    }
    return {
      biomassKg: this.calculationsService.calculateBiomass(stock, weight),
    };
  }

  @Get('recommended-feeding-rate')
  getRecommendedFeedingRate(
    @Query('averageWeightG') averageWeightG: string,
    @Query('species') species?: string,
  ) {
    // Nest hands query params through as strings, so the old `: number` type was
    // decorative: Number('abc') is NaN, every `<` rung in the step table is
    // false, and control fell to the unconditional tail `return 1.8`. Empty
    // string became 0 and matched the post-larvae bucket. Both were returned as
    // confident advice (QA BUG-004). Mirrors the biomass handler above.
    const weight = Number(averageWeightG);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException('averageWeightG must be a positive number');
    }
    return {
      recommendedFeedingRatePercent:
        this.calculationsService.getRecommendedFeedingRate(weight, species),
    };
  }
}
