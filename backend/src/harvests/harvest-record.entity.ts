import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Crop } from '../crops/crop.entity';

@Entity('harvest_records')
export class HarvestRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'crop_id', type: 'uuid' })
  cropId: string;

  @ManyToOne(() => Crop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crop_id' })
  crop: Crop;

  @Column({ type: 'date', name: 'harvest_date' })
  harvestDate: Date;

  @Column({ type: 'text', nullable: true, name: 'harvest_type' })
  harvestType: string; // 'partial' | 'final' | 'emergency'

  @Column({ type: 'numeric', name: 'total_weight_kg' })
  totalWeightKg: number;

  @Column({ type: 'int', nullable: true, name: 'count_per_kg' })
  countPerKg: number; // size

  @Column({ type: 'int', nullable: true, name: 'price_per_kg_rp' })
  pricePerKgRp: number;

  @Column({ type: 'text', nullable: true, name: 'buyer_name' })
  buyerName: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  // Audit: who created / last updated this record (member or owner).
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;
}
