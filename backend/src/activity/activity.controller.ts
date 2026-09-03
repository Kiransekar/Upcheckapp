import { Controller, Get, Query, Req } from '@nestjs/common';
import { ActivityService } from './activity.service';

/**
 * `GET /api/activity` — the cross-table timeline.
 *
 * No route guard beyond the global JwtAuthGuard: the service scopes every row
 * to `getAccessibleFarmIds` and asserts READ on an explicit `farmId`/`pondId`,
 * so there is nothing here for a guard to add.
 */
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('farmId') farmId?: string,
    @Query('pondId') pondId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    // Repeatable: `?kinds=feed&kinds=harvest`. Express hands a single
    // occurrence over as a string, so normalise both shapes to an array.
    @Query('kinds') kinds?: string | string[],
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.activity.list(req.user.id, {
      farmId,
      pondId,
      from,
      to,
      kinds: kinds === undefined ? undefined : ([] as string[]).concat(kinds),
      limit: limit === undefined ? undefined : Number(limit),
      cursor,
    });
  }
}
