/**
 * IntentScreen — artboard 03. "I run my own farm" vs "I work on someone's
 * farm", on its own screen, before the sign-up form.
 *
 * The answer is a SignupIntent (see store/authStore) and nothing more: a
 * first-run routing preference that decides whether the next step after
 * creating an account is "set up your farm" or "enter a join code". It is never
 * sent to the server and grants no authority — every real permission comes from
 * the per-farm role in farm_members. That is why the footnote says so out loud:
 * the question reads like an account type, and someone who picks "worker" must
 * not believe they have locked themselves out of ever owning a farm.
 *
 * It is carried to the create-account screen as a route param and handed to
 * `signup()`, which is the store's existing and only entry point for it.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { Icon, IconName } from '../../components/ui/Icon';
import { OnboardingProgress } from '../../components/ui/OnboardingProgress';
import { theme } from '../../theme';
import type { SignupIntent } from '../../store/authStore';

const OPTIONS: { key: SignupIntent; icon: IconName; title: string; sub: string }[] = [
    {
        key: 'own_farm',
        icon: 'home_work',
        title: 'onboarding.intentOwnTitle',
        sub: 'onboarding.intentOwnSub',
    },
    {
        key: 'work_on_farm',
        icon: 'engineering',
        title: 'onboarding.intentWorkTitle',
        sub: 'onboarding.intentWorkSub',
    },
];

export const IntentScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    // Pre-selected rather than empty: the design shows one option already
    // chosen, and Continue is never a dead button the farmer has to work out
    // how to enable.
    const [intent, setIntent] = useState<SignupIntent>('own_farm');

    return (
        <ScreenWrapper scroll={false}>
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.back}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
            >
                <Icon name="arrow_back" size={24} color={theme.roles.light.textPrimary} />
            </TouchableOpacity>

            <OnboardingProgress step={3} />

            <Text style={styles.title}>{t('onboarding.intentTitle')}</Text>

            <View style={styles.options}>
                {OPTIONS.map((opt) => {
                    const active = intent === opt.key;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            style={[styles.card, active && styles.cardActive]}
                            onPress={() => setIntent(opt.key)}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${t(opt.title)}. ${t(opt.sub)}`}
                        >
                            <Icon
                                name={opt.icon}
                                size={26}
                                color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                            />
                            <View style={styles.cardText}>
                                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                                    {t(opt.title)}
                                </Text>
                                <Text style={styles.cardSub}>{t(opt.sub)}</Text>
                            </View>
                            {active && (
                                <Icon name="check_circle" size={22} color={theme.roles.light.primary} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.spacer} />

            <Button
                title={t('common.continue')}
                onPress={() => navigation.navigate('Register', { intent })}
                style={styles.cta}
            />
            <Text style={styles.footnote}>{t('onboarding.intentFootnote')}</Text>
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
    title: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    options: { gap: theme.spacing[3] },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        minHeight: 72,
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    cardActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.infoBg,
    },
    cardText: { flex: 1, minWidth: 0, gap: 2 },
    cardTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    cardTitleActive: { color: theme.roles.light.infoText },
    cardSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    spacer: { flex: 1, minHeight: theme.spacing[8] },
    cta: { alignSelf: 'stretch' },
    footnote: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
    },
});

export default IntentScreen;
