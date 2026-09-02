import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateNewsArticleDto {
  @IsString()
  title: string;

  /** Hand-written editorial body. Optional — a link-out item has none. */
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsDateString()
  @IsOptional()
  publishedAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
