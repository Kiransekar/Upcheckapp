import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Farm } from '../farms/farm.entity';
import { Crop } from '../crops/crop.entity';

export type PondGeometryType =
  | 'rectangular'
  | 'circular'
  | 'irregular'
  | 'raceway';
export type PondConstructionType = 'earthen' | 'lined' | 'cage' | 'biofloc_ras';
export type PondStatus = 'fallow' | 'active' | 'harvesting' | 'archived';

// Note: Entity columns use 'string' to avoid TypeORM DeepPartial conflicts.
// The type aliases above serve as documentation for valid values.

@Entity('ponds')
export class Pond {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'name_prefix', type: 'varchar', length: 4, nullable: true })
  namePrefix: string;

  @Column({ name: 'sequence_number', type: 'int', nullable: true })
  sequenceNumber: number;

  @Column({
    name: 'pond_code',
    type: 'varchar',
    length: 20,
    unique: true,
    nullable: true,
  })
  pondCode: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  displayName: string;

  // NOT NULL to match migration 1771597711215 (dev synchronize would otherwise
  // DROP NOT NULL each boot, diverging dev from prod).
  @Column({
    name: 'geometry_type',
    type: 'varchar',
    length: 20,
  })
  geometryType: string;

  @Column({
    name: 'construction_type',
    type: 'varchar',
    length: 20,
  })
  constructionType: string;

  @Column({ name: 'length_m', type: 'numeric', nullable: true })
  lengthM: number;

  @Column({ name: 'width_m', type: 'numeric', nullable: true })
  widthM: number;

  @Column({ name: 'diameter_m', type: 'numeric', nullable: true })
  diameterM: number;

  @Column({ name: 'depth_m', type: 'numeric' })
  depthM: number;

  // Total installed aerator power (HP) on this pond — the Aeration & Power
  // optimizer's core input, captured once at setup instead of re-asked each use.
  @Column({ name: 'installed_aerator_hp', type: 'numeric', nullable: true })
  installedAeratorHp: number;

  // Number of aerator units installed — complements installed_aerator_hp so the
  // Aeration optimizer knows both unit count and total capacity.
  @Column({ name: 'aerator_count', type: 'int', nullable: true })
  aeratorCount: number;

  @Column({ name: 'channel_count', type: 'int', nullable: true })
  channelCount: number;

  @Column({ name: 'calculated_area_m2', type: 'numeric' })
  calculatedAreaM2: number;

  @Column({ name: 'override_area_m2', type: 'numeric', nullable: true })
  overrideAreaM2: number;

  @Column({ name: 'gps_lat', type: 'numeric', nullable: true })
  gpsLat: number;

  @Column({ name: 'gps_lng', type: 'numeric', nullable: true })
  gpsLng: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'fallow' })
  status: string;

  @Column({
    name: 'archived_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  // Nullable in the column and NULL for every pond that is not archived, so
  // the type says so. It was `Date`, which made `archivedAt: null` — the only
  // way to unarchive — a type error.
  archivedAt: Date | null;

  @Index()
  @Column({ name: 'active_cycle_id', type: 'uuid', nullable: true })
  activeCycleId: string | null;

  @OneToOne(() => Crop)
  @JoinColumn({ name: 'active_cycle_id' })
  activeCycle: Crop;

  @Column({ type: 'jsonb', nullable: true })
  boundary: { latitude: number; longitude: number }[];

  /**
   * Which of this pond's measurements the APP filled in rather than the farmer.
   *
   * Onboarding creates ponds without asking for shape, construction type or
   * dimensions — it defaults to `irregular` / `earthen` and leaves area
   * unmeasured, because a measurement questionnaire in front of someone who
   * has not seen the app yet is how you lose them. But the result was
   * indistinguishable from an answer they actually gave: the pond page
   * rendered "Earthen" and an area with the same confidence as a surveyed
   * figure, and volume, aeration adequacy and every dosing calculation
   * downstream read those numbers.
   *
   * So the assumption is RECORDED rather than hidden. A field named here is
   * shown as unconfirmed and prompts to be completed; supplying it removes it
   * from the list. Empty means nothing was assumed.
   */
  @Column({
    name: 'assumed_fields',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  assumedFields: string[];

  /**
   * Returns the effective area: override if set, otherwise calculated.
   * All downstream consumers (cycles, dashboards) should use this.
   */
  get effectiveAreaM2(): number {
    return this.overrideAreaM2 ?? this.calculatedAreaM2;
  }

  /**
   * Returns the calculated volume from effective area and depth.
   */
  get volumeM3(): number {
    return (this.effectiveAreaM2 ?? 0) * (this.depthM ?? 0);
  }
}
