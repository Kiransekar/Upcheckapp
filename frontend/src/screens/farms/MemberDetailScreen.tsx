/**
 * One member — "Tap any member to change their role or the ponds they can log."
 *
 * This is the screen that line on invite.png promises, and until now it did not
 * exist: the backend has had `PATCH /farms/:id/members/:userId/ponds` and
 * `.../financials` since W4 and W6, and the API client has had matching
 * methods, but nothing in the app could call either. Pond scoping and the
 * financial grant were unreachable features.
 *
 * Everything here is hidden by capability, never disabled — a manager who
 * cannot promote someone does not see a role picker greyed out, they see no
 * role picker. The backend enforces all of it regardless.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmMembersApi, type FarmMember, type AssignableRole } from '../../api/farmMembers';
import { apiErrorMessage } from '../../api/errors';
import { pondsApi, type Pond } from '../../api/ponds';
import { usePermissions } from '../../hooks/usePermissions';
import {
    canAssignRole,
    canManageMember,
    roleCan,
    type CapabilityOverrides,
    type FarmCapability,
} from '../../permissions/capabilities';
import { CapabilityGrid } from '../../components/members/CapabilityGrid';
import { useMembershipStore } from '../../store/membershipStore';
import { pondLabel } from '../../utils/pondHealth';
import { fullName } from './FarmMembersScreen';

const c = theme.roles.light;

const ASSIGNABLE: AssignableRole[] = ['manager', 'worker', 'viewer'];

/** Only these roles can be restricted to particular ponds — mirrors the backend. */
const SCOPABLE = ['worker', 'viewer'];

export const MemberDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName, member: initial } = route.params ?? {};
    const perms = usePermissions(farmId);
    const farmPolicy = useMembershipStore((s) => s.grantForFarm(farmId).policy);

    const [member, setMember] = useState<FarmMember>(initial);
    const [ponds, setPonds] = useState<Pond[]>([]);
    // Local mirror of the scope so the checkboxes respond instantly; an empty
    // set means "every pond", which is the backend's own meaning for no rows.
    const [scope, setScope] = useState<string[]>(initial?.pondIds ?? []);
    const [saving, setSaving] = useState(false);

    // React Navigation keeps this screen mounted — a mount-only fetch never
    // saw a pond created/renamed elsewhere (e.g. CreatePondScreen) on return,
    // same gap FarmMembersScreen already closes for its own pond list.
    useFocusEffect(useCallback(() => {
        pondsApi
            .getAll(farmId)
            .then(({ data }) => setPonds((data as any).data ?? data ?? []))
            .catch(() => setPonds([]));
    }, [farmId]));

    const name = member ? fullName(member) : '';

    const changeRole = useCallback(
        async (role: AssignableRole) => {
            if (role === member.role) return;
            setSaving(true);
            try {
                const { data } = await farmMembersApi.changeRole(farmId, member.userId, role);
                setMember((m) => ({ ...m, ...data, role }));
                // A promotion to manager clears any pond restriction, because a
                // manager is responsible for the whole farm — reflect that here
                // rather than showing a scope that no longer applies.
                if (!SCOPABLE.includes(role)) setScope([]);
            } catch (e: any) {
                Alert.alert(t('common.error'), apiErrorMessage(e, t('members.roleChangeError')));
            } finally {
                setSaving(false);
            }
        },
        [farmId, member, t],
    );

    const togglePond = useCallback(
        async (pondId: string) => {
            const next = scope.includes(pondId)
                ? scope.filter((id) => id !== pondId)
                : [...scope, pondId];
            setScope(next);
            try {
                await farmMembersApi.setPondScope(farmId, member.userId, next);
            } catch (e: any) {
                setScope(scope); // put it back — the server did not accept it
                Alert.alert(t('common.error'), apiErrorMessage(e, t('members.scopeError')));
            }
        },
        [farmId, member, scope, t],
    );

    const clearScope = useCallback(async () => {
        const previous = scope;
        setScope([]);
        try {
            await farmMembersApi.setPondScope(farmId, member.userId, []);
        } catch (e: any) {
            setScope(previous);
            Alert.alert(t('common.error'), apiErrorMessage(e, t('members.scopeError')));
        }
    }, [farmId, member, scope, t]);

    const setCapabilities = useCallback(
        async (next: CapabilityOverrides | null) => {
            const previous = member.capabilityOverrides ?? null;
            setMember((m) => ({ ...m, capabilityOverrides: next }));
            try {
                await farmMembersApi.setCapabilities(farmId, member.userId, next);
            } catch (e: any) {
                setMember((m) => ({ ...m, capabilityOverrides: previous }));
                Alert.alert(t('common.error'), apiErrorMessage(e, t('members.capabilitiesError')));
            }
        },
        [farmId, member, t],
    );

    const remove = () => {
        Alert.alert(t('members.removeTitle'), t('members.removeConfirm', { name }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('members.remove'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await farmMembersApi.removeMember(farmId, member.userId);
                        navigation.goBack();
                    } catch (e: any) {
                        Alert.alert(t('common.error'), apiErrorMessage(e, t('members.removeError')));
                    }
                },
            },
        ]);
    };

    const transfer = () => {
        Alert.alert(t('members.transferTitle'), t('members.transferConfirm', { name }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('members.transferCta'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await farmMembersApi.transferOwnership(farmId, member.userId);
                        navigation.goBack();
                    } catch (e: any) {
                        Alert.alert(t('common.error'), apiErrorMessage(e, t('members.transferError')));
                    }
                },
            },
        ]);
    };

    if (!member) {
        return (
            <ScreenWrapper>
                <Text style={styles.missing}>{t('members.emptyTitle')}</Text>
            </ScreenWrapper>
        );
    }

    const roleOptions = ASSIGNABLE.filter((r) => canAssignRole(perms.role, r));
    const canScope = SCOPABLE.includes(member.role) && canManageMember(perms.role, member.role);
    // Handing out capabilities is the owner's call alone (OWNER_ONLY on the
    // server), and an owner is never reducible, so their own row has no grid.
    const canGrantCapabilities = perms.canOwnerActions && member.role !== 'owner';
    // What this member gets with NO override — their role under this farm's
    // policy. The policy travels on the caller's own membership for this farm.
    const memberDefault = (capability: FarmCapability) =>
        roleCan(member.role, capability, null, farmPolicy);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={farmName ?? null}
                title={name}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                trailing={t(`members.role_${member.role}`).toUpperCase()}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {member.role !== 'owner' && roleOptions.length > 0 && (
                    <>
                        <SectionHeader label={t('members.roleSection')} />
                        <Text style={styles.note}>{t('members.roleNote')}</Text>
                        <View style={styles.pills}>
                            {roleOptions.map((role) => {
                                const active = member.role === role;
                                return (
                                    <TouchableOpacity
                                        key={role}
                                        style={[styles.pill, active && styles.pillActive]}
                                        onPress={() => changeRole(role)}
                                        disabled={saving}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                                            {t(`members.role_${role}`)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}

                {canScope && (
                    <>
                        <SectionHeader
                            label={t('members.pondsSection')}
                            actionLabel={scope.length ? t('members.allPondsAction') : undefined}
                            onAction={clearScope}
                        />
                        <Text style={styles.note}>
                            {scope.length === 0 ? t('members.scopeAllNote') : t('members.scopeSomeNote')}
                        </Text>
                        {ponds.length === 0 ? (
                            <Text style={styles.note}>{t('members.noPondsToScope')}</Text>
                        ) : (
                            ponds.map((pond) => {
                                // Nothing selected = every pond, so every box
                                // reads as ticked. Ticking one narrows to it.
                                const on = scope.length === 0 || scope.includes(pond.id);
                                return (
                                    <TouchableOpacity
                                        key={pond.id}
                                        style={styles.row}
                                        onPress={() => togglePond(pond.id)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: on }}
                                    >
                                        <Icon
                                            name={on ? 'check_circle' : 'radio_button_unchecked'}
                                            size={22}
                                            color={on ? c.primaryHover : c.textDisabled}
                                        />
                                        <Text style={styles.rowLabel} numberOfLines={1}>
                                            {pondLabel(pond)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </>
                )}

                {canGrantCapabilities && (
                    <>
                        <SectionHeader label={t('members.permissionsSection')} />
                        <Text style={styles.note}>{t('members.permissionsNote')}</Text>
                        <CapabilityGrid
                            value={member.capabilityOverrides ?? null}
                            defaults={memberDefault}
                            onChange={setCapabilities}
                        />
                    </>
                )}

                {(canManageMember(perms.role, member.role) || perms.canTransferOwnership) && (
                    /*
                     * Stacked full-width, not two half-width buttons side by
                     * side: these are the screen's two irreversible actions and
                     * a mis-tap hands the farm away. Full width also survives
                     * the long Odia and Tamil labels without truncating them.
                     */
                    <View style={styles.actions}>
                        {perms.canTransferOwnership && member.role !== 'owner' && (
                            <Button
                                title={t('members.transferCta')}
                                variant="outlined"
                                onPress={transfer}
                                style={styles.transferBtn}
                                textStyle={styles.transferLabel}
                            />
                        )}
                        {canManageMember(perms.role, member.role) && (
                            <Button
                                title={t('members.remove')}
                                variant="outlined"
                                onPress={remove}
                                style={styles.removeBtn}
                                textStyle={styles.removeLabel}
                            />
                        )}
                    </View>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },
    missing: { ...theme.typeScale.bodyLarge, color: c.textTertiary, textAlign: 'center' },
    note: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    pills: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    pill: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    pillActive: { borderColor: c.primaryHover, backgroundColor: c.infoBg },
    pillLabel: { ...theme.typeScale.labelLarge, color: c.textSecondary },
    pillLabelActive: { color: c.infoText },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    rowLabel: { ...theme.typeScale.bodyLarge, flex: 1, minWidth: 0, color: c.textPrimary },
    rowSub: { ...theme.typeScale.bodySmall, color: c.textTertiary },

    actions: {
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[6],
        marginTop: theme.spacing[8],
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
    },
    transferBtn: { borderColor: c.warningBorder },
    transferLabel: { color: c.warningText },
    removeBtn: { borderColor: c.dangerBorder },
    removeLabel: { color: c.dangerText },
});

export default MemberDetailScreen;
