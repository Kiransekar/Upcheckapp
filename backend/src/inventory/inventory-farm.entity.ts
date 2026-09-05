import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Farm } from '../farms/farm.entity';

/**
 * Which farms an inventory item is stocked for.
 *
 * Shaped after `farm_member_ponds` — composite PK, both sides CASCADE, no
 * surrogate id, no timestamps.
 *
 * ONE DELIBERATE INVERSION, and it is the opposite of the table this copies:
 * in `farm_member_ponds`, ZERO ROWS MEANS ACCESS TO EVERY POND. Here, ZERO
 * ROWS MEANS UNPAIRED — the item belongs to no farm and appears in no farm's
 * list. Do not "fix" this to match the mirror; doing so would silently stock
 * every item at every farm.
 */
@Entity('inventory_farms')
@Index(['inventoryId'])
export class InventoryFarm {
  @PrimaryColumn({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @PrimaryColumn({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  item: InventoryItem;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;
}
