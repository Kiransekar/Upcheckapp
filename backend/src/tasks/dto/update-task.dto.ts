import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/**
 * `farmId` and `scope` are deliberately not patchable: moving a task between
 * farms or flipping a personal note into a farm-wide one would change who can
 * see it, which is a create decision, not an edit.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['farmId', 'scope'] as const),
) {}
