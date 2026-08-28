import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { NewsArticle } from './news-article.entity';
import { NewsArticleTranslation } from './news-article-translation.entity';
import { CreateNewsArticleDto } from './dto/create-news-article.dto';
import { UpdateNewsArticleDto } from './dto/update-news-article.dto';
import { ListNewsDto } from './dto/list-news.dto';
import { PageDto, PageMetaDto } from '../common/dto/page.dto';

/** 42P01 undefined_table / 42703 undefined_column — this migration not run yet. */
function isMissingSchema(err: any): boolean {
  const code = err?.code ?? err?.driverError?.code;
  return code === '42P01' || code === '42703';
}

/** Locales the translation sidecar can hold. English is the article row. */
const TRANSLATABLE_LOCALES = ['hi', 'ta', 'te', 'bn', 'or'];

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
   * Published articles, newest first, one page at a time.
   *
   * Only `published` rows are listed: `pending_review` exists precisely
   * because a human has not yet read a regulatory item, and `needs_summary`
   * has nothing to show. Pre-existing hand-written rows were backfilled to
   * `published` by the migration.
   */
  async findAll(query: Partial<ListNewsDto> = {}): Promise<PageDto<NewsArticle>> {
    const take = query.take ?? 10;
    const page = query.page ?? 1;

    const where: FindOptionsWhere<NewsArticle> = { isActive: true };
    if (query.category) where.category = query.category;

    let items: NewsArticle[];
    let itemCount: number;
    try {
      [items, itemCount] = await this.articlesRepository.findAndCount({
        where: { ...where, status: 'published' },
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
        where,
        order: { publishedAt: 'DESC' },
        take,
        skip: (page - 1) * take,
      });
    }

    const data = await this.applyLocale(items, query.locale);
    return new PageDto(
      data,
      new PageMetaDto({ pageOptionsDto: { page, take }, itemCount }),
    );
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
