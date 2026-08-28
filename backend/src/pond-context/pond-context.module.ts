import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pond } from '../ponds/pond.entity';
import { Crop } from '../crops/crop.entity';
import { SamplingData } from '../sampling/sampling-data.entity';
import { MortalityRecord } from '../mortality/mortality-record.entity';
import { FeedRecord } from '../feed-records/feed-record.entity';
import { FeedingTrayCheck } from '../feeding-tray-checks/feeding-tray-check.entity';
import { WaterQualityRecord } from '../water-quality/water-quality-record.entity';
import { PondContextService } from './pond-context.service';
import { PondContextController } from './pond-context.controller';
import { PondsModule } from '../ponds/ponds.module';
import { CropsModule } from '../crops/crops.module';
import { ShrimpCalculationsModule } from '../shrimp-calculations/shrimp-calculations.module';

/**
 * Pond-context snapshot — aggregates the farmer's latest logged values so the
 * decision engines never re-ask for them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SamplingData,
      MortalityRecord,
      FeedRecord,
      FeedingTrayCheck,
      WaterQualityRecord,
      Pond,
      Crop,
    ]),
    PondsModule,
    CropsModule,
    ShrimpCalculationsModule,
  ],
  controllers: [PondContextController],
  providers: [PondContextService],
  exports: [PondContextService],
})
export class PondContextModule {}
