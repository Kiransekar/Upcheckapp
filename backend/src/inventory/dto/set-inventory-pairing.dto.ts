import { IsArray, IsUUID } from 'class-validator';

/** Body for `PATCH /inventory/:id/farms` — replaces the item's farm pairing. */
export class SetInventoryPairingDto {
  @IsArray()
  @IsUUID('4', { each: true })
  farmIds: string[];
}
