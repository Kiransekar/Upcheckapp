/**
 * The three things on this screen that can be wrong without looking wrong:
 *
 *  1. The day grouping. Rows arrive as one descending stream; if the grouping
 *     splits or merges a day, the farmer reads yesterday's feed as today's.
 *  2. The cursor. `nextCursor` is opaque and must go back UNCHANGED, exactly
 *     once — a dropped cursor silently truncates the timeline at 50 rows, and a
 *     re-sent one appends the same page twice.
 *  3. The financial kinds. The server withholds them without VIEW_FINANCIALS,
 *     so offering a worker those two chips would be a filter that can only
 *     ever answer "nothing here".
 */
jest.mock('../../../api/activity', () => {
    const actual = jest.requireActual('../../../api/activity');
    return { ...actual, activityApi: { list: jest.fn() } };
});
jest.mock('../../../hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
    ActivityScreen,
    groupByDay,
    activityCsvRows,
} from '../ActivityScreen';
import { visibleActivityKinds } from '../activityKinds';
import { activityApi, type ActivityItem } from '../../../api/activity';
import { usePermissions } from '../../../hooks/usePermissions';

const item = (over: Partial<ActivityItem>): ActivityItem => ({
    at: '2026-09-03T06:00:00.000Z',
    kind: 'feed',
    pondId: 'p1',
    cropId: null,
    actorId: 'u1',
    actorName: 'Anita Rao',
    summary: '12 kg',
    recordId: 'r1',
    ...over,
});

/** A local wall-clock ISO, so "which day is this" means the device's day. */
const at = (day: number, hour: number) =>
    new Date(2026, 8, day, hour, 0, 0, 0).toISOString();

describe('groupByDay', () => {
    it('makes one section per calendar day, in arrival order', () => {
        const sections = groupByDay([
            item({ recordId: 'a', at: at(3, 16) }),
            item({ recordId: 'b', at: at(3, 6) }),
            item({ recordId: 'c', at: at(2, 18) }),
        ]);
        expect(sections.map((s) => s.day)).toEqual(['2026-09-03', '2026-09-02']);
        expect(sections[0].data.map((i) => i.recordId)).toEqual(['a', 'b']);
        expect(sections[1].data.map((i) => i.recordId)).toEqual(['c']);
    });

    it('splits a day that is 23:59 on one side and 00:01 on the other', () => {
        const sections = groupByDay([
            item({ recordId: 'a', at: at(4, 0) }),
            item({ recordId: 'b', at: at(3, 23) }),
        ]);
        expect(sections).toHaveLength(2);
    });

    it('is empty for no rows rather than a section with nothing in it', () => {
        expect(groupByDay([])).toEqual([]);
    });

    it('does not throw on an unparseable timestamp', () => {
        const sections = groupByDay([item({ at: 'not a date' })]);
        expect(sections).toHaveLength(1);
        expect(sections[0].day).toBe('');
    });
});

describe('activityCsvRows', () => {
    it('keeps the instant ISO and passes null cells through as null', () => {
        const rows = activityCsvRows(
            [item({ at: '2026-09-03T06:00:00.000Z', actorName: null, summary: null })],
            (k) => k.toUpperCase(),
        );
        expect(rows).toEqual([['2026-09-03T06:00:00.000Z', 'FEED', null, null]]);
    });
});

describe('visibleActivityKinds', () => {
    it('offers all fourteen with VIEW_FINANCIALS', () => {
        expect(visibleActivityKinds(true)).toHaveLength(14);
    });

    it('withholds the two the server would withhold anyway', () => {
        const kinds = visibleActivityKinds(false);
        expect(kinds).toHaveLength(12);
        expect(kinds).not.toContain('transaction');
        expect(kinds).not.toContain('expense');
    });
});

const renderScreen = (params: any = {}) =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 360, height: 780 },
                insets: { top: 0, left: 0, right: 0, bottom: 0 },
            }}
        >
            <ActivityScreen
                navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
                route={{ params }}
            />
        </SafeAreaProvider>,
    );

describe('ActivityScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (usePermissions as jest.Mock).mockReturnValue({ canViewFinancials: true });
        (activityApi.list as jest.Mock).mockResolvedValue({
            data: { items: [item({})], nextCursor: null },
        });
    });

    it('scopes to the pond it was opened from, without a cursor', async () => {
        renderScreen({ pondId: 'p1', pondName: 'Pond 1', farmId: 'f1' });
        await waitFor(() => expect(activityApi.list).toHaveBeenCalled());
        const call = (activityApi.list as jest.Mock).mock.calls[0][0];
        expect(call.pondId).toBe('p1');
        expect(call.farmId).toBeUndefined();
        expect(call.cursor).toBeUndefined();
    });

    it('asks for everything when it was not opened from a farm or pond', async () => {
        renderScreen({});
        await waitFor(() => expect(activityApi.list).toHaveBeenCalled());
        const call = (activityApi.list as jest.Mock).mock.calls[0][0];
        expect(call.pondId).toBeUndefined();
        expect(call.farmId).toBeUndefined();
    });

    it('hands the cursor back unchanged and appends the page', async () => {
        (activityApi.list as jest.Mock)
            .mockResolvedValueOnce({
                data: { items: [item({ recordId: 'r1' })], nextCursor: 'CURSOR-1' },
            })
            .mockResolvedValueOnce({
                data: { items: [item({ recordId: 'r2' })], nextCursor: null },
            });

        const { getByTestId, getAllByText } = renderScreen({ farmId: 'f1' });
        await waitFor(() => expect(activityApi.list).toHaveBeenCalledTimes(1));

        await act(async () => {
            getByTestId('activity-list').props.onEndReached();
        });

        await waitFor(() => expect(activityApi.list).toHaveBeenCalledTimes(2));
        expect((activityApi.list as jest.Mock).mock.calls[1][0].cursor).toBe('CURSOR-1');
        // Both pages on screen at once — a page that replaced rather than
        // appended would still pass the cursor assertion above.
        expect(getAllByText('Feed')).toHaveLength(2);
    });

    it('stops asking once the server says there is no next page', async () => {
        const { getByTestId, getAllByText } = renderScreen({ farmId: 'f1' });
        await waitFor(() => expect(activityApi.list).toHaveBeenCalledTimes(1));

        await act(async () => {
            getByTestId('activity-list').props.onEndReached();
            getByTestId('activity-list').props.onEndReached();
        });

        expect(activityApi.list).toHaveBeenCalledTimes(1);
    });

    it('keeps the loaded rows when a later page fails', async () => {
        (activityApi.list as jest.Mock)
            .mockResolvedValueOnce({
                data: { items: [item({ recordId: 'r1' })], nextCursor: 'CURSOR-1' },
            })
            .mockRejectedValueOnce(new Error('offline'));

        const { getByTestId, getAllByText } = renderScreen({ farmId: 'f1' });
        await waitFor(() => expect(activityApi.list).toHaveBeenCalledTimes(1));

        await act(async () => {
            getByTestId('activity-list').props.onEndReached();
        });

        await waitFor(() => expect(activityApi.list).toHaveBeenCalledTimes(2));
        expect(getAllByText('Feed')).toHaveLength(1);
    });
});
