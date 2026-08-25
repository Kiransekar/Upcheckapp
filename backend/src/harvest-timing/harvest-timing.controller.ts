import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  HarvestTimingService,
  HarvestTimingInput,
} from './harvest-timing.service';
import { HarvestRecommendation } from './harvest-recommendation.entity';
import { PricingService } from '../india/pricing.service';
import { PondsService } from '../ponds/ponds.service';
import { OptimizeHarvestTimingDto } from './dto/optimize.dto';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';

/** Harvest-Timing Decision Engine (farmer_features_spec.md §1). */
@Controller('harvest-timing')
export class HarvestTimingController {
  constructor(
    private readonly service: HarvestTimingService,
    private readonly pricing: PricingService,
    private readonly pondsService: PondsService,
    @InjectRepository(HarvestRecommendation)
    private readonly repo: Repository<HarvestRecommendation>,
  ) {}

  /**
   * Compute the projection + verdict. Resolves price bands from `region` when
   * `priceBands` is omitted; optionally persists when `persist` + `pondId`.
   *
   * No route-level OwnershipGuard: `pondId` is optional here (a pure preview
   * carries none), and the guard 404s when it cannot resolve a resource id.
   * The persist branch asserts WRITE_MANAGEMENT on the pond before writing,
   * which is the enforcement point for the only part of this route that
   * touches farm data.
   */
  @Post('optimize')
  async optimize(@Body() body: OptimizeHarvestTimingDto, @CurrentUser() user) {
    let priceBands = body.priceBands;
    if ((!priceBands || !priceBands.length) && body.region) {
      const feed = await this.pricing.latestForRegion(body.region);
      priceBands = feed ? this.pricing.bandsFromPrices(feed.prices) : [];
    }
    if (!priceBands || !priceBands.length) {
      throw new BadRequestException(
        'priceBands or a region with a feed is required',
      );
    }

    const input: HarvestTimingInput = {
      abwNow: body.abwNow ?? 0,
      adgNow: body.adgNow ?? 0,
      adgDecay: body.adgDecay,
      nNow: body.nNow ?? 0,
      dailySurvival: body.dailySurvival ?? 0.999,
      areaM2: body.areaM2 ?? 0,
      carryingCapacityKgM2: body.carryingCapacityKgM2 ?? 1.5,
      feedPricePerKg: body.feedPricePerKg ?? 0,
      priceBands,
      diseaseRisk: body.diseaseRisk,
      species: body.species,
      horizon: body.horizon,
    };
    const result = this.service.optimize(input);

    if (body.persist && body.pondId) {
      // Persisting an optimisation result is planning — WRITE_MANAGEMENT.
      await this.pondsService.verifyAccess(body.pondId, user.id, 'WRITE_MANAGEMENT');
      const saved = await this.repo.save(
        this.repo.create({
          pondId: body.pondId,
          cropId: body.cropId ?? null,
          recommendNow: result.recommendNow,
          optimalDay: result.optimalDay,
          netNow: result.netNow,
          netOptimal: result.netOptimal,
          expectedGain: result.expectedGain,
          result,
        }),
      );
      return { ...result, id: saved.id };
    }
    return result;
  }

  @Get('pond/:pondId')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  async recent(@Param('pondId') pondId: string, @CurrentUser() user) {
    await this.pondsService.verifyAccess(pondId, user.id, 'READ');
    return this.repo.find({
      where: { pondId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
