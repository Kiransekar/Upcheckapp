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
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmMembersApi, type FarmMember, type AssignableRole } from '../../api/farmMembers';
import { pondsApi, type Pond } from '../../api/ponds';
import { usePermissions } from '../../hooks/usePermissions';
import { canAssignRole, canManageMember } from '../../permissions/capabilities';
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

    const [member, setMember] = useState<FarmMember>(initial);
    const [ponds, setPonds] = useState<Pond[]>([]);
    // Local mirror of the scope so the checkboxes respond instantly; an empty
    // set means "every pond", which is the backend's own meaning for no rows.
    const [scope, setScope] = useState<string[]>(initial?.pondIds ?? []);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        pondsApi
            .getAll(farmId)
            .then(({ data }) => setPonds((data as any).data ?? data ?? []))
            .catch(() => setPonds([]));
    }, [farmId]);

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
                Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.roleChangeError'));
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
                Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.scopeError'));
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
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.scopeError'));
        }
    }, [farmId, member, scope, t]);

    const setFinancials = useCallback(
        async (value: boolean) => {
            const previous = member.canViewFinancials ?? null;
            setMember((m) => ({ ...m, canViewFinancials: value }));
            try {
                await farmMembersApi.setFinancialAccess(farmId, member.userId, value);
            } catch (e: any) {
                setMember((m) => ({ ...m, canViewFinancials: previous }));
                Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.financialsError'));
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
                        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.removeError'));
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
                        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.transferError'));
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
    // The financial grant is the owner's call alone (OWNER_ONLY on the server),
    // and only means anything for someone whose role does not already include it.
    const canGrantFinancials = perms.canOwnerActions && member.role !== 'owner' && member.role !== 'manager';

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

                {canGrantFinancials && (
                    <>
                        <SectionHeader label={t('members.financialsSection')} />
                        <View style={styles.row}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.rowLabel}>{t('members.financialsToggle')}</Text>
                                <Text style={styles.rowSub}>{t('members.financialsNote')}</Text>
                            </View>
                            <Switch
                                value={member.canViewFinancials === true}
                                onValueChange={setFinancials}
                                trackColor={{ false: c.borderDefault, true: c.primaryHover }}
                            />
                        </View>
                    </>
                )}

                {(canManageMember(perms.role, member.role) || perms.canTransferOwnership) && (
                    <View style={styles.actions}>
                        {perms.canTransferOwnership && member.role !== 'owner' && (
                            <TouchableOpacity
                                style={styles.transferBtn}
                                onPress={transfer}
                                accessibilityRole="button"
                            >
                                <Text style={styles.transferLabel}>{t('members.transferCta')}</Text>
                            </TouchableOpacity>
                        )}
                        {canManageMember(perms.role, member.role) && (
                            <TouchableOpacity
                                style={styles.removeBtn}
                                onPress={remove}
                                accessibilityRole="button"
                            >
                                <Text style={styles.removeLabel}>{t('members.remove')}</Text>
                            </TouchableOpacity>
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
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[8],
    },
    transferBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.warningBorder,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    transferLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.warningText },
    removeBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.dangerBorder,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    removeLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.dangerText },
});

export default MemberDetailScreen;
