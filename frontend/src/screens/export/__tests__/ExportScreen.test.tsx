/**
 * What the Export screen promises the rest of the app.
 *
 * The screen's whole job is to turn taps into ONE `ExportConfig` and hand it to
 * `runExport` once. So the assertions are: the config is exactly right, money
 * is unreachable without VIEW_FINANCIALS, a double tap makes one file, a
 * failure says something a farmer can act on, and no dataset shows a toggle it
 * cannot honour.
 */

// The export feature is owned by another layer and is mocked wholesale here —
// virtual so this suite does not depend on that module's build state.
jest.mock('../../../features/export', () => ({ runExport: jest.fn() }), { virtual: true });

jest.mock('../../../api/farms', () => ({ farmsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/ponds', () => ({ pondsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getAll: jest.fn() } }));

// `mock`-prefixed so babel-plugin-jest-hoist lets the factories close over them.
let mockCanViewFinancials = true;
jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({ canViewFinancials: mockCanViewFinancials }),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExportScreen } from '../ExportScreen';
import { runExport as runExportFn } from '../../../features/export';
import { farmsApi } from '../../../api/farms';
import { pondsApi } from '../../../api/ponds';
import { cropsApi } from '../../../api/crops';
import { ALL_SECTIONS, type ExportSections } from '../../../features/export/types';
import { DEFAULT_MONEY_PREFS, moneyPeriodRange } from '../../../features/moneyPrefs';
// The real store, not a mock: ScreenWrapper's OfflineIndicator reads the queue
// out of the same one, and a partial mock takes the whole screen down.
import { useSyncStore } from '../../../store/syncStore';

const runExport = runExportFn as jest.Mock;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderScreen = (params: any = {}) =>
    render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 400, height: 800 },
                insets: { top: 0, left: 0, right: 0, bottom: 0 },
            }}
        >
            <ExportScreen route={{ params }} navigation={navigation} />
        </SafeAreaProvider>,
    );

/** The eight section flags, with only the named ones true. */
const sectionsWith = (...on: (keyof ExportSections)[]): ExportSections => {
    const s = { ...ALL_SECTIONS };
    (Object.keys(s) as (keyof ExportSections)[]).forEach((k) => { s[k] = on.includes(k); });
    return s;
};

beforeEach(() => {
    jest.clearAllMocks();
    mockCanViewFinancials = true;
    useSyncStore.setState({ isConnected: true });
    runExport.mockResolvedValue({ uri: 'file:///r.pdf', filename: 'r.pdf', mimeType: 'application/pdf', format: 'pdf' });
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'f1', name: 'Farm one' }] });
    (pondsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'p1', name: 'Pond one' }] });
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'c1', name: 'Cycle one' }] });
});

describe('the config handed to runExport', () => {
    /**
     * The clock is read TWICE here and the two readings must agree: the screen
     * calls `moneyPeriodRange()` (default `now = new Date()`) inside its config
     * useMemo while rendering, and the assertion below calls it again after the
     * await. A day boundary landing between the two — likelier on a slow cold
     * run, which is exactly the first run after an edit — changes `endDate` and
     * fails a deep equality that passes on the very next run.
     *
     * Pinning the system time removes the race without weakening the assertion
     * to `expect.any(String)`. Timers are pinned for this test only: `waitFor`
     * elsewhere in this file relies on the real ones.
     */
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout'] });
        jest.setSystemTime(new Date('2026-08-19T09:00:00.000Z')); // a Wednesday
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('is exactly what the farmer chose', async () => {
        const { getByTestId } = renderScreen({ dataset: 'cycle', farmId: 'f1', pondId: 'p1', cropId: 'c1' });

        fireEvent.press(getByTestId('export-format-xlsx'));
        fireEvent.press(getByTestId('export-period-week'));
        fireEvent.press(getByTestId('export-language-ta'));
        // A report for a buyer, with the cost breakdown left out — the one
        // opt-out that exists for a privacy reason rather than a display one.
        fireEvent(getByTestId('export-section-costs'), 'valueChange', false);

        fireEvent.press(getByTestId('export-submit'));

        await waitFor(() => expect(runExport).toHaveBeenCalledTimes(1));

        const range = moneyPeriodRange({ ...DEFAULT_MONEY_PREFS, period: 'week' });
        expect(runExport).toHaveBeenCalledWith({
            dataset: 'cycle',
            format: 'xlsx',
            startDate: range.startDate,
            endDate: range.endDate,
            farmId: 'f1',
            pondId: 'p1',
            cropId: 'c1',
            sections: sectionsWith('summary', 'waterQuality', 'feed', 'sampling', 'mortality', 'treatments', 'harvest'),
            language: 'ta',
        });
    });
});

describe('permissions', () => {
    it('does not offer the money dataset without VIEW_FINANCIALS', () => {
        mockCanViewFinancials = false;
        const { queryByTestId } = renderScreen({ farmId: 'f1' });

        expect(queryByTestId('export-dataset-money')).toBeNull();
        // ...and the costs section goes with it, on every dataset.
        expect(queryByTestId('export-section-costs')).toBeNull();
    });

    it('offers it when the farmer may see financials', () => {
        const { getByTestId } = renderScreen({ farmId: 'f1' });
        expect(getByTestId('export-dataset-money')).toBeTruthy();
    });
});

describe('the export button', () => {
    it('runs once however many times it is tapped', async () => {
        let release: (v: any) => void = () => {};
        runExport.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

        const { getByTestId } = renderScreen({ farmId: 'f1', cropId: 'c1' });
        const button = getByTestId('export-submit');

        fireEvent.press(button);
        fireEvent.press(button);
        fireEvent.press(button);

        expect(runExport).toHaveBeenCalledTimes(1);
        release({ uri: 'x', filename: 'x', mimeType: 'application/pdf', format: 'pdf' });
        await waitFor(() => expect(runExport).toHaveBeenCalledTimes(1));
    });

    it('shows a legible message and stays usable when the export fails', async () => {
        runExport.mockRejectedValue(new Error('socket hang up'));

        const { getByTestId, getByText, queryByText } = renderScreen({ farmId: 'f1', cropId: 'c1' });
        fireEvent.press(getByTestId('export-submit'));

        await waitFor(() => expect(getByTestId('export-notice')).toBeTruthy());
        expect(getByText('Could not build the report')).toBeTruthy();
        // The raw failure never reaches the farmer.
        expect(queryByText(/socket hang up/)).toBeNull();
        // And the button is back — a failed export must be retryable.
        expect(getByTestId('export-submit').props.accessibilityState.disabled).toBe(false);
        expect(getByText('Export')).toBeTruthy();
    });

    it('calls an empty range empty, not broken', async () => {
        // `ExportError('no-data', …)` — the collector's own signal.
        runExport.mockRejectedValue(Object.assign(new Error('no rows'), { code: 'no-data' }));

        const { getByTestId, getByText } = renderScreen({ farmId: 'f1', cropId: 'c1' });
        fireEvent.press(getByTestId('export-submit'));

        await waitFor(() => expect(getByText('Nothing to export')).toBeTruthy());
    });

    it('says so when offline instead of spending time finding out', () => {
        useSyncStore.setState({ isConnected: false });

        const { getByTestId, getByText } = renderScreen({ farmId: 'f1', cropId: 'c1' });
        fireEvent.press(getByTestId('export-submit'));

        expect(runExport).not.toHaveBeenCalled();
        expect(getByText('You are offline. Connect to the internet and try again.')).toBeTruthy();
    });
});

describe('section toggles', () => {
    it('hides the sections a dataset cannot produce', () => {
        const { getByTestId, queryByTestId } = renderScreen({ farmId: 'f1', cropId: 'c1' });

        // Cycle report — all eight.
        expect(getByTestId('export-section-harvest')).toBeTruthy();
        expect(getByTestId('export-section-waterQuality')).toBeTruthy();

        fireEvent.press(getByTestId('export-dataset-pondLogs'));
        expect(getByTestId('export-section-feed')).toBeTruthy();
        expect(queryByTestId('export-section-harvest')).toBeNull();

        // Attendance has exactly one meaningful block, so the whole group goes.
        fireEvent.press(getByTestId('export-dataset-attendance'));
        expect(queryByTestId('export-section-waterQuality')).toBeNull();
        expect(queryByTestId('export-section-summary')).toBeNull();
    });

    it('sends a hidden section as false rather than leaking it', async () => {
        const { getByTestId } = renderScreen({ farmId: 'f1', pondId: 'p1' });

        fireEvent.press(getByTestId('export-dataset-attendance'));
        fireEvent.press(getByTestId('export-submit'));

        await waitFor(() => expect(runExport).toHaveBeenCalledTimes(1));
        expect(runExport.mock.calls[0][0].sections).toEqual(sectionsWith('summary'));
    });
});
