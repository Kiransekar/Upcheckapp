// Adding photos is temporarily off (PHOTO_ATTACH_ENABLED in ReportIssueScreen),
// but reports filed before the flag flipped still carry attachments — and the
// whole point of the disable being "temporary" is that nothing about VIEWING
// them was ripped out. This pins that down.
jest.mock('../../../api/feedback', () => ({
    feedbackApi: {
        mine: jest.fn(),
        create: jest.fn(),
        uploadAttachment: jest.fn(),
        one: jest.fn(),
    },
}));
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
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackDetailScreen } from '../FeedbackDetailScreen';
import { feedbackApi } from '../../../api/feedback';

const WITH_PHOTOS = {
    id: 'f1',
    userId: 'u1',
    farmId: null,
    category: 'problem',
    subject: 'Saving is broken',
    message: 'Water test did not save.',
    attachmentPaths: ['u1/a.jpg', 'u1/b.jpg'],
    attachmentUrls: ['https://signed/a.jpg', 'https://signed/b.jpg'],
    status: 'in_review',
    adminResponse: null,
    respondedAt: null,
    respondedBy: null,
    createdAt: '2026-06-03T05:00:00.000Z',
    updatedAt: '2026-06-03T05:00:00.000Z',
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, left: 0, right: 0, bottom: 0 },
            }}
        >
            <FeedbackDetailScreen navigation={navigation} route={{ params: { id: 'f1' } }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
});

describe('existing attachments still display', () => {
    it('renders every signed photo of a report filed before photos were disabled', async () => {
        (feedbackApi.one as jest.Mock).mockResolvedValue({ data: WITH_PHOTOS });

        const { getAllByTestId, getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getAllByTestId('feedback-photo')).toHaveLength(2));
        expect(getAllByTestId('feedback-photo')[0].props.source).toEqual({
            uri: 'https://signed/a.jpg',
        });
        expect(getByText('Photos')).toBeTruthy();
        expect(queryByText('Photos could not be loaded right now.')).toBeNull();
    });

    it('says so when the signing failed, rather than showing nothing', async () => {
        (feedbackApi.one as jest.Mock).mockResolvedValue({
            data: { ...WITH_PHOTOS, attachmentUrls: [] },
        });

        const { getByText, queryByTestId } = renderScreen();

        await waitFor(() =>
            expect(getByText('Photos could not be loaded right now.')).toBeTruthy(),
        );
        expect(queryByTestId('feedback-photo')).toBeNull();
    });

    it('shows no photo section at all for a report without attachments', async () => {
        (feedbackApi.one as jest.Mock).mockResolvedValue({
            data: { ...WITH_PHOTOS, attachmentPaths: [], attachmentUrls: [] },
        });

        const { getByText, queryByText, queryByTestId } = renderScreen();

        await waitFor(() => expect(getByText('Water test did not save.')).toBeTruthy());
        expect(queryByText('Photos')).toBeNull();
        expect(queryByTestId('feedback-photo')).toBeNull();
    });
});
