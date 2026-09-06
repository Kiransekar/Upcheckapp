/**
 * JoinedFarmScreen — artboard 08, "You're in".
 *
 * A confirmation with one job: tell the worker WHICH farm they landed on and
 * WHAT they may do there, before dropping them into a dashboard where both
 * facts are implicit. The role is shown as an icon plus a colour plus a word —
 * a colour-only badge is unreadable to a farmer who cannot distinguish the
 * green from the grey.
 *
 * ── Where this departs from the drawing, and why ──────────────────────────
 * The artboard has one outcome, "You joined the farm". The server has two:
 * `POST /farm-members/join` returns a membership whose status is `pending` when
 * the farm requires approval (`requireApproval` on its join policy, which is
 * ON by default). Showing "You joined the farm" to someone who has NOT joined
 * yet would send them to a dashboard where every action fails with no
 * explanation, so a pending arrival gets its own honest wording and a warning
 * tone. The success case is exactly as drawn.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { Icon, IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import type { FarmRole } from '../../api/farmMembers';

const c = theme.roles.light;

/** Icon + background + foreground per role, straight off the artboard. */
const ROLE_BADGE: Record<FarmRole, { icon: IconName; bg: string; fg: string }> = {
    owner: { icon: 'workspace_premium', bg: c.infoBg, fg: c.infoText },
    manager: { icon: 'badge', bg: c.surfaceVariant, fg: c.textSecondary },
    worker: { icon: 'engineering', bg: c.successBg, fg: c.successText },
    viewer: { icon: 'visibility', bg: c.surfaceVariant, fg: c.textTertiary },
};

export const RoleBadge = ({ role }: { role: FarmRole }) => {
    const { t } = useTranslation();
    const meta = ROLE_BADGE[role] ?? ROLE_BADGE.viewer;
    return (
        <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Icon name={meta.icon} size={16} color={meta.fg} />
            <Text style={[styles.badgeText, { color: meta.fg }]}>{t(`members.role_${role}`)}</Text>
        </View>
    );
};

export const JoinedFarmScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { farmName, role, status } = route.params as {
        farmName: string;
        role: FarmRole;
        status: 'active' | 'pending';
    };
    const pending = status === 'pending';

    return (
        <ScreenWrapper scroll={false}>
            <View style={styles.titleRow}>
                <Icon
                    name={pending ? 'schedule' : 'check_circle'}
                    size={28}
                    color={pending ? c.warningText : c.successText}
                />
                <Text style={styles.title}>
                    {t(pending ? 'onboarding.joinedPendingTitle' : 'onboarding.joinFarmSuccessTitle')}
                </Text>
            </View>

            <View style={styles.card}>
                <Icon name="warehouse" size={24} color={c.textSecondary} />
                <View style={styles.cardText}>
                    <Text style={styles.farmName} numberOfLines={2}>{farmName}</Text>
                    <RoleBadge role={role} />
                </View>
            </View>

            <Text style={styles.body}>
                {t(pending ? 'onboarding.joinedPendingBody' : 'onboarding.joinedBody')}
            </Text>

            <View style={styles.spacer} />

            <Button
                // "Go to dashboard" is not true for a pending arrival — Home
                // shows them the waiting state, which is the honest hand-off
                // (W1). Naming the destination wrongly is how the old flow
                // implied the farm was already theirs.
                title={t(pending ? 'onboarding.joinedPendingCta' : 'onboarding.joinedCta')}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] })}
                style={styles.cta}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingTop: theme.spacing[8],
        marginBottom: theme.spacing[6],
    },
    title: { ...theme.typeScale.h2, color: c.textPrimary, flex: 1 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: c.borderDefault,
        backgroundColor: c.surface,
    },
    cardText: { flex: 1, minWidth: 0, gap: theme.spacing[2], alignItems: 'flex-start' },
    farmName: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
    },
    badgeText: { ...theme.typeScale.labelSmall },
    body: {
        ...theme.typeScale.bodyMedium,
        color: c.textSecondary,
        marginTop: theme.spacing[4],
    },
    spacer: { flex: 1, minHeight: theme.spacing[8] },
    cta: { alignSelf: 'stretch' },
});

export default JoinedFarmScreen;
