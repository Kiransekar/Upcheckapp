import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateInventoryItemDto } from './create-inventory-item.dto';

/**
 * `farmId` is omitted deliberately (D14): PartialType(Create) made it patchable,
 * so a PATCH could move an item into a farm the caller happened to own. An item
 * belongs to the farm it was created on.
 *
 * `farmIds` is omitted too (Task 8): re-pairing an item goes through
 * `InventoryService.setPairing` (asserted against both the old and new farm
 * sets), not through this general-purpose PATCH.
 */
export class UpdateInventoryItemDto extends PartialType(
  OmitType(CreateInventoryItemDto, ['farmId', 'farmIds'] as const),
) {}
