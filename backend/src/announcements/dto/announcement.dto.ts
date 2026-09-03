import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ANNOUNCEMENT_CATEGORIES,
  TRANSLATABLE_LOCALES,
} from '../announcement-locale';

/** One non-English translation, admin-supplied. Empty fields are allowed —
 *  the admin may fill some locales now and the rest later. */
export class AnnouncementTranslationInputDto {
  @IsIn(TRANSLATABLE_LOCALES as unknown as string[])
  locale: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  body?: string;
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key: string;

  @IsIn(ANNOUNCEMENT_CATEGORIES as unknown as string[])
  category: string;

  /** Required English title/body — the row every locale falls back to. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(TRANSLATABLE_LOCALES.length)
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTranslationInputDto)
  translations?: AnnouncementTranslationInputDto[];
}

/** Every field optional — the admin edits one section of a card at a time. */
export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  @MaxLength(64)
  key?: string;

  @IsIn(ANNOUNCEMENT_CATEGORIES as unknown as string[])
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  body?: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(TRANSLATABLE_LOCALES.length)
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTranslationInputDto)
  translations?: AnnouncementTranslationInputDto[];
}

/** Public GET query — just the reader's chosen language. */
export class ListAnnouncementsDto {
  @IsString()
  @IsOptional()
  locale?: string;
}
