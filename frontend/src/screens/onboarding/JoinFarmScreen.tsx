/**
 * JoinFarmScreen — first-run step for a worker: enter the 8-character farm
 * code (shown to the owner/manager in FarmMembersScreen) to self-serve join
 * a farm as a worker. Reached either as the gated first screen after a
 * worker signs up (pendingFarmJoin, see RootNavigator/authStore), or later
 * from the "no farm yet" empty state on HomeScreen. Skippable either way —
 * a worker with no farm just sees HomeScreen's existing empty state.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { farmMembersApi, inviteRejectionOf } from '../../api/farmMembers';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useUIStore } from '../../store/uiStore';

export const JoinFarmScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const pendingFarmJoin = useAuthStore((s) => s.pendingFarmJoin);
    const completeFarmJoin = useAuthStore((s) => s.completeFarmJoin);
    const loadMemberships = useMembershipStore((s) => s.load);
    const showToast = useUIStore((s) => s.showToast);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    const goToApp = () => {
        if (pendingFarmJoin) completeFarmJoin();
        navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
    };

    const join = async () => {
        const value = code.trim().toUpperCase();
        if (!value) return;
        setBusy(true);
        try {
            const { data } = await farmMembersApi.joinFarm(value);
            await loadMemberships();
            // Toast, not a native Alert — matches CreateFarm's success feedback
            // (the app elsewhere confirms with a toast, not an OK-button dialog).
            showToast({
                message: t('onboarding.joinFarmSuccessSub', { name: data.farm?.name ?? '' }),
                type: 'success',
            });
            goToApp();
        } catch (e: any) {
            // The server distinguishes a wrong code from a code that existed
            // and is no longer usable. Translate each, so "expired" doesn't
            // read as "you typed it wrong" and send the worker round in circles.
            const reason = inviteRejectionOf(e);
            const REASON_KEY = {
                expired: 'members.joinExpired',
                revoked: 'members.joinRevoked',
                exhausted: 'members.joinExhausted',
                not_found: 'members.joinNotFound',
            } as const;
            showToast({
                message: reason
                    ? t(REASON_KEY[reason])
                    : e?.response?.data?.message ?? t('onboarding.joinFarmError'),
                type: 'error',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScreenWrapper>
            {/* When a worker opens this later from the Home empty-state (not the
                first-run gate), they need a way back; during the first-run gate
                the "I'll do this later" skip below is the exit instead. */}
            {!pendingFarmJoin && (
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back', 'Back')}
                    style={styles.backBtn}
                >
                    <MaterialCommunityIcons name="chevron-left" size={26} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
            )}
            <View style={styles.header}>
                <Text style={styles.title}>{t('onboarding.joinFarmTitle')}</Text>
                <Text style={styles.subtitle}>{t('onboarding.joinFarmSubtitle')}</Text>
            </View>

            <Card style={styles.card}>
                <Input
                    label={t('onboarding.joinFarmCodeLabel')}
                    value={code}
                    onChangeText={setCode}
                    placeholder={t('onboarding.joinFarmCodePlaceholder')}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={8}
                    leftIcon="key-outline"
                />
                <Button
                    title={t('onboarding.joinFarmCta')}
                    onPress={join}
                    loading={busy}
                    disabled={code.trim().length !== 8}
                    style={styles.joinBtn}
                />
            </Card>

            <Button
                title={t('onboarding.joinFarmSkip')}
                variant="text"
                onPress={goToApp}
                style={styles.skipBtn}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    backBtn: { marginLeft: -theme.spacing[2], marginBottom: theme.spacing[2] },
    header: { marginBottom: theme.spacing[6] },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginTop: theme.spacing[2] },
    card: { padding: theme.spacing[4] },
    joinBtn: { marginTop: theme.spacing[4] },
    skipBtn: { marginTop: theme.spacing[4] },
});

export default JoinFarmScreen;
