import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateInventoryItemDto } from './create-inventory-item.dto';

/**
 * `farmId` is omitted deliberately (D14): PartialType(Create) made it patchable,
 * so a PATCH could move an item into a farm the caller happened to own. An item
 * belongs to the farm it was created on.
 */
export class UpdateInventoryItemDto extends PartialType(
  OmitType(CreateInventoryItemDto, ['farmId'] as const),
) {}
