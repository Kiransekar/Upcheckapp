/**
 * Members — frontend/design/invite.png.
 *
 * The roster for one farm: who is on it, who is waiting to be let in, and the
 * code that lets someone join.
 *
 * ONE deliberate departure from the drawing. It shows a single big "FARM CODE"
 * captioned "Anyone with this joins as a worker" — which is how the app used to
 * work, and is exactly what W2 fixed. The farm code is now the farm's public
 * identifier and nothing more; joining goes through an INVITE, which expires,
 * counts its uses and can be revoked. So the design's hero block is bound to
 * the invite code (that IS the thing that lets someone in) and the farm code
 * stays as a small identity line under the roster heading.
 *
 * The QR is the same code, scannable — AddWorkerScreen already reads one, so
 * this closes the loop for a worker standing next to the owner.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmMembersApi, type FarmMember, type FarmInvite, type FarmRole } from '../../api/farmMembers';
import { farmsApi } from '../../api/farms';
import { pondsApi } from '../../api/ponds';
import { usePermissions } from '../../hooks/usePermissions';
import { personName } from '../../utils/personName';

const c = theme.roles.light;

/** Role → the icon and colour the design gives that row. */
const ROLE_META: Record<FarmRole, { icon: IconName; color: string }> = {
    owner: { icon: 'workspace_premium', color: c.textLink },
    manager: { icon: 'badge', color: c.textPrimary },
    worker: { icon: 'agriculture', color: c.successText },
    viewer: { icon: 'account_circle', color: c.textTertiary },
};

export const fullName = (m: FarmMember) => personName(m.user, m.userId.slice(0, 8));

export const FarmMembersScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};

    const [members, setMembers] = useState<FarmMember[]>([]);
    const [pending, setPending] = useState<FarmMember[]>([]);
    const [invites, setInvites] = useState<FarmInvite[]>([]);
    const [farmCode, setFarmCode] = useState<string | null>(null);
    const [ponds, setPonds] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [inviteBusy, setInviteBusy] = useState(false);
    const [error, setError] = useState<any>(null);

    const perms = usePermissions(farmId);
    const pondCount = ponds.length;
    const pondNameById = new Map(ponds.map((p) => [p.id, p.name]));

    // The server returns only usable invites (not revoked, expired or spent),
    // newest first, so the head is the live one.
    const activeInvite = invites[0] ?? null;

    const load = useCallback(async () => {
        try {
            const { data } = await farmMembersApi.listMembers(farmId);
            setMembers(data);
            setError(null);
        } catch (e: any) {
            // Do NOT fall through to the empty state. A network or server
            // failure is not "this farm has no members", and telling an owner
            // their roster is empty when it is not is worse than an error.
            setError(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [farmId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    useFocusEffect(
        useCallback(() => {
            pondsApi
                .getAll(farmId)
                .then(({ data }) => setPonds((data as any).data ?? data ?? []))
                .catch(() => setPonds([]));
        }, [farmId]),
    );

    useFocusEffect(
        useCallback(() => {
            if (!perms.canInviteMember) return;
            farmsApi
                .getById(farmId)
                .then(({ data }) => setFarmCode(data.farmCode ?? null))
                .catch(() => setFarmCode(null));
            farmMembersApi
                .listInvites(farmId)
                .then(({ data }) => setInvites(data))
                // Non-fatal: the roster is the point of this screen, and a farm
                // whose invites migration has not run lands here too.
                .catch(() => setInvites([]));
            farmMembersApi
                .listPending(farmId)
                .then(({ data }) => setPending(data))
                // Expected for a manager on a farm whose owner restricted
                // approval to themselves — they simply see no queue.
                .catch(() => setPending([]));
        }, [farmId, perms.canInviteMember]),
    );

    const rotate = useCallback(async () => {
        setInviteBusy(true);
        try {
            // Replaces any live invite rather than accumulating codes nobody is
            // tracking — one credential per farm is what an owner can reason
            // about.
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

    const shareInvite = async (code: string) => {
        try {
            await Share.share({ message: t('members.shareInviteMessage', { code, farm: farmName ?? '' }) });
        } catch {
            // Share sheet dismissed — nothing to report.
        }
    };

    const approve = useCallback(
        async (m: FarmMember) => {
            try {
                await farmMembersApi.approveMember(farmId, m.userId);
                setPending((cur) => cur.filter((p) => p.id !== m.id));
                load();
            } catch (e: any) {
                Alert.alert(t('common.error'), e?.response?.data?.message ?? t('members.approveError'));
            }
        },
        [farmId, load, t],
    );

    const decline = useCallback(
        (m: FarmMember) => {
            Alert.alert(t('members.declineTitle'), t('members.declineConfirm', { name: fullName(m) }), [
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
            ]);
        },
        [farmId, t],
    );

    /** "Expires in 6 days · 1 of 3 used" — the invite's limits at a glance. */
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

    /**
     * The design's second line under each name: what they can actually reach.
     * Owners and managers are responsible for the whole farm and are never
     * pond-scoped, so they always read "all N ponds".
     *
     * An empty `pondIds` means ALL ponds — the same semantics as the backend —
     * so it must not render as "no ponds".
     */
    const scopeLine = (m: FarmMember): string => {
        const unscoped = m.role === 'owner' || m.role === 'manager' || m.pondIds?.length === 0;
        if (unscoped) return pondCount > 0 ? t('members.allPonds', { count: pondCount }) : '';
        return m.pondIds.map((id) => pondNameById.get(id)).filter(Boolean).join(', ');
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={farmName ?? null}
                title={t('members.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                trailing={members.length ? String(members.length) : undefined}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                {perms.canInviteMember && (
                    <View style={styles.codeBand}>
                        <View style={styles.codeMain}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.codeLabel}>{t('members.inviteTitle')}</Text>
                                <Text
                                    style={styles.codeValue}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.6}
                                    accessibilityLabel={activeInvite?.code.split('').join(' ')}
                                >
                                    {activeInvite ? activeInvite.code : '—'}
                                </Text>
                                <Text style={styles.codeHint}>
                                    {activeInvite ? t('members.joinsAsWorker') : t('members.noActiveInvite')}
                                </Text>
                                {!!activeInvite && (
                                    <Text style={styles.codeMeta}>{inviteMeta(activeInvite)}</Text>
                                )}
                            </View>
                            {!!activeInvite && (
                                <View style={styles.qr}>
                                    <QRCode value={activeInvite.code} size={72} />
                                </View>
                            )}
                        </View>

                        <View style={styles.codeActions}>
                            {!!activeInvite && (
                                <TouchableOpacity
                                    style={styles.shareBtn}
                                    onPress={() => shareInvite(activeInvite.code)}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.shareLabel}>{t('members.shareCode')}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.newBtn, inviteBusy && styles.busy]}
                                onPress={rotate}
                                disabled={inviteBusy}
                                accessibilityRole="button"
                            >
                                <Text style={styles.newLabel}>
                                    {activeInvite ? t('members.newCode') : t('members.createInvite')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <SectionHeader label={t('members.onThisFarm')} />
                {!!farmCode && (
                    <View style={styles.farmCodeBlock}>
                        <Text style={styles.farmCodeValue}>{farmCode}</Text>
                        <Text style={styles.farmCodeLine}>{t('members.farmCodeIdentityHint')}</Text>
                    </View>
                )}

                {loading ? null : error ? (
                    <ErrorState
                        icon="account-group-outline"
                        title={t('members.loadErrorTitle')}
                        error={error}
                        onRetry={() => { setLoading(true); load(); }}
                    />
                ) : members.length === 0 ? (
                    <EmptyState
                        icon="account-group-outline"
                        title={t('members.emptyTitle')}
                        subtitle={t('members.emptySub')}
                    />
                ) : (
                    members.map((m) => {
                        const meta = ROLE_META[m.role] ?? ROLE_META.viewer;
                        const scope = scopeLine(m);
                        return (
                            <TouchableOpacity
                                key={m.id}
                                style={styles.member}
                                onPress={() =>
                                    navigation.navigate('MemberDetail', { farmId, farmName, member: m })
                                }
                                accessibilityRole="button"
                            >
                                <Icon name={meta.icon} size={24} color={meta.color} />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.memberName} numberOfLines={1}>
                                        {fullName(m)}
                                    </Text>
                                    {!!scope && (
                                        <Text style={styles.memberScope} numberOfLines={1}>
                                            {scope}
                                        </Text>
                                    )}
                                </View>
                                <Text style={[styles.roleChip, { color: meta.color }]}>
                                    {t(`members.role_${m.role}`).toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })
                )}

                {/*
                  * People who used the code while the farm is on manual
                  * approval. They have NO access until approved; this is the
                  * only place they appear at all.
                  */}
                {pending.length > 0 && (
                    <>
                        <SectionHeader
                            label={t('members.waitingTitle')}
                            trailing={pending.length}
                            trailingColor={c.warningText}
                        />
                        {pending.map((m) => (
                            <View key={m.id} style={styles.pending}>
                                <Text style={styles.memberName}>{fullName(m)}</Text>
                                <Text style={styles.pendingSub}>{t('members.usedYourCode')}</Text>
                                <View style={styles.pendingActions}>
                                    <TouchableOpacity
                                        style={styles.letInBtn}
                                        onPress={() => approve(m)}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.letInLabel}>{t('members.letIn')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.declineBtn}
                                        onPress={() => decline(m)}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.declineLabel}>{t('members.decline')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {perms.canInviteMember && members.length > 0 && (
                    <Text style={styles.footnote}>{t('members.tapToEdit')}</Text>
                )}
            </ScrollView>

            {perms.canInviteMember && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.inviteByBtn}
                        onPress={() => navigation.navigate('AddWorker', { farmId, farmName })}
                        accessibilityRole="button"
                    >
                        <Text style={styles.inviteByLabel}>{t('members.inviteByIdentifier')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[6], backgroundColor: c.surface },

    codeBand: {
        backgroundColor: c.infoBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[4],
    },
    codeMain: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
    codeLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: c.infoText,
    },
    codeValue: {
        fontFamily: 'DMMono-Medium',
        fontSize: 32,
        lineHeight: 40,
        letterSpacing: 2,
        color: c.textPrimary,
    },
    codeHint: { ...theme.typeScale.bodyMedium, color: c.infoText },
    codeMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary, marginTop: 2 },
    qr: { backgroundColor: c.surface, padding: theme.spacing[2], borderRadius: theme.radius.xs },
    codeActions: { flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[3] },
    shareBtn: {
        flex: 1,
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    shareLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
    newBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    newLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.primaryHover },
    busy: { opacity: 0.6 },

    farmCodeBlock: {
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    farmCodeLine: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    farmCodeValue: {
        fontFamily: 'DMMono-Regular',
        fontSize: 15,
        letterSpacing: 1,
        color: c.textSecondary,
    },

    member: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 56,
    },
    memberName: { ...theme.typeScale.h3, color: c.textPrimary },
    memberScope: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    roleChip: { ...theme.typeScale.labelMedium, fontSize: 11, letterSpacing: 0.6 },

    pending: {
        backgroundColor: c.warningBg,
        borderLeftWidth: 3,
        borderLeftColor: c.warningBorder,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.borderDefault,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    pendingSub: { ...theme.typeScale.bodySmall, color: c.warningText },
    pendingActions: { flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[3] },
    letInBtn: {
        flex: 1,
        backgroundColor: c.successText,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    letInLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
    declineBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    declineLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.dangerText },

    footnote: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
    },

    footer: {
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
        backgroundColor: c.surface,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    inviteByBtn: {
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    inviteByLabel: { ...theme.typeScale.labelLarge, fontSize: 16, color: c.textInverse },
});

export default FarmMembersScreen;
