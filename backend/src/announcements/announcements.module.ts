import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './announcement.entity';
import { AnnouncementTranslation } from './announcement-translation.entity';
import { AnnouncementDismissal } from './announcement-dismissal.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsAdminController } from './announcements-admin.controller';
import { AdminKeyGuard } from '../feedback/admin-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      AnnouncementTranslation,
      AnnouncementDismissal,
    ]),
  ],
  controllers: [AnnouncementsController, AnnouncementsAdminController],
  providers: [AnnouncementsService, AdminKeyGuard],
})
export class AnnouncementsModule {}
