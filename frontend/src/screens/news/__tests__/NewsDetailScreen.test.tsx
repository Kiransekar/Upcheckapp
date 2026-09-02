// The article belongs to whoever published it: we show a headline, our own
// summary and a link out. Tapping goes to THEIR page — never a copy of their
// text inside Upcheck chrome.
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
import { Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NewsDetailScreen } from '../NewsDetailScreen';
import { newsApi } from '../../../api/news';
import { useSyncStore } from '../../../store/syncStore';
import { useUIStore } from '../../../store/uiStore';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const article = (over: any = {}) => ({
    id: 'a1',
    title: 'Vannamei prices firm in Nellore',
    summary: 'Farmgate rates rose for larger counts across the district this week.',
    content: null,
    category: 'market',
    publishedAt: '2026-08-19T06:30:00.000Z',
    createdAt: '2026-08-19T07:00:00.000Z',
    sourceName: 'Trade Press',
    canonicalUrl: 'https://www.example-trade-press.test/vannamei',
    ...over,
});

const renderScreen = (params: any = { id: 'a1' }) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <NewsDetailScreen navigation={navigation} route={{ params }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({ isConnected: true } as any);
    useUIStore.setState({ toasts: [] } as any);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
    (newsApi.getById as jest.Mock).mockResolvedValue({ data: article() });
});

describe('NewsDetailScreen', () => {
    it('shows our summary, the source, and the domain the link goes to', async () => {
        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('via Trade Press')).toBeTruthy());
        expect(getByText(/Farmgate rates rose/)).toBeTruthy();
        // The reader should never be in doubt about whose page opens.
        expect(getByText('example-trade-press.test')).toBeTruthy();
    });

    it('opens the publisher page rather than rendering their article', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Read at Trade Press')).toBeTruthy());

        fireEvent.press(getByText('Read at Trade Press'));

        expect(Linking.openURL).toHaveBeenCalledWith(
            'https://www.example-trade-press.test/vannamei',
        );
    });

    it('says so plainly instead of opening a dead tab when offline', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Read at Trade Press')).toBeTruthy());
        // Set connectivity after the store's persisted state has rehydrated,
        // which otherwise lands on top of it.
        act(() => {
            useSyncStore.setState({ isConnected: false } as any);
        });

        fireEvent.press(getByText('Read at Trade Press'));

        expect(Linking.openURL).not.toHaveBeenCalled();
        expect(useUIStore.getState().toasts[0].message).toBe(
            'This article needs a connection.',
        );
    });

    it('renders immediately from the article the list handed over', async () => {
        (newsApi.getById as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const { getByText, queryByText } = renderScreen({ id: 'a1', article: article() });

        expect(getByText('via Trade Press')).toBeTruthy();
        await waitFor(() => expect(queryByText("Couldn't Load Article")).toBeNull());
    });

    it('renders an editorial body only when Upcheck wrote one', async () => {
        (newsApi.getById as jest.Mock).mockResolvedValue({
            data: article({ content: 'We wrote this ourselves.', canonicalUrl: null }),
        });

        const { getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getByText('We wrote this ourselves.')).toBeTruthy());
        expect(queryByText(/Read at/)).toBeNull();
    });
});
