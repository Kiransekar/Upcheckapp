// News is read-only, so the offline story is a cache, not a write queue. The
// rule from the spec is blunt: never an empty state when a cache exists, and
// never a cached number presented as if it were fresh.
jest.mock('../../../api/news', () => {
    const actual = jest.requireActual('../../../api/news');
    return { ...actual, newsApi: { getAll: jest.fn(), getById: jest.fn() } };
});
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
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NewsListScreen } from '../NewsListScreen';
import { newsApi } from '../../../api/news';
import { readNewsCache } from '../../../features/newsCache';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false };

const article = (over: any = {}) => ({
    id: 'a1',
    title: 'Vannamei prices firm in Nellore',
    summary: null,
    category: 'market',
    publishedAt: '2026-08-19T06:30:00.000Z',
    createdAt: '2026-08-19T07:00:00.000Z',
    sourceName: 'Trade Press',
    canonicalUrl: 'https://example-trade-press.test/vannamei',
    ...over,
});

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <NewsListScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
});

describe('NewsListScreen', () => {
    it('renders a paginated response and attributes every item', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({
            data: { data: [article()], meta: { page: 1, take: 50, itemCount: 1 } },
        });

        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Vannamei prices firm in Nellore')).toBeTruthy());
        expect(getByText('via Trade Press')).toBeTruthy();
    });

    it('still accepts the bare array the endpoint returned before pagination', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({ data: [article()] });

        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Vannamei prices firm in Nellore')).toBeTruthy());
    });

    it('caches what it fetched so the next no-signal open has something to show', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({ data: [article()] });

        renderScreen();

        await waitFor(async () =>
            expect((await readNewsCache())?.items).toHaveLength(1),
        );
    });

    it('renders from cache when the network is gone, and says the news is saved', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({ data: [article()] });
        const first = renderScreen();
        await waitFor(() => expect(first.getByText('Vannamei prices firm in Nellore')).toBeTruthy());
        first.unmount();

        (newsApi.getAll as jest.Mock).mockRejectedValue(new Error('Network Error'));
        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Vannamei prices firm in Nellore')).toBeTruthy());
        // Stale content must announce itself rather than passing as today's.
        expect(getByText('Showing saved news')).toBeTruthy();
    });

    it('shows the error state only when there is no cache to fall back on', async () => {
        (newsApi.getAll as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const { getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getByText("Couldn't Load News")).toBeTruthy());
        expect(queryByText('Showing saved news')).toBeNull();
    });

    it('offers the full category set even on a day nothing was filed', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('All')).toBeTruthy());
        for (const label of [
            'Market & prices',
            'Rules & regulations',
            'Disease & health',
            'Research',
            'Farming & production',
            'Exports & trade',
        ]) {
            expect(getByText(label)).toBeTruthy();
        }
    });

    it('filters the list by the chosen category', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({
            data: [article(), article({ id: 'a2', title: 'CAA notification', category: 'regulation' })],
        });

        const { getByText, getAllByText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('CAA notification')).toBeTruthy());

        // [0] is the filter chip; the same label also appears on the item badge.
        fireEvent.press(getAllByText('Rules & regulations')[0]);

        expect(getByText('CAA notification')).toBeTruthy();
        expect(queryByText('Vannamei prices firm in Nellore')).toBeNull();
    });

    it('carries the tapped article through so detail opens instantly offline', async () => {
        (newsApi.getAll as jest.Mock).mockResolvedValue({ data: [article()] });

        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Vannamei prices firm in Nellore')).toBeTruthy());

        fireEvent.press(getByText('Vannamei prices firm in Nellore'));

        expect(navigation.navigate).toHaveBeenCalledWith(
            'NewsDetail',
            expect.objectContaining({ id: 'a1', article: expect.objectContaining({ id: 'a1' }) }),
        );
    });
});
