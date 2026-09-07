/**
 * The OTA status block: what it says, and when.
 *
 * The state machine is the whole feature. EAS Update applies on the SECOND
 * launch, so "a new update is downloaded and waiting for a restart" has to be
 * distinguishable from "you are on the newest one" — getting that ordering
 * wrong is exactly the confusion this block exists to remove.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockUseUpdates = jest.fn();
const mockReloadAsync = jest.fn(async () => undefined);
const mockFetchUpdateAsync = jest.fn(async () => undefined);
const mockCheckForUpdateAsync = jest.fn(async () => undefined);
let mockIsEnabled = true;

jest.mock('expo-updates', () => ({
    get isEnabled() {
        return mockIsEnabled;
    },
    useUpdates: () => mockUseUpdates(),
    reloadAsync: () => mockReloadAsync(),
    fetchUpdateAsync: () => mockFetchUpdateAsync(),
    checkForUpdateAsync: () => mockCheckForUpdateAsync(),
}));

import { UpdateStatus, otaState } from '../UpdateStatus';

const hookValue = (over: Record<string, unknown> = {}) => ({
    currentlyRunning: { isEmbeddedLaunch: false, isEmergencyLaunch: false, emergencyLaunchReason: null },
    isUpdatePending: false,
    isDownloading: false,
    isChecking: false,
    isUpdateAvailable: false,
    lastCheckForUpdateTimeSinceRestart: undefined,
    checkError: undefined,
    ...over,
});

const inputs = (over: Record<string, unknown> = {}) => ({
    isEnabled: true,
    isUpdatePending: false,
    isDownloading: false,
    isChecking: false,
    isUpdateAvailable: false,
    isEmbeddedLaunch: false,
    ...over,
}) as Parameters<typeof otaState>[0];

beforeEach(() => {
    mockIsEnabled = true;
    jest.clearAllMocks();
});

describe('otaState', () => {
    it('is disabled in a dev build, whatever the other flags say', () => {
        expect(otaState(inputs({ isEnabled: false, isUpdatePending: true, isUpdateAvailable: true })))
            .toBe('disabled');
    });

    it('is embedded when running the bundle baked into the binary', () => {
        expect(otaState(inputs({ isEmbeddedLaunch: true }))).toBe('embedded');
    });

    it('is running when an OTA update has been applied', () => {
        expect(otaState(inputs())).toBe('running');
    });

    it('is pending once an update is downloaded and waiting for a restart', () => {
        expect(otaState(inputs({ isUpdatePending: true }))).toBe('pending');
    });

    it('keeps saying pending while a later check or download runs — the restart still matters most', () => {
        expect(otaState(inputs({ isUpdatePending: true, isChecking: true, isDownloading: true })))
            .toBe('pending');
    });

    it('is downloading before it is checking', () => {
        expect(otaState(inputs({ isDownloading: true, isChecking: true }))).toBe('downloading');
    });

    it('is checking while a check is in flight', () => {
        expect(otaState(inputs({ isChecking: true }))).toBe('checking');
    });

    it('is available when the server has a newer one that is not downloaded yet', () => {
        expect(otaState(inputs({ isUpdateAvailable: true }))).toBe('available');
    });
});

describe('UpdateStatus', () => {
    it('shows the built-in-version copy on an embedded launch, not a blank date', () => {
        mockUseUpdates.mockReturnValue(
            hookValue({ currentlyRunning: { isEmbeddedLaunch: true } }),
        );
        const { getByText } = render(<UpdateStatus />);
        getByText('Running the version built into the app');
    });

    it('shows the local date and time the running update was published', () => {
        mockUseUpdates.mockReturnValue(
            hookValue({
                currentlyRunning: {
                    isEmbeddedLaunch: false,
                    createdAt: new Date(2026, 8, 5, 14, 30),
                    updateId: 'abcdef12-3456-7890-abcd-ef1234567890',
                },
            }),
        );
        const { getByText } = render(<UpdateStatus />);
        getByText(/Update from .*2026, 14:30/);
        // The id is support detail, not the headline — short, and secondary.
        getByText('Update abcdef12');
    });

    it('tells the user to restart when an update is downloaded and pending', () => {
        mockUseUpdates.mockReturnValue(hookValue({ isUpdatePending: true }));
        const { getByText } = render(<UpdateStatus />);
        getByText('New update ready — restart the app to use it');
        fireEvent.press(getByText('Restart now'));
        expect(mockReloadAsync).toHaveBeenCalled();
    });

    it('offers a download when a newer update exists on the server', () => {
        mockUseUpdates.mockReturnValue(hookValue({ isUpdateAvailable: true }));
        const { getByText } = render(<UpdateStatus />);
        getByText('A new update is available');
        fireEvent.press(getByText('Download update'));
        expect(mockFetchUpdateAsync).toHaveBeenCalled();
    });

    it('confirms you are on the latest once a check has come back empty', () => {
        mockUseUpdates.mockReturnValue(
            hookValue({
                currentlyRunning: { isEmbeddedLaunch: false, createdAt: new Date(2026, 8, 5, 14, 30) },
                lastCheckForUpdateTimeSinceRestart: new Date(2026, 8, 6, 9, 5),
            }),
        );
        const { getByText } = render(<UpdateStatus />);
        getByText("You're on the latest — checked at 09:05");
    });

    it('offers a manual check, and swallows the rejection when it fails offline', async () => {
        mockCheckForUpdateAsync.mockRejectedValueOnce(new Error('offline'));
        mockUseUpdates.mockReturnValue(hookValue());
        const { getByText } = render(<UpdateStatus />);
        fireEvent.press(getByText('Check for updates'));
        expect(mockCheckForUpdateAsync).toHaveBeenCalled();
        await Promise.resolve();
    });

    it('says updates are off, and offers no button, in a dev build', () => {
        mockIsEnabled = false;
        mockUseUpdates.mockReturnValue(hookValue({ currentlyRunning: { isEmbeddedLaunch: true } }));
        const { getByText, queryByText } = render(<UpdateStatus />);
        getByText('Updates are off in this build');
        expect(queryByText('Check for updates')).toBeNull();
    });

    it('hides the action while a check is already running', () => {
        mockUseUpdates.mockReturnValue(hookValue({ isChecking: true }));
        const { getByText, queryByText } = render(<UpdateStatus />);
        getByText('Checking for updates…');
        expect(queryByText('Check for updates')).toBeNull();
    });
});
