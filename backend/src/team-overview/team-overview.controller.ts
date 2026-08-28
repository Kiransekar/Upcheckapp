import { Controller, Get, Query, Req } from '@nestjs/common';
import { TeamOverviewService } from './team-overview.service';

/**
 * `GET /team/overview` — the whole Team tab in one request.
 *
 * No route guard is needed beyond the global JwtAuthGuard: the service scopes
 * everything to the caller's own farms and re-uses the per-farm capability
 * checks of the underlying services. A non-member's farm list is empty, so the
 * response is empty.
 */
@Controller('team')
export class TeamOverviewController {
  constructor(private readonly overview: TeamOverviewService) {}

  @Get('overview')
  async get(@Req() req: any, @Query('farmId') farmId?: string) {
    return this.overview.forUser(req.user.id, farmId);
  }
}
