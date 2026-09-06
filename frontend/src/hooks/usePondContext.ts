/**
 * The shared pond-context read for every engine screen (E1).
 *
 * All five computational engines did this by hand, and all five did it the
 * same wrong way:
 *
 *     pondContextApi.get(pondId).then(setCtx).catch(() => {});
 *
 * A swallowed failure plus a pre-seeded form is what let the engines answer
 * confidently from invented numbers. Routing every one of them through here
 * fixes it in a single place and makes the failure a first-class state the
 * screen has to render.
 *
 * It also puts engine inputs on the READ CACHE, which they were never on. A
 * cached context is a perfectly good answer for a farmer standing at a pond
 * with no signal — the numbers are theirs, they are stamped with `asOf`, and
 * `computeConfidence` already decays them. A SILENT failure is the only
 * unacceptable outcome, not a stale one.
 */
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { pondContextApi, type PondContext } from '../api/pondContext';
import { useAppQuery } from '../query/hooks';
import { queryClient } from '../query/client';

/** Cache key for one pond's engine inputs. */
export const pondContextKey = (pondId?: string) => ['pond-context', pondId] as const;

export interface PondContextState {
    ctx: PondContext | null;
    /** First load, with nothing cached to show meanwhile. */
    loading: boolean;
    /** The read failed AND there is no cached context — the honest-refusal case. */
    error: unknown;
    refetch: () => void;
}

export function usePondContext(pondId?: string): PondContextState {
    const query = useAppQuery({
        queryKey: pondContextKey(pondId),
        queryFn: async () => (await pondContextApi.get(pondId as string)).data,
        enabled: !!pondId,
    });

    /**
     * Refetch on FOCUS, not on mount — the rule every engine screen already
     * had a comment about. React Navigation keeps a screen mounted once
     * opened, so a mount-only fetch kept advising on pre-log numbers: log a
     * reading, come back, and the advice was still the old one.
     */
    useFocusEffect(
        useCallback(() => {
            if (!pondId) return;
            void queryClient.refetchQueries({
                queryKey: pondContextKey(pondId),
                type: 'active',
                stale: true,
            });
        }, [pondId]),
    );

    const ctx = query.data ?? null;
    return {
        ctx,
        loading: query.isPending && !ctx,
        // A failure WITH a cached context is not an error the farmer needs to
        // act on; the numbers on screen are still their own.
        error: query.isError && !ctx ? query.error : null,
        refetch: () => void query.refetch(),
    };
}
