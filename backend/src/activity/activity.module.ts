import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

/**
 * No imports: the service needs only the global `DataSource` (it is one raw
 * UNION query, not fourteen repositories) and `FarmAccessService`, which the
 * global FarmAccessModule already provides.
 */
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
