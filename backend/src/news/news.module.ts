import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NewsService } from './news.service';
import { NewsIngestionService } from './news-ingestion.service';
import { NewsController } from './news.controller';
import { NewsAdminController } from './news-admin.controller';
import { AdminKeyGuard } from '../feedback/admin-key.guard';
import { NewsArticle } from './news-article.entity';
import { NewsArticleTranslation } from './news-article-translation.entity';
import { NewsSource } from './news-source.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsArticle, NewsArticleTranslation, NewsSource]),
    // Registered here rather than in AppModule because news ingestion is the
    // only scheduled work in the app; if a second module ever needs cron, move
    // this up to AppModule so forRoot() is called exactly once.
    ScheduleModule.forRoot(),
  ],
  controllers: [NewsController, NewsAdminController],
  providers: [NewsService, NewsIngestionService, AdminKeyGuard],
  exports: [NewsService],
})
export class NewsModule {}
