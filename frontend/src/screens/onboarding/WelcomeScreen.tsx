/**
 * WelcomeScreen — artboard 02. Value propositions only: what the app does,
 * three lines, one CTA.
 *
 * It used to carry the language picker, a fabricated "EXAMPLE — not your data"
 * dashboard card and the farm-creation hand-off all at once. Language is now
 * its own screen ahead of this one (artboard 01) and intent is its own screen
 * after it (artboard 03), which is the whole point of the redesign: one
 * decision per screen. The example card went with them — it was a static mockup
 * of numbers nobody had earned yet, and it competed with the only decision this
 * screen asks for.
 *
 * This is now a PRE-ACCOUNT screen. "Skip for now" leads to sign-in rather than
 * dismissing a modal, because there is no app behind it yet to fall back to.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { BrandLockup } from '../../components/ui/ShrimpLogo';
import { Button } from '../../components/ui/Button';
import { Icon, IconName } from '../../components/ui/Icon';
import { OnboardingProgress } from '../../components/ui/OnboardingProgress';
import { theme } from '../../theme';

const PROPS: { icon: IconName; key: string }[] = [
    { icon: 'water_drop', key: 'onboarding.welcomeProp1' },
    { icon: 'show_chart', key: 'onboarding.welcomeProp2' },
    { icon: 'groups', key: 'onboarding.welcomeProp3' },
];

export const WelcomeScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    return (
        <ScreenWrapper scroll={false}>
            {/* Language is reachable again from here — see the header comment
                for why this screen used to have nowhere to go back to. */}
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
            >
                <Icon name="arrow_back" size={24} color={theme.roles.light.textPrimary} />
            </TouchableOpacity>

            <OnboardingProgress step={2} />

            <View style={styles.brandRow}>
                <BrandLockup size={24} />
            </View>

            <Text style={styles.title}>{t('onboarding.welcomeTitle')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.welcomeSubtitle')}</Text>

            <View style={styles.props}>
                {PROPS.map((p) => (
                    <View key={p.key} style={styles.propRow}>
                        <View style={styles.propIcon}>
                            <Icon name={p.icon} size={22} color={theme.roles.light.infoText} />
                        </View>
                        <Text style={styles.propText}>{t(p.key)}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.spacer} />

            <Button
                title={t('onboarding.welcomeCta')}
                onPress={() => navigation.navigate('Intent')}
                style={styles.cta}
            />
            {/* Someone who already has an account should not be walked through
                intent and sign-up to reach the sign-in screen. */}
            <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.skip}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.welcomeSkip')}
            >
                <Text style={styles.skipText}>{t('onboarding.welcomeSkip')}</Text>
            </TouchableOpacity>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    back: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        marginLeft: -theme.spacing[2],
        marginTop: theme.spacing[2],
    },
    brandRow: { paddingTop: theme.spacing[2], paddingBottom: theme.spacing[8] },
    title: { ...theme.typeScale.displaySmall, color: theme.roles.light.textPrimary },
    subtitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
    },
    props: { gap: theme.spacing[5], marginTop: theme.spacing[8] },
    propRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    propIcon: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    propText: {
        flex: 1,
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
    },
    spacer: { flex: 1, minHeight: theme.spacing[8] },
    cta: { alignSelf: 'stretch' },
    skip: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing[2],
    },
    skipText: { ...theme.typeScale.labelLarge, color: theme.roles.light.textTertiary },
});

export default WelcomeScreen;
