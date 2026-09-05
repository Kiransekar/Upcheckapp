/**
 * "By creating an account, you agree to our Terms … and Privacy Policy."
 *
 * Shown on every screen that can CREATE an account — email sign-up, Truecaller,
 * the phone/missed-call fallback and the emailed one-time code. It lived inline
 * in RegisterScreen only, which meant three of the four ways to create an
 * Upcheck account presented no terms at all.
 *
 * Both `Terms` and `PrivacyPolicy` are registered in the unauthenticated AND
 * the authenticated stack (RootNavigator), so tapping a link and pressing back
 * returns the user exactly where they were — it does not restart the auth flow.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';

interface Props {
    navigation: { navigate: (route: string, params?: object) => void };
    /** Extra top margin where a screen needs more breathing room. */
    style?: object;
}

export const ConsentNotice: React.FC<Props> = ({ navigation, style }) => {
    const { t } = useTranslation();
    return (
        <Text style={[styles.consent, style]} testID="consent-notice">
            {t('auth.consentPrefix')}{' '}
            <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={() => navigation.navigate('Terms')}
            >
                {t('settings.termsOfService')}
            </Text>
            {' '}{t('auth.consentAnd')}{' '}
            <Text
                style={styles.link}
                accessibilityRole="link"
                onPress={() => navigation.navigate('PrivacyPolicy')}
            >
                {t('settings.privacyPolicy')}
            </Text>
            .
        </Text>
    );
};

const styles = StyleSheet.create({
    consent: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
        marginHorizontal: theme.spacing[2],
    },
    link: { color: theme.roles.light.textBrand, fontFamily: 'DMSans-SemiBold' },
});

export default ConsentNotice;
