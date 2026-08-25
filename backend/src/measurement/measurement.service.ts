import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { Measurement } from './measurement.entity';
import { Crop, computeDoc } from '../crops/crop.entity';
import { DataDictionaryService } from './data-dictionary.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { QueryMeasurementDto } from './dto/query-measurement.dto';
import { EditMeasurementDto } from './dto/edit-measurement.dto';
import { PondsService } from '../ponds/ponds.service';

/** Per-item outcome for a batch ingest. */
export interface BatchItemResult {
  index: number;
  id: string | null;
  status: 'created' | 'duplicate' | 'error';
  error?: string;
}

@Injectable()
export class MeasurementService {
  constructor(
    @InjectRepository(Measurement)
    private readonly repo: Repository<Measurement>,
    @InjectRepository(Crop)
    private readonly cropRepo: Repository<Crop>,
    private readonly dictionary: DataDictionaryService,
    private readonly pondsService: PondsService,
  ) {}

  /**
   * Ingest a single reading through the pipeline: ownership → dictionary
   * validation → DOC derivation → persist. Idempotent on a client-supplied
   * `id` (re-sending returns the stored row untouched).
   */
  async create(
    dto: CreateMeasurementDto,
    userId: string,
    // Set of pondIds whose ownership has already been verified this call/batch.
    // Lets createBatch resolve each distinct pond ONCE instead of re-running the
    // identical ownership query for every reading (N+1 on offline sync).
    pondCache?: Set<string>,
  ): Promise<Measurement> {
    // Access — throws unless the user may write operational data on the pond
    // (owner, manager or worker). Recording a measurement is field work.
    if (!pondCache?.has(dto.pondId)) {
      await this.pondsService.verifyAccess(dto.pondId, userId, 'WRITE_OPERATIONAL');
      pondCache?.add(dto.pondId);
    }

    // Idempotency — a re-synced offline row is a no-op. Verify ownership of the
    // found row's OWN pond before returning it: a replayed op with a guessed id
    // must not leak another tenant's measurement (dto.pondId ownership above does
    // not cover a record that belongs to a different pond).
    if (dto.id) {
      const existing = await this.repo.findOne({ where: { id: dto.id } });
      if (existing) {
        await this.pondsService.verifyAccess(existing.pondId, userId, 'WRITE_OPERATIONAL');
        return existing;
      }
    }

    const isMissing = !!dto.isMissingReason;
    const { canonicalUnit } = await this.dictionary.validate({
      param: dto.param,
      valueNum: dto.valueNum,
      valueText: dto.valueText,
      unit: dto.unit,
      isMissing,
    });

    const measuredAt = dto.measuredAt ? new Date(dto.measuredAt) : new Date();

    // Resolve the crop once — used both to guard cross-tenant cropIds and to
    // derive DOC. dto.pondId ownership was verified above, but the crop it
    // names must actually live in that pond (otherwise a caller could attach a
    // reading to, or infer another tenant's stocking date via, a foreign crop).
    let crop: Crop | null = null;
    if (dto.cropId) {
      crop = await this.cropRepo.findOne({ where: { id: dto.cropId } });
      if (crop && crop.pondId !== dto.pondId) {
        throw new BadRequestException(
          'cropId does not belong to the given pond',
        );
      }
    }

    // DOC via the shared IST-calendar helper (stocking day = 1); null when the
    // reading predates stocking or there is no stocking date.
    const doc =
      dto.doc !== undefined
        ? dto.doc
        : crop?.stockingDate
          ? computeDoc(crop.stockingDate, crop.initialAgeDays, measuredAt)
          : null;

    const source = dto.source ?? 'manual';
    const confidence =
      dto.confidence ?? (source === 'manual' || source === 'lab' ? 1 : null);

    const entity = this.repo.create({
      id: dto.id,
      pondId: dto.pondId,
      cropId: dto.cropId ?? null,
      doc,
      param: dto.param,
      valueNum: isMissing ? null : (dto.valueNum ?? null),
      valueText: isMissing ? null : (dto.valueText ?? null),
      unit: dto.unit ?? canonicalUnit ?? '',
      measuredAt,
      timeOfDay: dto.timeOfDay ?? null,
      source,
      instrument: dto.instrument ?? null,
      deviceId: dto.deviceId ?? null,
      enteredBy: userId,
      enteredByRole: dto.enteredByRole ?? null,
      confidence,
      isMissingReason: dto.isMissingReason ?? null,
      editedFrom: null,
      isSuperseded: false,
    });

    return this.repo.save(entity);
  }

  /**
   * Batch ingest for offline sync. Each item is processed independently and
   * idempotently; by default a bad item is reported and skipped rather than
   * failing the whole batch.
   */
  async createBatch(
    items: CreateMeasurementDto[],
    userId: string,
    continueOnError = true,
  ): Promise<{ results: BatchItemResult[] }> {
    const results: BatchItemResult[] = [];
    // Verify each distinct pond's ownership once across the whole batch.
    const pondCache = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const dto = items[i];
      try {
        const wasDuplicate =
          !!dto.id && !!(await this.repo.findOne({ where: { id: dto.id } }));
        const saved = await this.create(dto, userId, pondCache);
        results.push({
          index: i,
          id: saved.id,
          status: wasDuplicate ? 'duplicate' : 'created',
        });
      } catch (err) {
        results.push({
          index: i,
          id: dto.id ?? null,
          status: 'error',
          error: (err as Error).message,
        });
        if (!continueOnError) break;
      }
    }
    return { results };
  }

  /**
   * Time-series read. Returns non-superseded rows (the current edit-chain
   * heads) ordered oldest→newest, scoped to a pond the user owns.
   */
  async query(q: QueryMeasurementDto, userId: string): Promise<Measurement[]> {
    if (!q.pondId) {
      // Without a pond we cannot scope ownership; require it.
      throw new NotFoundException('pondId is required');
    }
    await this.pondsService.verifyAccess(q.pondId, userId, 'READ');

    const where: Record<string, unknown> = {
      pondId: q.pondId,
      isSuperseded: false,
    };
    if (q.cropId) where.cropId = q.cropId;
    if (q.param) where.param = q.param;
    if (q.category) {
      const active = await this.dictionary.getActive();
      const params = active
        .filter((e) => e.category === q.category)
        .map((e) => e.param);
      where.param = params.length ? In(params) : In(['__none__']);
    }
    if (q.from && q.to) {
      where.measuredAt = Between(new Date(q.from), new Date(q.to));
    } else if (q.from) {
      where.measuredAt = MoreThanOrEqual(new Date(q.from));
    } else if (q.to) {
      where.measuredAt = LessThanOrEqual(new Date(q.to));
    }

    return this.repo.find({
      where,
      order: { measuredAt: 'ASC' },
      take: q.limit ?? 500,
    });
  }

  async findOne(id: string, userId: string): Promise<Measurement> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Measurement not found');
    await this.pondsService.verifyAccess(m.pondId, userId, 'READ');
    return m;
  }

  /**
   * Edit a reading by appending a corrected row (immutable raw + edit log):
   * the original keeps its value and is flagged `isSuperseded`; a new row is
   * stored with `editedFrom` pointing at it.
   */
  async edit(
    id: string,
    dto: EditMeasurementDto,
    userId: string,
  ): Promise<Measurement> {
    const original = await this.findOne(id, userId);

    // findOne only requires READ, which includes `viewer`. Editing is a write,
    // so assert the write capability explicitly here rather than inheriting
    // findOne's weaker check — otherwise a viewer could append corrections.
    await this.pondsService.verifyAccess(
      original.pondId,
      userId,
      'WRITE_OPERATIONAL',
    );

    const isMissing = !!dto.isMissingReason;
    const { canonicalUnit } = await this.dictionary.validate({
      param: original.param,
      valueNum: dto.valueNum,
      valueText: dto.valueText,
      unit: original.unit,
      isMissing,
    });

    const corrected = this.repo.create({
      pondId: original.pondId,
      cropId: original.cropId,
      doc: original.doc,
      param: original.param,
      valueNum: isMissing ? null : (dto.valueNum ?? null),
      valueText: isMissing ? null : (dto.valueText ?? null),
      unit: original.unit || canonicalUnit || '',
      measuredAt: original.measuredAt,
      timeOfDay: original.timeOfDay,
      source: original.source,
      instrument: original.instrument,
      deviceId: original.deviceId,
      enteredBy: userId,
      enteredByRole: original.enteredByRole ?? null,
      confidence: original.confidence,
      isMissingReason: dto.isMissingReason ?? null,
      editedFrom: original.id,
      isSuperseded: false,
    });

    const saved = await this.repo.save(corrected);
    original.isSuperseded = true;
    await this.repo.save(original);
    return saved;
  }
}
