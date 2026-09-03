import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { ListAnnouncementsDto } from './dto/announcement.dto';

/**
 * The farmer's side: what the app calls on open.
 *
 * No @Public() — this rides the global JwtAuthGuard like every other farmer
 * route, so a request needs the app's own bearer token, not the admin key.
 */
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  /** GET /announcements?locale=te — published, not-yet-dismissed, ordered,
   *  each card carrying every translation so the farmer can switch
   *  language without a second request. */
  @Get()
  forMe(@Query() query: ListAnnouncementsDto, @CurrentUser() user) {
    return this.announcements.findForUser(user.id, query.locale);
  }

  /** POST /announcements/:id/dismiss — server-side, per-user, so dismissing
   *  on one phone does not resurrect the card on another. */
  @Post(':id/dismiss')
  dismiss(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user) {
    return this.announcements.dismiss(user.id, id);
  }
}
