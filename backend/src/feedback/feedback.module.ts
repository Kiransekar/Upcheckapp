import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackReport } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackStorageService } from './feedback-storage.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackAdminController } from './feedback-admin.controller';
import { AdminKeyGuard } from './admin-key.guard';
import { PushModule } from '../push/push.module';
// Same as auth/profiles: EmailService is provided per-module, not exported from
// a shared one. ConfigModule is global, so it needs nothing else.
import { EmailService } from '../email.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackReport]), PushModule],
  controllers: [FeedbackController, FeedbackAdminController],
  providers: [
    FeedbackService,
    FeedbackStorageService,
    AdminKeyGuard,
    EmailService,
  ],
})
export class FeedbackModule {}
