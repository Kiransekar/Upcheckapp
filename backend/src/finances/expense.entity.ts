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
import { Pond } from '../ponds/pond.entity';
import { User } from '../auth/user.entity';

export enum ExpenseCategory {
  FEED = 'Feed',
  PROBIOTICS = 'Chemicals/Probiotics',
  SEED = 'Seed (Fry)',
  LABOR = 'Labor',
  ENERGY = 'Energy (Fuel/Electricity)',
  MAINTENANCE = 'Maintenance',
  OTHER = 'Other',
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'crop_id', type: 'uuid', nullable: true })
  cropId: string | null;

  @ManyToOne(() => Crop, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'crop_id' })
  crop: Crop;

  @Index()
  @Column({ name: 'pond_id', type: 'uuid' })
  pondId: string;

  @ManyToOne(() => Pond, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pond_id' })
  pond: Pond;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: ExpenseCategory })
  category: ExpenseCategory;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
