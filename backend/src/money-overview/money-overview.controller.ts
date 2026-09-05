import { Controller, Get, Query, Req } from '@nestjs/common';
import { MoneyOverviewService } from './money-overview.service';
import { MoneyOverviewQueryDto } from '../transactions/dto/money-query.dto';

/**
 * `GET /money/overview` — the whole Money tab in one request.
 *
 * No route guard beyond the global JwtAuthGuard: the service scopes everything
 * to the caller's own farms and reuses the underlying services' capability
 * checks, so a caller with no farms gets an empty response.
 */
@Controller('money')
export class MoneyOverviewController {
  constructor(private readonly overview: MoneyOverviewService) {}

  @Get('overview')
  async get(@Req() req: any, @Query() q: MoneyOverviewQueryDto) {
    return this.overview.forUser(req.user.id, q);
  }
}
