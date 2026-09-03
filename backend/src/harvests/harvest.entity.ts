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
import { Crop } from '../crops/crop.entity';

@Entity('harvests')
export class Harvest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'crop_id', type: 'uuid' })
  cropId: string;

  @ManyToOne(() => Crop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crop_id' })
  crop: Crop;

  @Column({ type: 'date', name: 'harvest_date' })
  harvestDate: Date;

  @Column({ type: 'float', name: 'weight_kg' })
  weightKg: number;

  @Column({ type: 'int', nullable: true })
  count: number | null;

  @Column({ type: 'float', name: 'average_size', nullable: true })
  averageSize: number | null; // ABW/Size count per kg

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'sale_price_total',
    nullable: true,
  })
  salePriceTotal: number | null;

  @Column({ type: 'varchar', name: 'buyer_name', nullable: true })
  buyerName: string | null;

  @Column({
    type: 'enum',
    enum: ['partial', 'full'],
    name: 'harvest_type',
    default: 'partial',
  })
  harvestType: 'partial' | 'full';

  @Column({
    type: 'enum',
    enum: ['pending', 'sold', 'discarded'],
    default: 'sold',
  })
  status: 'pending' | 'sold' | 'discarded';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Who logged and who last edited this harvest. A harvest closes a cycle and
  // books revenue, so "who did this?" has to be answerable; the ten operational
  // log tables have carried these since 1780300800000 and the money-bearing
  // ones did not. Nullable — historical rows have no actor, and a user deletion
  // sets them null rather than cascading the harvest away.
  // Column DDL lives in migration 1780500300000.
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
