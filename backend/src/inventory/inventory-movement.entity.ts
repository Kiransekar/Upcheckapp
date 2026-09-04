import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

/**
 * One stock change. Append-only: nothing updates or deletes a row here.
 *
 * `delta` is signed — negative is a deduction (a feed log), positive a credit
 * (a purchase, or the compensating credit when a feed save fails after the
 * stock was already taken).
 */
@Entity('inventory_movements')
@Index(['inventoryId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  item: InventoryItem;

  @Column({ type: 'numeric' })
  delta: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Null when the actor is gone — the movement still happened. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  /** No FK: feed records are hard-deleted and the movement must outlive them. */
  @Column({ name: 'feed_record_id', type: 'uuid', nullable: true })
  feedRecordId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
