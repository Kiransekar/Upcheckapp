/**
 * Every screen that can CREATE an account must show the terms, and tapping a
 * link must not restart the auth flow.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConsentNotice } from '../ConsentNotice';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string) => ({
            'auth.consentPrefix': 'By creating an account, you agree to our',
            'auth.consentAnd': 'and',
            'settings.termsOfService': 'Terms of Service',
            'settings.privacyPolicy': 'Privacy Policy',
        }[k] ?? k),
    }),
}));

describe('ConsentNotice', () => {
    const nav = () => ({ navigate: jest.fn() });

    it('states that creating an account accepts both documents', () => {
        const { getByTestId } = render(<ConsentNotice navigation={nav()} />);
        expect(getByTestId('consent-notice')).toBeTruthy();
    });

    it('opens the Terms screen, by navigate — never a reset', () => {
        const navigation = nav();
        const { getByText } = render(<ConsentNotice navigation={navigation} />);
        fireEvent.press(getByText('Terms of Service'));
        expect(navigation.navigate).toHaveBeenCalledWith('Terms');
    });

    it('opens the Privacy Policy screen', () => {
        const navigation = nav();
        const { getByText } = render(<ConsentNotice navigation={navigation} />);
        fireEvent.press(getByText('Privacy Policy'));
        expect(navigation.navigate).toHaveBeenCalledWith('PrivacyPolicy');
    });
});
