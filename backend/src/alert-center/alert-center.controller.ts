import { Controller, Get, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AlertCenterService } from './alert-center.service';
import { EngineAlertService } from './engine-alert.service';
import type { AlertSeverity } from './alert-center.service';

interface EmitBody {
  pondId?: string;
  farmId?: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  steps?: string[];
}

/** Unified Alert Center: emit + per-pond morning briefing. */
@Controller('alert-center')
export class AlertCenterController {
  constructor(
    private readonly service: AlertCenterService,
    private readonly engineAlerts: EngineAlertService,
  ) {}

  /** Per-pond morning briefing from the caller's unread (persisted) alerts. */
  @Get('briefing')
  briefing(@CurrentUser() user) {
    return this.service.morningBriefing(user.id);
  }

  /**
   * LIVE briefing — engine alerts recomputed from each active pond's latest
   * logged data. Always current, never duplicated (not persisted).
   */
  @Get('live-briefing')
  liveBriefing(@CurrentUser() user) {
    return this.engineAlerts.liveBriefing(user.id);
  }

  /**
   * The home screen in one round trip: `{ contexts, briefing }`.
   *
   * Same body as `live-briefing`, plus the pond contexts it already computed
   * to produce it. The screen used to fetch live-briefing AND /pond-context
   * per farm, which walked the identical contexts a second time. Both of those
   * routes stay — other screens use them.
   */
  @Get('today')
  today(@CurrentUser() user) {
    return this.engineAlerts.today(user.id);
  }

  /** Emit an alert into the unified stream. */
  @Post('emit')
  emit(@Body() body: EmitBody, @CurrentUser() user) {
    return this.service.emit({ ...body, userId: user.id });
  }
}
