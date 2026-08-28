/**
 * Reading the offline write queue as DATA a screen can render.
 *
 * Before this, the only two things that ever looked at the queue were the
 * offline banner and authStore — no screen read it. So a farmer with no signal
 * logged a mortality, saw "Saved — will sync", opened the pond, and the record
 * was simply not there. That is the whole of the complaint this file exists to
 * answer: what is saved, and what is still waiting.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE HARD RULE: a pending record must NEVER be folded into a computed number.
 *
 * A queued mortality entry must not change `livePopulation`, and a queued
 * sampling must not change `biomassKg` or `runningFcr`. Those figures are
 * derived SERVER-SIDE from data the server does not have yet; splicing a local
 * record into them produces a biomass that looks authoritative and is wrong,
 * which is exactly the plausible-but-wrong number this codebase forbids — and
 * it would silently disagree with the same figure on every other device.
 *
 * Show the record, marked pending, next to the aggregate. Leave the aggregate
 * alone until the drain lands and the invalidation refetches it. If you are
 * here to "fix" the fact that the numbers don't move: that is the feature.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react';
import { useSyncStore, type QueuedOperation } from '../store/syncStore';

export interface PendingRecord {
    /** The queue op's own id — stable, safe as a list key. */
    id: string;
    entity: string;
    /** The pond this record was logged against, when it has one. */
    pondId?: string;
    /** When the farmer saved it (not when it will sync). */
    createdAt: string;
    /** True once the op has been parked as needing attention. */
    failed: boolean;
    /** How many spaced attempts have already been counted against it. */
    retryCount: number;
}

export interface PendingFilter {
    /** Restrict to one entity, e.g. 'mortality'. */
    entity?: string;
    /** Restrict to one pond. */
    pondId?: string;
}

const toRecord = (op: QueuedOperation, failed: boolean): PendingRecord => ({
    id: op.id,
    entity: op.entity,
    pondId: typeof op.payload?.pondId === 'string' ? (op.payload.pondId as string) : undefined,
    createdAt: op.createdAt,
    failed,
    retryCount: op.retryCount,
});

/**
 * Everything still waiting to reach the server, newest first.
 *
 * Parked ("failed") ops are included and flagged rather than hidden — an op the
 * app has given up on is precisely the one the farmer needs to be told about.
 */
export const pendingFor = (
    queue: QueuedOperation[],
    failedOperations: QueuedOperation[],
    filter: PendingFilter = {},
): PendingRecord[] => {
    const matches = (op: QueuedOperation) =>
        (!filter.entity || op.entity === filter.entity) &&
        (!filter.pondId || op.payload?.pondId === filter.pondId);

    return [
        ...queue.filter(matches).map((op) => toRecord(op, false)),
        ...failedOperations.filter(matches).map((op) => toRecord(op, true)),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/**
 * Hook form. Subscribes to the two arrays directly (stable references from
 * zustand) and derives, rather than returning a fresh array from the selector —
 * which would re-render on every store touch.
 */
export const usePendingRecords = (filter: PendingFilter = {}): PendingRecord[] => {
    const queue = useSyncStore((s) => s.queue);
    const failedOperations = useSyncStore((s) => s.failedOperations);
    const { entity, pondId } = filter;
    return useMemo(
        () => pendingFor(queue, failedOperations, { entity, pondId }),
        [queue, failedOperations, entity, pondId],
    );
};
