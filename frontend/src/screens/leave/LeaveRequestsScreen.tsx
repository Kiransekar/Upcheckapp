/**
 * Leave — artboard 3c.
 *
 * The order is the change. The old screen opened on the request form, which is
 * the thing a manager least often wants: they come here to clear a decision
 * somebody is waiting on. So pending approvals sit at the top, the person's own
 * requests below, and the form last — a worker scrolls once to reach it, a
 * manager never has to scroll past it.
 *
 * Approve and Reject are real buttons with words on them, not two coloured
 * circles. Approving someone's leave is a decision with consequences for the
 * roster; a 24dp icon is not a proportionate control for it.
 *
 * Submission still goes through the offline sync queue like every other logged
 * record; approve/reject are direct calls, since a manager deciding is online.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Input } from '../../components/ui/Input';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { leaveRequestsApi, type LeaveRequest, type LeaveRequestStatus } from '../../api/leaveRequests';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';
import { usePermissions } from '../../hooks/usePermissions';
import { todayLocalISODate } from '../../utils/localDate';
import { personName } from '../../utils/personName';

const c = theme.roles.light;

const STATUS_META: Record<LeaveRequestStatus, { color: string; icon: IconName }> = {
    pending: { color: c.warningText, icon: 'schedule' },
    approved: { color: c.successText, icon: 'check_circle' },
    rejected: { color: c.dangerText, icon: 'cancel' },
};

/** Inclusive day count — a one-day leave is 1 day, not 0. */
const dayCount = (start: string, end: string): number => {
    const ms = Date.parse(end) - Date.parse(start);
    if (Number.isNaN(ms) || ms < 0) return 1;
    return Math.round(ms / 86_400_000) + 1;
};

/** Does [start,end] overlap the next seven days? */
const isThisWeek = (r: LeaveRequest): boolean => {
    const now = Date.now();
    const weekEnd = now + 7 * 86_400_000;
    const start = Date.parse(r.startDate);
    const end = Date.parse(r.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return end >= now && start <= weekEnd;
};

export const LeaveRequestsScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};
    const perms = usePermissions(farmId);

    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [pending, setPending] = useState<LeaveRequest[]>([]);
    const [approved, setApproved] = useState<LeaveRequest[]>([]);
    const [members, setMembers] = useState<FarmMember[]>([]);
    const [startDate, setStartDate] = useState(todayLocalISODate());
    const [endDate, setEndDate] = useState(todayLocalISODate());
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await leaveRequestsApi.mine(farmId);
            setMyRequests(data);
        } catch {
            setMyRequests([]);
        }
        if (perms.canManageOperations) {
            const [pendingRes, approvedRes, membersRes] = await Promise.all([
                leaveRequestsApi.getAll(farmId, 'pending').catch(() => ({ data: [] as LeaveRequest[] })),
                leaveRequestsApi.getAll(farmId, 'approved').catch(() => ({ data: [] as LeaveRequest[] })),
                farmMembersApi.listMembers(farmId).catch(() => ({ data: [] as FarmMember[] })),
            ]);
            setPending(pendingRes.data);
            setApproved(approvedRes.data);
            setMembers(membersRes.data);
        }
    }, [farmId, perms.canManageOperations]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const nameFor = useMemo(() => {
        const byUser = new Map(members.map((m) => [m.userId, m.user]));
        // The request carries its own requester now; the roster is only a
        // fallback for a member whose relation failed to load. Neither path
        // ends at a uuid — see utils/personName.
        return (r: LeaveRequest) =>
            personName(r.user ?? byUser.get(r.userId), t('leave.unknownPerson'));
    }, [members, t]);

    /** Who is away in the next week — the context a manager needs to decide. */
    const awayThisWeek = useMemo(() => approved.filter(isThisWeek), [approved]);

    const submit = async () => {
        if (endDate < startDate) {
            Alert.alert(t('common.error'), t('leave.errorDateRange'));
            return;
        }
        setSubmitting(true);
        try {
            const res = await saveRecord({
                entity: 'leave_request',
                endpoint: '/leave-requests',
                payload: { farmId, startDate, endDate, reason: reason.trim() || undefined },
            });
            Alert.alert(
                t('leave.submittedTitle'),
                res.queued ? t('common.savedOffline', 'Saved — will sync when online') : t('leave.submittedSub'),
            );
            setReason('');
            load();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('leave.submitError'));
        } finally {
            setSubmitting(false);
        }
    };

    const decide = async (request: LeaveRequest, approve: boolean) => {
        try {
            if (approve) await leaveRequestsApi.approve(request.id);
            else await leaveRequestsApi.reject(request.id);
            load();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('leave.decideError'));
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={farmName ?? null}
                title={t('leave.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {perms.canManageOperations && (
                    <>
                        <SectionHeader
                            label={t('leave.pendingTitle')}
                            trailing={pending.length || undefined}
                            trailingColor={c.warningText}
                        />
                        {pending.length === 0 ? (
                            <Text style={styles.empty}>{t('leave.pendingEmpty')}</Text>
                        ) : (
                            pending.map((r) => (
                                <View key={r.id} style={styles.pendingCard}>
                                    <Text style={styles.pendingName} numberOfLines={1}>
                                        {nameFor(r)}
                                    </Text>
                                    <Text style={styles.pendingRange}>
                                        {t('leave.dateRange', { start: r.startDate, end: r.endDate })}
                                    </Text>
                                    <Text style={styles.pendingMeta} numberOfLines={2}>
                                        {[
                                            t('leave.dayCount', { count: dayCount(r.startDate, r.endDate) }),
                                            r.reason,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                    <View style={styles.decideRow}>
                                        <TouchableOpacity
                                            style={styles.approveBtn}
                                            onPress={() => decide(r, true)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('leave.approve')}
                                        >
                                            <Text style={styles.approveLabel}>{t('leave.approve')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rejectBtn}
                                            onPress={() => decide(r, false)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('leave.reject')}
                                        >
                                            <Text style={styles.rejectLabel}>{t('leave.reject')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                )}

                <SectionHeader label={t('leave.myRequestsTitle')} />
                {myRequests.length === 0 ? (
                    <Text style={styles.empty}>{t('leave.myRequestsEmpty')}</Text>
                ) : (
                    myRequests.map((r) => {
                        const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                        return (
                            <View key={r.id} style={styles.row}>
                                <Icon name={meta.icon} size={22} color={meta.color} />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>
                                        {t('leave.dateRange', { start: r.startDate, end: r.endDate })}
                                    </Text>
                                    <Text style={styles.rowSub} numberOfLines={1}>
                                        {r.reason || t('leave.noReason')}
                                    </Text>
                                </View>
                                <Text style={[styles.rowStatus, { color: meta.color }]}>
                                    {t(`leave.status_${r.status}`)}
                                </Text>
                            </View>
                        );
                    })
                )}

                {/*
                  * Who else is away, so a manager is not approving the third
                  * person off during harvest week without knowing it. Managers
                  * only — a worker cannot read anyone else's requests.
                  */}
                {perms.canManageOperations && (
                    <Text style={styles.footnote}>
                        {awayThisWeek.length === 0
                            ? t('leave.nobodyAway')
                            : t('leave.awayThisWeek', {
                                  names: awayThisWeek.map((r) => nameFor(r)).join(', '),
                              })}
                    </Text>
                )}

                <SectionHeader label={t('leave.requestFormTitle')} />
                <View style={styles.form}>
                    <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                            <Input
                                label={t('leave.startDateLabel')}
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Input
                                label={t('leave.endDateLabel')}
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </View>
                    </View>
                    <Input
                        label={t('leave.reasonLabel')}
                        value={reason}
                        onChangeText={setReason}
                        placeholder={t('leave.reasonPlaceholder')}
                    />
                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && styles.submitBusy]}
                        onPress={submit}
                        disabled={submitting}
                        accessibilityRole="button"
                    >
                        <Text style={styles.submitLabel}>{t('leave.submitCta')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    pendingCard: {
        backgroundColor: c.warningBg,
        borderLeftWidth: 3,
        borderLeftColor: c.warningBorder,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.borderDefault,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        gap: 2,
    },
    pendingName: { ...theme.typeScale.h3, color: c.textPrimary },
    pendingRange: { fontFamily: 'DMMono-Regular', fontSize: 14, color: c.textPrimary },
    pendingMeta: { ...theme.typeScale.bodySmall, color: c.warningText },
    decideRow: { flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[3] },
    approveBtn: {
        flex: 1,
        backgroundColor: c.successText,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    approveLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
    rejectBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    rejectLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.dangerText },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 44,
    },
    rowTitle: { fontFamily: 'DMMono-Regular', fontSize: 14, color: c.textPrimary },
    rowSub: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    rowStatus: { ...theme.typeScale.labelMedium },

    footnote: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
    },
    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
    },

    form: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[1] },
    dateRow: { flexDirection: 'row', gap: theme.spacing[3] },
    submitBtn: {
        marginTop: theme.spacing[2],
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    submitBusy: { opacity: 0.6 },
    submitLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
});

export default LeaveRequestsScreen;
