import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Farm } from '../farms/farm.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ name: 'transaction_date', type: 'timestamp with time zone' })
  transactionDate: Date;

  @Column({ type: 'text' })
  type: string; // income, expense

  @Column({ type: 'text' })
  category: string; // feed, labor, electricity, harvest_sale, etc.

  @Column({ type: 'numeric' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'payment_method', type: 'text', nullable: true })
  paymentMethod: string;

  @Column({ name: 'reference_number', type: 'text', nullable: true })
  referenceNumber: string;

  // Audit: who created / last updated this money row (member or owner).
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;
}
