import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FarmAccessService } from '../farm-access/farm-access.service';

/**
 * `GET /api/activity` — one timeline across every log table.
 *
 * The app writes fourteen different log tables. Every screen that wants "what
 * happened here recently" used to fetch two or three of them and filter
 * client-side, which is both wrong (it misses the other eleven) and slow.
 *
 * This is ONE `UNION ALL` over those tables, each branch casting its own
 * timestamp shape to a single `at` timestamptz:
 *   - already timestamptz  → as-is
 *   - `date`               → midnight IST
 *   - `date` + `time`      → that instant IST
 *
 * Every branch also projects `farm_id` (joining `crops`/`ponds` where the log
 * only carries a crop or pond), so the outer query can apply the caller's
 * accessible-farm scope once instead of per branch.
 */

/** The log tables, keyed by the `kind` they report. */
export const ACTIVITY_KINDS = [
  'water_quality',
  'feed',
  'sampling',
  'measurement',
  'harvest',
  'mortality',
  'tray_check',
  'chemical',
  'treatment',
  'microbiology',
  'plankton',
  'disease',
  'transaction',
  'expense',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityItem {
  at: string;
  kind: ActivityKind;
  pondId: string | null;
  cropId: string | null;
  actorId: string | null;
  actorName: string | null;
  summary: string | null;
  recordId: string;
}

export interface ActivityQuery {
  farmId?: string;
  pondId?: string;
  from?: string;
  to?: string;
  kinds?: string[];
  limit?: number;
  cursor?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Local midnight, not UTC midnight. A `date` column here means "the farmer's
 * day", and the farms are in India — casting at UTC would file a morning log
 * on the previous day for anyone reading the timeline in IST.
 */
const TZ = `'Asia/Kolkata'`;
const day = (col: string) => `((${col})::timestamp AT TIME ZONE ${TZ})`;

/**
 * Parameters are fixed by position for every branch, so branches can be
 * included or dropped (financials) without renumbering:
 *   $1 accessible farm ids   $2 farm ids with VIEW_FINANCIALS
 *   $3 pondId  $4 farmId  $5 from  $6 to  $7 cursor at  $8 cursor id  $9 limit
 */
const BRANCHES: Record<ActivityKind, string> = {
  water_quality: `
    SELECT r.recorded_at AS at, 'water_quality'::text AS kind, r.pond_id AS pond_id,
           NULL::uuid AS crop_id, r.created_by_id AS actor_id, p.farm_id AS farm_id,
           r.id AS id,
           concat_ws(', ', 'pH ' || r.ph, 'DO ' || r.dissolved_oxygen,
                     r.temperature || '°C') AS summary
    FROM water_quality_records r JOIN ponds p ON p.id = r.pond_id`,

  feed: `
    SELECT r.recorded_at, 'feed'::text, r.pond_id, r.crop_id, r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', r.feed_type, r.quantity_kg || ' kg')
    FROM feed_records r JOIN ponds p ON p.id = r.pond_id`,

  sampling: `
    SELECT ${day('r.sampling_date')}, 'sampling'::text, r.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', 'MBW ' || r.mbw_g || ' g', 'n=' || r.total_samples)
    FROM sampling_data r JOIN ponds p ON p.id = r.pond_id`,

  // `entered_by`, not `created_by_id` — measurements name their actor column
  // differently from every other log table.
  measurement: `
    SELECT r.measured_at, 'measurement'::text, r.pond_id, r.crop_id, r.entered_by, p.farm_id, r.id,
           concat_ws(' ', r.param, coalesce(r.value_text, r.value_num::text), nullif(r.unit, ''))
    FROM measurements r JOIN ponds p ON p.id = r.pond_id
    WHERE r.is_superseded = false`,

  // The harvest itself is an operational event everyone on the farm may see;
  // only the money on it is gated.
  harvest: `
    SELECT ${day('h.harvest_date')}, 'harvest'::text, c.pond_id, h.crop_id,
           h.created_by_id, p.farm_id, h.id,
           concat_ws(', ', h.weight_kg || ' kg', h.harvest_type,
                     CASE WHEN p.farm_id = ANY($2) THEN '₹' || h.sale_price_total END)
    FROM harvests h JOIN crops c ON c.id = h.crop_id JOIN ponds p ON p.id = c.pond_id`,

  mortality: `
    SELECT ${day('r.record_date')}, 'mortality'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(' ', r.quantity, 'dead')
    FROM mortality_records r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  tray_check: `
    SELECT ${day('r.check_date + r.check_time')}, 'tray_check'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(' ', 'tray', r.tray_number, '·', r.remaining_feed_status)
    FROM feeding_tray_checks r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  chemical: `
    SELECT ${day('r.measurement_date + r.measurement_time')}, 'chemical'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', 'NH3 ' || r.ammonia_nh3_ppm, 'NO2 ' || r.nitrite_no2_ppm,
                     'alk ' || r.alkalinity_ppm)
    FROM chemical_data r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  treatment: `
    SELECT ${day('r.treatment_date')}, 'treatment'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', r.description, r.dosage_kg || ' kg')
    FROM treatments r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  microbiology: `
    SELECT ${day('r.measurement_date')}, 'microbiology'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', 'TVC ' || r.total_vibrio_count_tvc_cfu_ml,
                     'LB ' || r.luminescent_bacteria_lb_cfu_ml)
    FROM microbiology_data r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  plankton: `
    SELECT ${day('r.measurement_date + r.measurement_time')}, 'plankton'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           'total ' || r.total_plankton_cell_ml || ' cell/ml'
    FROM plankton_data r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id`,

  disease: `
    SELECT ${day('r.recorded_date')}, 'disease'::text, c.pond_id, r.crop_id,
           r.created_by_id, p.farm_id, r.id,
           concat_ws(', ', d.name, r.severity_at_detection)
    FROM disease_records r JOIN crops c ON c.id = r.crop_id JOIN ponds p ON p.id = c.pond_id
         LEFT JOIN disease_library d ON d.id = r.disease_id`,

  // Financial branches. `$2` is the farms where the caller holds
  // VIEW_FINANCIALS — a subset of `$1`, so a worker sees the operational
  // timeline of a farm without its books.
  transaction: `
    SELECT t.transaction_date, 'transaction'::text, NULL::uuid, NULL::uuid,
           t.created_by_id, t.farm_id, t.id,
           concat_ws(' ', t.type, t.category, '₹' || t.amount)
    FROM transactions t
    WHERE t.farm_id = ANY($2)`,

  expense: `
    SELECT ${day('e.date')}, 'expense'::text, e.pond_id, e.crop_id, e.user_id, p.farm_id, e.id,
           concat_ws(' ', e.category::text, '₹' || e.amount)
    FROM expenses e JOIN ponds p ON p.id = e.pond_id
    WHERE p.farm_id = ANY($2)`,
};

/** Branches that carry money and are dropped entirely without VIEW_FINANCIALS. */
const FINANCIAL_KINDS: ActivityKind[] = ['transaction', 'expense'];

interface Cursor {
  at: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (
      typeof parsed?.at === 'string' &&
      typeof parsed?.id === 'string' &&
      !Number.isNaN(Date.parse(parsed.at))
    ) {
      return { at: parsed.at, id: parsed.id };
    }
  } catch {
    // fall through to the shared rejection below
  }
  throw new BadRequestException('Invalid cursor');
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async list(
    userId: string,
    query: ActivityQuery,
  ): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
    // Scope narrowing is an access decision, so it happens here rather than in
    // a route guard — same convention as every other read service.
    if (query.pondId) {
      await this.farmAccess.assertCanAccessPond(userId, query.pondId, 'READ');
    }
    if (query.farmId) {
      await this.farmAccess.assertCanAccessFarm(userId, query.farmId, 'READ');
    }

    const [farmIds, financialFarmIds] = await Promise.all([
      this.farmAccess.getAccessibleFarmIds(userId),
      this.farmAccess.getFarmIdsWithCapability(userId, 'VIEW_FINANCIALS'),
    ]);
    if (farmIds.length === 0) return { items: [], nextCursor: null };

    const kinds = resolveKinds(query.kinds, financialFarmIds.length > 0);
    if (kinds.length === 0) return { items: [], nextCursor: null };

    const limit = clampLimit(query.limit);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const union = kinds.map((k) => BRANCHES[k]).join('\n    UNION ALL\n');
    const sql = `
      SELECT e.at, e.kind, e.pond_id, e.crop_id, e.actor_id, e.id,
             nullif(e.summary, '') AS summary,
             coalesce(
               nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), ''),
               u.username, u.email
             ) AS actor_name
      FROM (${union})
        AS e(at, kind, pond_id, crop_id, actor_id, farm_id, id, summary)
      LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.farm_id = ANY($1)
        -- $2 is referenced only by the financial branches, which may all be
        -- dropped; Postgres rejects a bind with parameters the statement never
        -- mentions, so keep it in scope here.
        AND $2::uuid[] IS NOT NULL
        AND ($3::uuid IS NULL OR e.pond_id = $3::uuid)
        AND ($4::uuid IS NULL OR e.farm_id = $4::uuid)
        AND ($5::timestamptz IS NULL OR e.at >= $5::timestamptz)
        AND ($6::timestamptz IS NULL OR e.at <= $6::timestamptz)
        AND ($7::timestamptz IS NULL OR (e.at, e.id) < ($7::timestamptz, $8::uuid))
      ORDER BY e.at DESC, e.id DESC
      LIMIT $9`;

    const rows: any[] = await this.dataSource.query(sql, [
      farmIds,
      financialFarmIds,
      query.pondId ?? null,
      query.farmId ?? null,
      parseInstant(query.from, 'from'),
      parseInstant(query.to, 'to'),
      cursor?.at ?? null,
      cursor?.id ?? null,
      limit,
    ]);

    const items: ActivityItem[] = rows.map((r) => ({
      at: new Date(r.at).toISOString(),
      kind: r.kind,
      pondId: r.pond_id ?? null,
      cropId: r.crop_id ?? null,
      actorId: r.actor_id ?? null,
      actorName: r.actor_name ?? null,
      summary: r.summary ?? null,
      recordId: r.id,
    }));

    // A short page means the end; only a full page can have more behind it.
    const last = items.length === limit ? items[items.length - 1] : null;
    return {
      items,
      nextCursor: last ? encodeCursor({ at: last.at, id: last.recordId }) : null,
    };
  }
}

function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseInstant(raw: string | undefined, field: string): string | null {
  if (!raw) return null;
  if (Number.isNaN(Date.parse(raw))) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return raw;
}

function resolveKinds(
  requested: string[] | undefined,
  hasFinancials: boolean,
): ActivityKind[] {
  let kinds: ActivityKind[] = [...ACTIVITY_KINDS];
  if (requested?.length) {
    const bad = requested.filter(
      (k) => !ACTIVITY_KINDS.includes(k as ActivityKind),
    );
    if (bad.length) {
      throw new BadRequestException(`Unknown activity kind: ${bad.join(', ')}`);
    }
    kinds = kinds.filter((k) => requested.includes(k));
  }
  if (!hasFinancials) {
    kinds = kinds.filter((k) => !FINANCIAL_KINDS.includes(k));
  }
  return kinds;
}
