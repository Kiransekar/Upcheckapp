// The point of this screen is that a farmer can be heard without leaving a
// Play Store review — so the two things worth pinning down are that a report
// actually reaches the API, and that a FAILED read of their past reports never
// renders as "you have not reported anything". That lie has already cost this
// codebase twice.
jest.mock('../../../api/feedback', () => ({
    feedbackApi: {
        mine: jest.fn(),
        create: jest.fn(),
        uploadAttachment: jest.fn(),
        one: jest.fn(),
    },
}));
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
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
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { ReportIssueScreen, reportHeadline, MAX_PHOTOS } from '../ReportIssueScreen';
import { feedbackApi } from '../../../api/feedback';
import { useSyncStore } from '../../../store/syncStore';

const REPORTS = [
    {
        id: 'f1',
        userId: 'u1',
        farmId: null,
        category: 'problem',
        subject: null,
        message: 'Water test did not save\nI pressed save twice.',
        attachmentPaths: [],
        attachmentUrls: [],
        status: 'in_review',
        adminResponse: 'We found it — a fix is on the way.',
        respondedAt: '2026-06-04T05:00:00.000Z',
        respondedBy: 'Ravi',
        createdAt: '2026-06-03T05:00:00.000Z',
        updatedAt: '2026-06-04T05:00:00.000Z',
    },
];

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, left: 0, right: 0, bottom: 0 },
            }}
        >
            <ReportIssueScreen navigation={navigation} route={{ params: {} }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    act(() => { useSyncStore.setState({ isConnected: true }); });
    (feedbackApi.mine as jest.Mock).mockResolvedValue({ data: [] });
    (feedbackApi.create as jest.Mock).mockResolvedValue({ data: REPORTS[0] });
});

describe('reportHeadline', () => {
    it('prefers the farmer\'s own title', () => {
        expect(reportHeadline({ ...REPORTS[0], subject: 'Saving is broken' } as any)).toBe(
            'Saving is broken',
        );
    });

    it('falls back to the first line — most farmers will not write a title', () => {
        expect(reportHeadline(REPORTS[0] as any)).toBe('Water test did not save');
    });
});

describe('empty is not the same as failed', () => {
    it('says "nothing reported yet" only when the read succeeded and was empty', async () => {
        const { getByText, queryByTestId } = renderScreen();

        await waitFor(() => expect(getByText('You have not reported anything yet.')).toBeTruthy());
        expect(queryByTestId('feedback-load-error')).toBeNull();
    });

    it('shows a failure with a retry, and never the empty message', async () => {
        (feedbackApi.mine as jest.Mock).mockRejectedValue(new Error('offline'));

        const { getByTestId, queryByText } = renderScreen();

        await waitFor(() => expect(getByTestId('feedback-load-error')).toBeTruthy());
        expect(queryByText('You have not reported anything yet.')).toBeNull();
    });

    it('retry re-reads, and a recovered read replaces the error', async () => {
        (feedbackApi.mine as jest.Mock).mockRejectedValueOnce(new Error('offline'));

        const { getByTestId, getByText, queryByTestId } = renderScreen();
        await waitFor(() => expect(getByTestId('feedback-load-error')).toBeTruthy());

        (feedbackApi.mine as jest.Mock).mockResolvedValue({ data: REPORTS });
        fireEvent.press(getByText('Retry'));

        await waitFor(() => expect(queryByTestId('feedback-load-error')).toBeNull());
        expect(getByText('Water test did not save')).toBeTruthy();
    });
});

describe('sending', () => {
    it('refuses an empty message instead of posting nothing', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(feedbackApi.mine).toHaveBeenCalled());

        fireEvent.press(getByText('Send to the team'));

        await waitFor(() => expect(getByText('Please write what happened first.')).toBeTruthy());
        expect(feedbackApi.create).not.toHaveBeenCalled();
    });

    it('sends the chosen category and the message', async () => {
        const { getByText, getByTestId } = renderScreen();
        await waitFor(() => expect(feedbackApi.mine).toHaveBeenCalled());

        fireEvent.press(getByText('An idea'));
        fireEvent.changeText(getByTestId('feedback-message'), '  Add a Telugu keyboard  ');
        fireEvent.press(getByText('Send to the team'));

        await waitFor(() =>
            expect(feedbackApi.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    category: 'suggestion',
                    message: 'Add a Telugu keyboard',
                    attachmentPaths: [],
                }),
            ),
        );
    });

    /**
     * Offline is refused out loud rather than queued — see the screen's header
     * comment. What must not happen is a silent "sent" the team never receives.
     */
    it('refuses to send while offline and keeps the text on screen', async () => {
        const { getByText, getByTestId } = renderScreen();
        await waitFor(() => expect(feedbackApi.mine).toHaveBeenCalled());

        // After mount, not before: ScreenWrapper's OfflineIndicator subscribes
        // to NetInfo on mount and the jest mock reports "connected", which
        // would overwrite anything set beforehand.
        act(() => { useSyncStore.setState({ isConnected: false }); });

        fireEvent.changeText(getByTestId('feedback-message'), 'The app crashed');
        fireEvent.press(getByText('Send to the team'));

        await waitFor(() =>
            expect(Alert.alert).toHaveBeenCalledWith('You are offline', expect.any(String)),
        );
        expect(feedbackApi.create).not.toHaveBeenCalled();
        expect(getByTestId('feedback-message').props.value).toBe('The app crashed');
    });

    it('still sends the report when a photo fails to upload', async () => {
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
            granted: true,
        });
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' }],
        });
        (feedbackApi.uploadAttachment as jest.Mock).mockRejectedValue(new Error('upload died'));

        const { getByText, getByTestId, getByLabelText } = renderScreen();
        await waitFor(() => expect(feedbackApi.mine).toHaveBeenCalled());

        fireEvent.press(getByLabelText('Add photo'));
        await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());

        fireEvent.changeText(getByTestId('feedback-message'), 'See the photo');
        fireEvent.press(getByText('Send to the team'));

        // The paragraph the farmer typed is worth more than the attachment.
        await waitFor(() =>
            expect(feedbackApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'See the photo', attachmentPaths: [] }),
            ),
        );
    });

    it('a refused photo permission is explained, not a dead end', async () => {
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
            granted: false,
        });

        const { getByLabelText, getByText, getByTestId } = renderScreen();
        await waitFor(() => expect(feedbackApi.mine).toHaveBeenCalled());

        fireEvent.press(getByLabelText('Add photo'));
        await waitFor(() =>
            expect(Alert.alert).toHaveBeenCalledWith('Photos need permission', expect.any(String)),
        );
        expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();

        // ...and the report is still sendable.
        fireEvent.changeText(getByTestId('feedback-message'), 'No photo, still broken');
        fireEvent.press(getByText('Send to the team'));
        await waitFor(() => expect(feedbackApi.create).toHaveBeenCalled());
    });
});

describe('the reports list', () => {
    it('opens the detail screen — the reply is why they came back', async () => {
        (feedbackApi.mine as jest.Mock).mockResolvedValue({ data: REPORTS });

        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Water test did not save')).toBeTruthy());

        fireEvent.press(getByText('Water test did not save'));
        expect(navigation.navigate).toHaveBeenCalledWith('FeedbackDetail', { id: 'f1' });
    });

    it('caps attachments at three', () => {
        expect(MAX_PHOTOS).toBe(3);
    });
});
