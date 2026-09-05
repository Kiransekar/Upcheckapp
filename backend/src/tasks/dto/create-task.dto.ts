import { Type } from 'class-transformer';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  Min,
  Max,
  Matches,
  ValidateNested,
} from 'class-validator';

export const TASK_TYPES = [
  'FEED',
  'WATER_TEST',
  'SAMPLING',
  'AERATOR_CHECK',
  'MORTALITY_CHECK',
  'HARVEST_PREP',
  'OTHER',
] as const;

export const TASK_SCOPES = ['farm', 'personal'] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:mm

/**
 * A recurring task is ONE template row, not N pre-generated rows. Instances are
 * materialised lazily on read — there is no scheduler in this backend.
 */
export class RecurrenceDto {
  @IsIn(['daily', 'weekly'])
  freq: 'daily' | 'weekly';

  /** 0 = Sunday … 6 = Saturday. Weekly only; omitted means "same weekday". */
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  byWeekday?: number;

  /** Last date the series runs. Omitted = forever. */
  @IsDateString()
  @IsOptional()
  until?: string;
}

export class CreateTaskDto {
  @IsUUID()
  farmId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsIn(TASK_TYPES as unknown as string[])
  @IsOptional()
  type?: string;

  @IsIn(['open', 'in_progress', 'done', 'verified', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: string;

  @IsIn(TASK_SCOPES as unknown as string[])
  @IsOptional()
  scope?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @Matches(TIME_RE, { message: 'timeWindowStart must be HH:mm' })
  @IsOptional()
  timeWindowStart?: string;

  @Matches(TIME_RE, { message: 'timeWindowEnd must be HH:mm' })
  @IsOptional()
  timeWindowEnd?: string;

  @ValidateNested()
  @Type(() => RecurrenceDto)
  @IsOptional()
  recurrence?: RecurrenceDto;

  @IsUUID()
  @IsOptional()
  pondId?: string;

  @IsUUID()
  @IsOptional()
  cropId?: string;

  /**
   * AN EMPTY ARRAY MEANS EVERYONE IN SCOPE, not nobody — see TaskAssignee.
   * Every id must be an active member of `farmId`, and must have access to
   * `pondId` when one is set; the service rejects rather than dropping.
   */
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  assigneeIds?: string[];
}
