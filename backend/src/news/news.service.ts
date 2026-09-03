import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, MoreThanOrEqual, Repository } from 'typeorm';
import { NewsArticle } from './news-article.entity';
import { NewsArticleTranslation } from './news-article-translation.entity';
import { CreateNewsArticleDto } from './dto/create-news-article.dto';
import { UpdateNewsArticleDto } from './dto/update-news-article.dto';
import { ListNewsDto } from './dto/list-news.dto';
import { PageDto, PageMetaDto } from '../common/dto/page.dto';
import { NEWS_FRESH_WINDOW_DAYS } from './feed-rules';

/** 42P01 undefined_table / 42703 undefined_column — this migration not run yet. */
function isMissingSchema(err: any): boolean {
  const code = err?.code ?? err?.driverError?.code;
  return code === '42P01' || code === '42703';
}

/** Locales the translation sidecar can hold. English is the article row. */
const TRANSLATABLE_LOCALES = ['hi', 'ta', 'te', 'bn', 'or'];

/** A page of news plus whether it actually reflects current events. */
export type NewsPageDto<T> = PageDto<T> & { fresh: boolean };

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    @InjectRepository(NewsArticle)
    private articlesRepository: Repository<NewsArticle>,
    @InjectRepository(NewsArticleTranslation)
    private translationsRepository: Repository<NewsArticleTranslation>,
  ) {}

  create(createDto: CreateNewsArticleDto) {
    const article = this.articlesRepository.create(createDto);
    return this.articlesRepository.save(article);
  }

  /**
   * Published articles from the last `NEWS_FRESH_WINDOW_DAYS`, newest first,
   * one page at a time.
   *
   * Only `published` rows are listed: `pending_review` exists precisely
   * because a human has not yet read a regulatory item, and `needs_summary`
   * has nothing to show. Pre-existing hand-written rows were backfilled to
   * `published` by the migration.
   *
   * The freshness cutoff is what stops a dead source from quietly serving
   * its years-old backlog as "news" once nothing new is coming in — see
   * NEWS_FRESH_WINDOW_DAYS in feed-rules.ts. `fresh: false` on an empty page
   * tells the client this is exactly that case (stale, not merely "nothing
   * in this category"), so it can show "no recent news" instead of either
   * an empty screen with no explanation or, worse, silently widening the
   * query and rendering a six-year-old recipe.
   */
  async findAll(query: Partial<ListNewsDto> = {}): Promise<NewsPageDto<NewsArticle>> {
    const take = query.take ?? 10;
    const page = query.page ?? 1;

    const where: FindOptionsWhere<NewsArticle> = { isActive: true };
    if (query.category) where.category = query.category;

    const freshCutoff = new Date(
      Date.now() - NEWS_FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    let items: NewsArticle[];
    let itemCount: number;
    try {
      [items, itemCount] = await this.articlesRepository.findAndCount({
        where: {
          ...where,
          status: 'published',
          publishedAt: MoreThanOrEqual(freshCutoff),
        },
        order: { publishedAt: 'DESC' },
        take,
        skip: (page - 1) * take,
      });
    } catch (err) {
      if (!isMissingSchema(err)) throw err;
      // The feed schema migration has not been applied to this database yet.
      // One unmigrated column must not 500 an endpoint that already ships.
      this.logger.warn(
        'news_articles.status missing — run migrations; serving unfiltered news',
      );
      [items, itemCount] = await this.articlesRepository.findAndCount({
        where: { ...where, publishedAt: MoreThanOrEqual(freshCutoff) },
        order: { publishedAt: 'DESC' },
        take,
        skip: (page - 1) * take,
      });
    }

    const data = await this.applyLocale(items, query.locale);
    const pageDto = new PageDto(
      data,
      new PageMetaDto({ pageOptionsDto: { page, take }, itemCount }),
    );
    return { ...pageDto, fresh: itemCount > 0 };
  }

  async findOne(id: string, locale?: string) {
    const article = await this.articlesRepository.findOneBy({ id });
    // An unpublished item is unpublished however it is reached — guessing an
    // id must not be a way around the regulatory review queue.
    if (!article || (article.status && article.status !== 'published')) {
      return null;
    }
    const [localized] = await this.applyLocale([article], locale);
    return localized;
  }

  /**
   * Overlay each article with its locale's translation where one exists.
   * v1 ships this table empty on purpose: `?locale=te` works from day one and
   * returns English, so turning languages on later is a backfill, not a
   * schema change or a client release.
   */
  private async applyLocale(
    articles: NewsArticle[],
    locale?: string,
  ): Promise<NewsArticle[]> {
    if (
      !locale ||
      !TRANSLATABLE_LOCALES.includes(locale) ||
      articles.length === 0
    ) {
      return articles;
    }
    let translations: NewsArticleTranslation[];
    try {
      translations = await this.translationsRepository.find({
        where: { articleId: In(articles.map((a) => a.id)), locale },
      });
    } catch (err) {
      if (!isMissingSchema(err)) throw err;
      this.logger.warn(
        'news_article_translations missing — run migrations; serving English news',
      );
      return articles;
    }
    const byArticleId = new Map(translations.map((t) => [t.articleId, t]));
    return articles.map((a) => {
      const t = byArticleId.get(a.id);
      if (!t) return a;
      return {
        ...a,
        title: t.title || a.title,
        summary: t.summary || a.summary,
      };
    });
  }

  async update(id: string, updateDto: UpdateNewsArticleDto) {
    await this.articlesRepository.update(id, updateDto);
    return this.articlesRepository.findOneBy({ id });
  }

  remove(id: string) {
    return this.articlesRepository.delete(id);
  }
}
