import { IsIn, IsOptional, IsString } from 'class-validator';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { NEWS_CATEGORIES } from '../feed-rules';

/** Query for `GET /news`. Paginated so a daily ingestion run can't grow the
 *  response until a 2 GB phone on 2G gives up on it. */
export class ListNewsDto extends PageOptionsDto {
  @IsString()
  @IsIn(NEWS_CATEGORIES as unknown as string[])
  @IsOptional()
  readonly category?: string;

  /**
   * Requested content language. Falls back to English per article when no
   * translation row exists — which, in v1, is every article.
   */
  @IsString()
  @IsOptional()
  readonly locale?: string;
}
