jest.mock('../../../api/announcements', () => ({
    announcementsApi: { getAll: jest.fn(), dismiss: jest.fn() },
}));

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { WhatsNewCard } from '../WhatsNewCard';
import { announcementsApi } from '../../../api/announcements';

const card = (over: any = {}) => ({
    id: 'a1',
    key: '2026-09-feed-advisor',
    category: 'feature',
    priority: 0,
    publishedAt: '2026-09-01T00:00:00.000Z',
    title: 'Feed Advisor is live',
    body: 'Get a daily feed recommendation for every pond.',
    translations: {
        en: { title: 'Feed Advisor is live', body: 'Get a daily feed recommendation for every pond.' },
        hi: { title: 'फ़ीड सलाहकार अब उपलब्ध है', body: 'हर तालाब के लिए दैनिक फ़ीड सलाह पाएं।' },
    },
    ...over,
});

beforeEach(() => {
    jest.clearAllMocks();
    (announcementsApi.dismiss as jest.Mock).mockResolvedValue({});
});

describe('WhatsNewCard', () => {
    it('renders nothing for an empty response', async () => {
        (announcementsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByTestId } = render(<WhatsNewCard />);

        await waitFor(() => expect(announcementsApi.getAll).toHaveBeenCalled());
        expect(queryByTestId('whats-new-card')).toBeNull();
    });

    it('renders nothing when the fetch fails, rather than throwing', async () => {
        (announcementsApi.getAll as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const { queryByTestId } = render(<WhatsNewCard />);

        await waitFor(() => expect(announcementsApi.getAll).toHaveBeenCalled());
        expect(queryByTestId('whats-new-card')).toBeNull();
    });

    it('falls back to the English translation when the current locale is missing', async () => {
        (announcementsApi.getAll as jest.Mock).mockResolvedValue({
            data: [card({ translations: { en: { title: 'English only title', body: 'English only body' } } })],
        });

        // App language under test is 'en' (src/setupTests.ts), so this exercises
        // the same fallback a farmer on an untranslated locale would hit.
        const { getByText } = render(<WhatsNewCard />);

        await waitFor(() => expect(getByText('English only title')).toBeTruthy());
    });

    it('switches the displayed language locally, with no refetch', async () => {
        (announcementsApi.getAll as jest.Mock).mockResolvedValue({ data: [card()] });

        const { getByText, getByLabelText } = render(<WhatsNewCard />);
        await waitFor(() => expect(getByText('Feed Advisor is live')).toBeTruthy());

        fireEvent.press(getByLabelText('हिन्दी'));

        expect(getByText('फ़ीड सलाहकार अब उपलब्ध है')).toBeTruthy();
        expect(announcementsApi.getAll).toHaveBeenCalledTimes(1);
    });

    it('dismisses the card, calls the endpoint, and does not show it again', async () => {
        (announcementsApi.getAll as jest.Mock).mockResolvedValue({ data: [card()] });

        const { getByText, queryByTestId } = render(<WhatsNewCard />);
        await waitFor(() => expect(getByText('Feed Advisor is live')).toBeTruthy());

        fireEvent.press(getByText('Got it'));

        expect(announcementsApi.dismiss).toHaveBeenCalledWith('a1');
        await waitFor(() => expect(queryByTestId('whats-new-card')).toBeNull());
    });
});
