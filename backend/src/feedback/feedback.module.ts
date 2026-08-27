import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackReport } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackStorageService } from './feedback-storage.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackAdminController } from './feedback-admin.controller';
import { AdminKeyGuard } from './admin-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackReport])],
  controllers: [FeedbackController, FeedbackAdminController],
  providers: [FeedbackService, FeedbackStorageService, AdminKeyGuard],
})
export class FeedbackModule {}
