import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  MAX_ATTACHMENTS,
} from '../feedback-status';

export class CreateFeedbackDto {
  @IsIn(FEEDBACK_CATEGORIES as unknown as string[])
  category: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  subject?: string;

  // The only required field. 4000 characters is a long paragraph on a phone —
  // enough for a thorough person, and a bound so one paste cannot fill a row.
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsUUID()
  @IsOptional()
  farmId?: string;

  /**
   * Storage paths returned by POST /feedback/attachment.
   *
   * These arrive from the client, so the service re-checks that every path is
   * inside the caller's own folder before saving — otherwise a farmer could
   * attach someone else's photo to their own report and read it back through
   * the signed URL on the detail screen.
   */
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  attachmentPaths?: string[];
}

/** Admin: set status, write or edit the response. Every field optional. */
export class UpdateFeedbackDto {
  @IsIn(FEEDBACK_STATUSES as unknown as string[])
  @IsOptional()
  status?: string;

  // An empty string is how the dashboard clears a response it should not have
  // sent, so this is deliberately not @IsNotEmpty.
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  adminResponse?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  respondedBy?: string;
}

/** Admin list filters. */
export class ListFeedbackDto {
  @IsIn(FEEDBACK_STATUSES as unknown as string[])
  @IsOptional()
  status?: string;

  @IsIn(FEEDBACK_CATEGORIES as unknown as string[])
  @IsOptional()
  category?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;
}
