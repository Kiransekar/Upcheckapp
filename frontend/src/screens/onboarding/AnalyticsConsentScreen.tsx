/**
 * AnalyticsConsentScreen — the ask that never existed (W8).
 *
 * Seventeen product events are wired, including SIGNUP_COMPLETED,
 * ONBOARDING_COMPLETED, FARM_CREATED, POND_CREATED, CYCLE_STARTED and
 * FIRST_LOG_RECORDED. Consent defaults to 'unasked', and the ONLY place to
 * grant it was a switch in Settings that nobody is ever prompted to open — so
 * in production the activation funnel is dark for effectively every user, and
 * every decision about onboarding ships on judgement with no way to tell
 * whether it worked. "Never ask" is not the same thing as privacy-first; it is
 * just a different way of learning nothing.
 *
 * Shown once, immediately after the account exists and BEFORE farm setup (D2),
 * so the setup funnel itself is measurable.
 *
 * Four rules this screen must keep, all inherited from the privacy
 * architecture it plugs into — none of which it changes:
 *
 *  1. **Nothing is pre-ticked and neither answer is styled as the default.**
 *     Two buttons of equal weight. A "No thanks" rendered as a grey link is a
 *     dark pattern with extra steps.
 *  2. **Declining is one tap and is permanent.** `shouldAskAnalyticsConsent`
 *     only returns true for 'unasked', so writing 'declined' is what
 *     guarantees this screen never appears again. It stays reversible in
 *     Settings, which is the farmer's move to make, not ours.
 *  3. **The copy matches the Privacy Policy.** Section 6 promises that
 *     switching this off "stops collection — it is not a preference we quietly
 *     ignore". The strings here are the same ones the Settings switch uses.
 *  4. **No skip, no dismiss, no back.** Not to trap anyone — declining is
 *     right there — but because a farmer who swipes past would stay 'unasked'
 *     and be asked again on the next launch, which is precisely what rule 2
 *     forbids.
 *
 * The SDK is still never constructed without consent: this screen writes the
 * preference and calls `syncAnalyticsConsent()`, the same single entry point
 * Settings uses, which starts or stops the client to match.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import {
    loadTelemetryPrefs,
    saveTelemetryPrefs,
    type ConsentState,
} from '../../features/telemetryPrefs';
import { syncAnalyticsConsent } from '../../features/analytics';
import { useAuthStore } from '../../store/authStore';

const c = theme.roles.light;

/** What the farmer is agreeing to, in their terms — not in ours. */
const POINTS = [
    { icon: 'check_circle' as const, key: 'onboarding.consentPointScreens' },
    { icon: 'check_circle' as const, key: 'onboarding.consentPointNever' },
    { icon: 'check_circle' as const, key: 'onboarding.consentPointSame' },
];

export const AnalyticsConsentScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<ConsentState | null>(null);

    const answer = async (analytics: ConsentState) => {
        setBusy(analytics);
        try {
            // Read-modify-write: `crashReports` is a separate promise made in
            // the Privacy Policy and must survive this answer untouched.
            const prefs = await loadTelemetryPrefs();
            await saveTelemetryPrefs({ ...prefs, analytics });
            // Start or stop the client to match, immediately — the same entry
            // point Settings uses. Never let a failure here strand the farmer
            // on a screen they have already answered.
            await syncAnalyticsConsent().catch(() => undefined);
        } catch {
            // Storage refused. Falling through is right: the default is
            // 'unasked', which means no data is collected — the safe side —
            // and the farmer is not held hostage to a disk error.
        } finally {
            setBusy(null);
            /**
             * Hand off to whatever the farmer was ON THEIR WAY TO.
             *
             * This screen sits in FRONT of first-run farm setup (D2), so a new
             * owner must land on Create-Farm and a new worker on Join-Farm
             * once they have answered — replacing straight to MainApp would
             * silently skip the mandatory setup step and drop them on an empty
             * dashboard. Everyone else (an existing account answering this on
             * an upgrade) goes to the app.
             *
             * `replace`, not `navigate`: this is the initial route when consent
             * is owed, so navigating would leave it underneath and let a back
             * gesture return to a question already answered.
             */
            const { pendingFarmSetup, pendingFarmJoin } = useAuthStore.getState();
            navigation.replace(
                pendingFarmSetup ? 'CreateFarm' : pendingFarmJoin ? 'JoinFarm' : 'MainApp',
            );
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.content}>
                <View style={styles.badge}>
                    <Icon name="lightbulb" size={28} color={c.primary} />
                </View>

                <Text style={styles.title}>{t('settings.analyticsPromptTitle')}</Text>
                <Text style={styles.body}>{t('settings.analyticsPromptBody')}</Text>

                <View style={styles.points}>
                    {POINTS.map((p) => (
                        <View key={p.key} style={styles.point}>
                            <Icon name={p.icon} size={18} color={c.successText} />
                            <Text style={styles.pointText}>{t(p.key)}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ flex: 1 }} />

                {/*
                  * Equal weight, deliberately. The accept is primary because it
                  * is the affirmative action, but the decline is a full-width
                  * button of the same size — not a link, not smaller text, and
                  * not below the fold.
                  */}
                <Button
                    title={t('settings.analyticsPromptAllow')}
                    onPress={() => answer('granted')}
                    loading={busy === 'granted'}
                    disabled={busy !== null}
                />
                <View style={{ height: theme.spacing[3] }} />
                <Button
                    title={t('settings.analyticsPromptDecline')}
                    variant="outlined"
                    onPress={() => answer('declined')}
                    loading={busy === 'declined'}
                    disabled={busy !== null}
                />
                <Text style={styles.footnote}>{t('onboarding.consentFootnote')}</Text>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { flex: 1, paddingTop: theme.spacing[8] },
    badge: {
        width: 56,
        height: 56,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceVariant,
        marginBottom: theme.spacing[5],
    },
    title: { ...theme.typeScale.displaySmall, color: c.textPrimary },
    body: {
        ...theme.typeScale.bodyMedium,
        color: c.textSecondary,
        marginTop: theme.spacing[3],
    },
    points: { marginTop: theme.spacing[6], gap: theme.spacing[3] },
    point: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
    pointText: { ...theme.typeScale.bodyMedium, color: c.textPrimary, flex: 1 },
    footnote: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        textAlign: 'center',
        marginTop: theme.spacing[4],
    },
});
