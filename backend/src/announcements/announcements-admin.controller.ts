import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/auth.decorators';
import { AdminKeyGuard } from '../feedback/admin-key.guard';
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

/**
 * Staff-only authoring, called server-side by the Vercel admin dashboard —
 * same shared-secret story as `feedback-admin.controller.ts` and
 * `news-admin.controller.ts`: @Public() drops the farmer JwtAuthGuard,
 * AdminKeyGuard replaces it with the shared ADMIN_API_KEY.
 */
@Public()
@UseGuards(AdminKeyGuard)
@Controller('admin/announcements')
export class AnnouncementsAdminController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list() {
    return this.announcements.findAll();
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(id, dto);
  }

  @Patch(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.publish(id);
  }

  @Patch(':id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.unpublish(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(id);
  }
}
