/**
 * FarmMembersScreen — owner's team roster for one farm. Lists current members
 * (owner + workers) and lets the owner add a worker (by scanning their profile
 * QR or entering an identifier) or remove one. Workers reach this screen
 * read-only (no add/remove controls).
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { farmMembersApi, type FarmMember, type AssignableRole, type FarmInvite } from '../../api/farmMembers';
import { farmsApi } from '../../api/farms';
import { usePermissions } from '../../hooks/usePermissions';
import { canManageMember } from '../../permissions/capabilities';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const fullName = (m: FarmMember) => {
    const u = m.user;
    if (!u) return m.userId.slice(0, 8);
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return name || u.username || m.userId.slice(0, 8);
};

export const FarmMembersScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};
    const [members, setMembers] = useState<FarmMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [farmCode, setFarmCode] = useState<string | null>(null);
    const [invites, setInvites] = useState<FarmInvite[]>([]);
    const [inviteBusy, setInviteBusy] = useState(false);
    const [pending, setPending] = useState<FarmMember[]>([]);
    const [error, setError] = useState<any>(null);
    const perms = usePermissions(farmId);

    const load = useCallback(async () => {
        try {
            const { data } = await farmMembersApi.listMembers(farmId);
            setMembers(data);
            setError(null);
        } catch (e: any) {
            // Do NOT fall through to the empty state here. A network or server
            // failure is not "this farm has no members" — telling an owner their
            // roster is empty when it is not is worse than showing the error.
            setError(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [farmId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    useFocusEffect(useCallback(() => {
        if (!perms.canInviteMember) return;
        farmsApi.getById(farmId)
            .then(({ data }) => setFarmCode(data.farmCode ?? null))
            .catch(() => setFarmCode(null));
    }, [farmId, perms.canInviteMember]));

    const copyFarmCode = async () => {
        if (!farmCode) return;
        await Clipboard.setStringAsync(farmCode);
        Alert.alert(t('members.codeCopiedTitle'), t('members.codeCopiedSub'));
    };

    // ── Invites ────────────────────────────────────────────────
    // The server returns only usable invites (not revoked, not expired, not
    // exhausted), newest first, so the head is the one to show.
    const activeInvite = invites[0] ?? null;

    const loadInvites = useCallback(async () => {
        if (!perms.canInviteMember) return;
        try {
            const { data } = await farmMembersApi.listInvites(farmId);
            setInvites(data);
        } catch {
            // Non-fatal: the roster is the point of this screen. A missing
            // invites table (migration not yet run) lands here too.
            setInvites([]);
        }
    }, [farmId, perms.canInviteMember]);

    useFocusEffect(useCallback(() => { loadInvites(); }, [loadInvites]));

    const loadPending = useCallback(async () => {
        if (!perms.canInviteMember) return;
        try {
            const { data } = await farmMembersApi.listPending(farmId);
            setPending(data);
        } catch {
            // Non-fatal, and expected for a manager on a farm whose owner
            // restricted approval to themselves — they simply see no queue.
            setPending([]);
        }
    }, [farmId, perms.canInviteMember]);

    useFocusEffect(useCallback(() => { loadPending(); }, [loadPending]));

    const approve = useCallback(async (m: FarmMember) => {
        try {
            await farmMembersApi.approveMember(farmId, m.userId);
            setPending((cur) => cur.filter((p) => p.id !== m.id));
            load();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.approveError'));
        }
    }, [farmId, load, t]);

    const decline = useCallback((m: FarmMember) => {
        Alert.alert(
            t('members.declineTitle'),
            t('members.declineConfirm', { name: fullName(m) }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('members.decline'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await farmMembersApi.declineMember(farmId, m.userId);
                            setPending((cur) => cur.filter((p) => p.id !== m.id));
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.approveError'));
                        }
                    },
                },
            ],
        );
    }, [farmId, t]);

    const createInvite = useCallback(async () => {
        setInviteBusy(true);
        try {
            // Replaces any existing active invite rather than accumulating
            // codes nobody is tracking — one live credential per farm is what
            // an owner can actually reason about.
            const { data } = await farmMembersApi.rotateInvite(farmId, {});
            setInvites([data]);
            await Clipboard.setStringAsync(data.code);
            Alert.alert(t('members.inviteCreatedTitle'), t('members.inviteCreatedSub'));
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.inviteError'));
        } finally {
            setInviteBusy(false);
        }
    }, [farmId, t]);

    const revokeInvite = useCallback((invite: FarmInvite) => {
        Alert.alert(
            t('members.revokeTitle'),
            t('members.revokeConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('members.revokeInvite'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await farmMembersApi.revokeInvite(farmId, invite.id);
                            setInvites((cur) => cur.filter((i) => i.id !== invite.id));
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.inviteError'));
                        }
                    },
                },
            ],
        );
    }, [farmId, t]);

    const copyInvite = async (code: string) => {
        await Clipboard.setStringAsync(code);
        Alert.alert(t('members.codeCopiedTitle'), t('members.inviteCopiedSub'));
    };

    const shareInvite = async (code: string) => {
        try {
            await Share.share({ message: t('members.shareInviteMessage', { code, farm: farmName ?? '' }) });
        } catch {
            // User dismissed the share sheet — nothing to report.
        }
    };

    /** "Expires in 6 days · 1 of 3 used" — expiry and remaining uses at a glance. */
    const inviteMeta = (invite: FarmInvite) => {
        const parts: string[] = [];
        if (invite.expiresAt) {
            const hours = Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / 3600_000));
            parts.push(
                hours >= 48
                    ? t('members.expiresInDays', { count: Math.round(hours / 24) })
                    : t('members.expiresInHours', { count: hours }),
            );
        } else {
            parts.push(t('members.neverExpires'));
        }
        parts.push(
            invite.maxUses > 0
                ? t('members.usesCount', { used: invite.usedCount, max: invite.maxUses })
                : t('members.unlimitedUses'),
        );
        return parts.join(' · ');
    };

    const remove = (m: FarmMember) => {
        Alert.alert(
            t('members.removeTitle'),
            t('members.removeConfirm', { name: fullName(m) }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('members.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await farmMembersApi.removeMember(farmId, m.userId);
                            load();
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.removeError'));
                        }
                    },
                },
            ],
        );
    };

    const changeRole = (m: FarmMember) => {
        const options: AssignableRole[] = ['manager', 'worker', 'viewer'];
        Alert.alert(t('members.changeRoleTitle', 'Change role'), fullName(m), [
            ...options.map((r) => ({
                text: t(`members.role_${r}`, r),
                onPress: async () => {
                    try {
                        await farmMembersApi.changeRole(farmId, m.userId, r);
                        load();
                    } catch (e: any) {
                        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.roleChangeError', 'Could not change role'));
                    }
                },
            })),
            { text: t('common.cancel'), style: 'cancel' as const },
        ]);
    };

    const transfer = (m: FarmMember) => {
        Alert.alert(
            t('members.transferTitle', 'Transfer ownership'),
            t('members.transferConfirm', { name: fullName(m), defaultValue: `Make ${fullName(m)} the owner? You will become a manager.` }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('members.transferCta', 'Transfer'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await farmMembersApi.transferOwnership(farmId, m.userId);
                            load();
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.transferError', 'Could not transfer ownership'));
                        }
                    },
                },
            ],
        );
    };

    const renderItem = ({ item }: { item: FarmMember }) => (
        <Card style={styles.row}>
            <View style={[styles.avatar, item.role === 'owner' && styles.avatarOwner]}>
                <MaterialCommunityIcons
                    name={item.role === 'owner' ? 'crown' : 'account'}
                    size={20}
                    color={item.role === 'owner' ? theme.roles.light.warningText : theme.roles.light.primary}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{fullName(item)}</Text>
                <Text style={styles.role} numberOfLines={1}>{t(`members.role_${item.role}`)}</Text>
            </View>
            <View style={styles.rowActions}>
                {perms.canChangeRoles && item.role !== 'owner' && (
                    <TouchableOpacity onPress={() => changeRole(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('members.changeRoleTitle', 'Change role')}>
                        <MaterialCommunityIcons name="account-cog-outline" size={22} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                )}
                {perms.canTransferOwnership && item.role !== 'owner' && (
                    <TouchableOpacity onPress={() => transfer(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('members.transferTitle', 'Transfer ownership')}>
                        <MaterialCommunityIcons name="crown-outline" size={22} color={theme.roles.light.warningText} />
                    </TouchableOpacity>
                )}
                {canManageMember(perms.role, item.role) && (
                    <TouchableOpacity onPress={() => remove(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('members.remove')}>
                        <MaterialCommunityIcons name="account-remove-outline" size={22} color={theme.roles.light.dangerText} />
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{t('members.title')}</Text>
                    {farmName ? <Text style={styles.subtitle} numberOfLines={1}>{farmName}</Text> : null}
                </View>
            </View>

            {/*
              * Identity, not credential. The farm code used to double as the
              * join password; it is now just the farm's public identifier, and
              * says so. Joining goes through the invite card below.
              */}
            {farmCode ? (
                <Card style={styles.codeCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.codeLabel}>{t('members.farmCodeLabel')}</Text>
                        <Text style={styles.codeValue}>{farmCode}</Text>
                        <Text style={styles.codeHint}>{t('members.farmCodeIdentityHint')}</Text>
                    </View>
                    <TouchableOpacity onPress={copyFarmCode} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('members.copyCode')}>
                        <MaterialCommunityIcons name="content-copy" size={22} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                </Card>
            ) : null}

            {perms.canInviteMember ? (
                <Card style={styles.inviteCard}>
                    <View style={styles.inviteHeader}>
                        <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color={theme.roles.light.primary} />
                        <Text style={styles.inviteTitle}>{t('members.inviteTitle')}</Text>
                    </View>

                    {activeInvite ? (
                        <>
                            <View style={styles.inviteCodeRow}>
                                <Text style={styles.codeValue} accessibilityLabel={activeInvite.code.split('').join(' ')}>
                                    {activeInvite.code}
                                </Text>
                                <View style={styles.rowActions}>
                                    <TouchableOpacity
                                        onPress={() => copyInvite(activeInvite.code)}
                                        hitSlop={HIT_SLOP}
                                        accessibilityLabel={t('members.copyCode')}
                                    >
                                        <MaterialCommunityIcons name="content-copy" size={22} color={theme.roles.light.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => shareInvite(activeInvite.code)}
                                        hitSlop={HIT_SLOP}
                                        accessibilityLabel={t('members.shareInvite')}
                                    >
                                        <MaterialCommunityIcons name="share-variant-outline" size={22} color={theme.roles.light.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => revokeInvite(activeInvite)}
                                        hitSlop={HIT_SLOP}
                                        accessibilityLabel={t('members.revokeInvite')}
                                    >
                                        <MaterialCommunityIcons name="close-circle-outline" size={22} color={theme.roles.light.dangerText} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.codeHint}>{inviteMeta(activeInvite)}</Text>
                        </>
                    ) : (
                        <Text style={styles.codeHint}>{t('members.noActiveInvite')}</Text>
                    )}

                    <Button
                        title={activeInvite ? t('members.newInvite') : t('members.createInvite')}
                        onPress={createInvite}
                        variant="outlined"
                        loading={inviteBusy}
                        disabled={inviteBusy}
                        style={styles.inviteBtn}
                    />
                </Card>
            ) : null}

            {/*
              * "Waiting to be let in" — people who used the farm code while the
              * farm is on manual approval. They have NO access until approved;
              * this is the only place they appear at all.
              */}
            {pending.length > 0 ? (
                <View style={styles.pendingSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>{t('members.waitingTitle')}</Text>
                        <Text style={styles.sectionCount}>{pending.length}</Text>
                    </View>
                    {pending.map((m) => (
                        <Card key={m.id} style={styles.pendingCard}>
                            <Text style={styles.name}>{fullName(m)}</Text>
                            <Text style={styles.pendingSub}>{t('members.usedYourCode')}</Text>
                            <View style={styles.pendingActions}>
                                <Button
                                    title={t('members.letIn')}
                                    onPress={() => approve(m)}
                                    style={styles.pendingBtn}
                                />
                                <Button
                                    title={t('members.decline')}
                                    onPress={() => decline(m)}
                                    variant="outlined"
                                    style={styles.pendingBtn}
                                />
                            </View>
                        </Card>
                    ))}
                </View>
            ) : null}

            <FlatList
                data={members}
                keyExtractor={(m) => m.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
                ListEmptyComponent={
                    loading ? null : error ? (
                        <ErrorState
                            icon="account-group-outline"
                            title={t('members.loadErrorTitle')}
                            error={error}
                            onRetry={() => { setLoading(true); load(); }}
                        />
                    ) : (
                        <EmptyState icon="account-group-outline" title={t('members.emptyTitle')} subtitle={t('members.emptySub')} />
                    )
                }
            />

            {perms.canInviteMember && (
                <Button
                    title={t('members.addWorker')}
                    onPress={() => navigation.navigate('AddWorker', { farmId, farmName })}
                    style={styles.addBtn}
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    backBtn: { padding: theme.spacing[1] },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    list: { paddingBottom: theme.spacing[6], gap: theme.spacing[3] },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[4] },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    avatar: {
        width: 40, height: 40, borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center',
    },
    avatarOwner: { backgroundColor: theme.roles.light.warningBg },
    codeCard: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        padding: theme.spacing[4], marginBottom: theme.spacing[3],
    },
    codeLabel: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    codeValue: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary, letterSpacing: 2 },
    codeHint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginTop: theme.spacing[1] },
    name: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    role: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    inviteCard: { padding: theme.spacing[4], marginBottom: theme.spacing[3], gap: theme.spacing[2] },
    inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    inviteTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    inviteCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[3] },
    inviteBtn: { marginTop: theme.spacing[1] },
    pendingSection: { marginBottom: theme.spacing[3], gap: theme.spacing[2] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary, letterSpacing: 1, textTransform: 'uppercase' },
    sectionCount: { ...theme.typeScale.bodySmall, color: theme.roles.light.warningText },
    pendingCard: { padding: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.roles.light.warningBg },
    pendingSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.warningText },
    pendingActions: { flexDirection: 'row', gap: theme.spacing[2] },
    pendingBtn: { flex: 1 },
    addBtn: { marginTop: theme.spacing[2] },
});

export default FarmMembersScreen;
