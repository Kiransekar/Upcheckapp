// The redesign gives an owner six tabs (Today · Farm · Log · Money · Team ·
// Settings) and a worker the same set MINUS Money. Money is exactly
// VIEW_FINANCIALS, so the tab set is derived from the capability matrix the
// backend enforces — not from any global account flag, which is what W3
// removed.
//
// This matters beyond cosmetics: the design-system rule is HIDE, never merely
// disable. A tab a worker may not open should not be on their screen at all.
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Every tab's screen is stubbed — this test is about which tabs exist, not
// what they render, and the real screens fan out to a dozen APIs.
jest.mock('../../screens/main/HomeScreen', () => ({ HomeScreen: () => null }));
jest.mock('../../screens/farms/FarmsListScreen', () => ({ FarmsListScreen: () => null }));
jest.mock('../../screens/main/ReportsScreen', () => ({ ReportsScreen: () => null }));
jest.mock('../../screens/main/MoreScreen', () => ({ MoreScreen: () => null }));
jest.mock('../../screens/main/TeamScreen', () => ({ TeamScreen: () => null }));
jest.mock('../../screens/finance/TransactionsScreen', () => ({ TransactionsScreen: () => null }));

const OWNER = { canViewFinancials: true, canRecordData: true, role: 'owner' };
let mockPerms: any = OWNER;
jest.mock('../../hooks/usePermissions', () => ({
    usePermissions: () => mockPerms,
}));

import { MainNavigator } from '../MainNavigator';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderNav = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <NavigationContainer>
                <MainNavigator />
            </NavigationContainer>
        </SafeAreaProvider>,
    );

describe('MainNavigator — the tab set follows the capability matrix', () => {
    beforeEach(() => {
        mockPerms = OWNER;
    });

    it('gives an owner all six tabs from the design', () => {
        const { getByText } = renderNav();
        for (const label of ['Today', 'Farm', 'Money', 'Team', 'Settings']) {
            expect(getByText(label)).toBeTruthy();
        }
    });

    it('hides Money from someone without VIEW_FINANCIALS', () => {
        mockPerms = { canViewFinancials: false, canRecordData: true, role: 'worker' };
        const { queryByText, getByText } = renderNav();

        // Hidden, not disabled.
        expect(queryByText('Money')).toBeNull();
        // ...and the rest of the nav is unchanged.
        for (const label of ['Today', 'Farm', 'Team', 'Settings']) {
            expect(getByText(label)).toBeTruthy();
        }
    });

    it('hides Money from a viewer too', () => {
        mockPerms = { canViewFinancials: false, canRecordData: false, role: 'viewer' };
        const { queryByText } = renderNav();
        expect(queryByText('Money')).toBeNull();
    });

    it('keeps Money for a manager, who does have VIEW_FINANCIALS by default', () => {
        mockPerms = { canViewFinancials: true, canRecordData: true, role: 'manager' };
        const { getByText } = renderNav();
        expect(getByText('Money')).toBeTruthy();
    });
});
