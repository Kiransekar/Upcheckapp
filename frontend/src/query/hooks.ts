/**
 * The two bits of React glue every migrated screen uses.
 *
 * `useAppQuery` passes the app's single QueryClient EXPLICITLY rather than
 * reading it from context. TanStack supports that, and it means a screen can be
 * rendered in a test (or anywhere else) without being wrapped in a provider —
 * the provider in App.tsx is still there, but only to sequence the AsyncStorage
 * restore before the first paint.
 */
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { queryClient } from './client';

export function useAppQuery<TData>(options: UseQueryOptions<TData, any, TData, any>) {
    return useQuery(options, queryClient);
}

/**
 * Refetch when the screen regains NAVIGATION focus.
 *
 * React Navigation keeps screens mounted, so AppState focus tracking is not
 * enough on its own — coming back from a log screen never changes AppState.
 * `stale: true` keeps this honest: within `staleTime` the return is instant and
 * silent, but a query invalidated by the farmer's own write refetches the
 * moment they land back on the screen. That is the "I shouldn't have to pull to
 * refresh after logging" complaint, closed at the framework level.
 */
export const useRefetchOnFocus = (queryKey: QueryKey): void => {
    const key = JSON.stringify(queryKey);
    useFocusEffect(
        useCallback(() => {
            void queryClient.refetchQueries({ queryKey: JSON.parse(key), type: 'active', stale: true });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [key]),
    );
};
