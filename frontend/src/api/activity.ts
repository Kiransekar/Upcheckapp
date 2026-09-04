import apiClient from './client';

/**
 * `GET /api/activity` — the one timeline across all fourteen log tables.
 *
 * Mirrors `backend/src/activity/activity.service.ts` exactly. The server drops
 * the two financial kinds (and masks harvest sale figures) for a caller without
 * VIEW_FINANCIALS, so the client must never assume all fourteen come back.
 */

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

/** The kinds the server withholds without VIEW_FINANCIALS. */
export const FINANCIAL_ACTIVITY_KINDS: ActivityKind[] = ['transaction', 'expense'];

export interface ActivityItem {
    /** ISO instant, already IST-correct. */
    at: string;
    kind: ActivityKind;
    pondId: string | null;
    cropId: string | null;
    actorId: string | null;
    actorName: string | null;
    summary: string | null;
    recordId: string;
}

export interface ActivityPage {
    items: ActivityItem[];
    /** Opaque — hand it straight back as `cursor`. `null` means the end. */
    nextCursor: string | null;
}

export interface ActivityParams {
    farmId?: string;
    pondId?: string;
    /** ISO instant or date. */
    from?: string;
    to?: string;
    kinds?: ActivityKind[];
    /** Defaults to 50 server-side, capped at 200. */
    limit?: number;
    cursor?: string;
}

export const activityApi = {
    list: (params: ActivityParams) =>
        apiClient.get<ActivityPage>('/activity', {
            params,
            // `kinds` is repeatable: `?kinds=feed&kinds=harvest`. Axios' default
            // would send `kinds[]=`, which only parses back to an array by
            // accident of the server's query parser — say what we mean instead.
            paramsSerializer: { indexes: null },
        }),
};
