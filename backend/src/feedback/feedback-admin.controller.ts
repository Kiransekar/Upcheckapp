import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/auth.decorators';
import { AdminKeyGuard } from './admin-key.guard';
import { FeedbackService } from './feedback.service';
import { ListFeedbackDto, UpdateFeedbackDto } from './dto/feedback.dto';

/**
 * Staff-only feedback inbox, called server-side by the Vercel dashboard.
 *
 * @Public() removes the global JwtAuthGuard (there is no farmer JWT here) and
 * AdminKeyGuard replaces it with the shared secret. Ordinary app users cannot
 * reach these routes: their bearer token is not the admin key, and the app
 * never learns what the admin key is.
 *
 * Unlike the routes in feedback.controller.ts, these are deliberately NOT
 * scoped to a user — reading every farmer's report is the whole job — which is
 * exactly why the guard has to be right.
 */
@Public()
@UseGuards(AdminKeyGuard)
@Controller('admin/feedback')
export class FeedbackAdminController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@Query() query: ListFeedbackDto) {
    return this.feedback.findAll(query);
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.findOneAsAdmin(id);
  }

  /** Change status, and/or write or edit the response the farmer sees. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedback.update(id, dto);
  }
}
