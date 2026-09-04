import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Farm } from '../farms/farm.entity';

@Entity('inventory')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The single-farm fast path. Nullable since Task 8: an item may now be
   * paired to zero, one or many farms via `inventory_farms`, which is
   * authoritative. This column holds the first/primary farm for quick reads
   * and legacy rows written before the backfill.
   */
  @Index()
  @Column({ name: 'farm_id', type: 'uuid', nullable: true })
  farmId: string | null;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'text' })
  name: string;

  /** One of INVENTORY_CATEGORIES — the same five the UI offers. */
  @Column({ type: 'text' })
  category: string;

  /** MCI glyph name picked in the icon picker; null = derive from category. */
  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ type: 'numeric', default: 0 })
  quantity: number;

  /** One of INVENTORY_UNITS. */
  @Column({ type: 'text', nullable: true })
  unit: string;

  @Column({ name: 'unit_price', type: 'numeric', nullable: true })
  unitPrice: number;

  @Column({ name: 'reorder_level', type: 'numeric', nullable: true })
  reorderLevel: number;

  @Column({ type: 'text', nullable: true })
  supplier: string;

  /**
   * When the item EXPIRES. There is no last-purchase column and never was —
   * the client rendered this under a "Last Purchase" label (D3), which is a
   * label bug, not a missing field. Do not add a purchase date here; purchases
   * become transactions in Phase 3 (§5).
   */
  @Column({
    name: 'expiry_date',
    type: 'timestamp with time zone',
    nullable: true,
  })
  expiryDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * Reason given for the most recent stock adjustment. Stop-gap for the
   * `inventory_movements` ledger (Phase 3): one reason, not a history.
   */
  @Column({ name: 'last_adjustment_reason', type: 'text', nullable: true })
  lastAdjustmentReason: string | null;
}
