/**
 * AllWorkersScreen — the team roster, across every farm.
 *
 * This used to be a read-only name-and-role list that fanned out one
 * `/farms/:id/members` request per farm from the phone. It now reads the SAME
 * cached `team-overview` the Team tab already holds — one request, already in
 * memory when you arrive from the tab — and answers the question a farmer
 * actually opens it with: who is on shift, who is asking for leave, and who is
 * waiting to be let in.
 *
 * Three things sit on it that were nowhere before:
 *  - your own shift card, pinned above the roster, so a worker has a check-in
 *    control here and not only on the tab;
 *  - approve / decline inline on a pending join, for an owner or manager;
 *  - approve / reject inline on a pending leave request.
 *
 * A worker sees the roster and their own card and no decision buttons. The
 * gate is the BARE ROLE, not a capability: MANAGE_WORKERS stopped being
 * grantable in Phase 1 precisely because every member-management endpoint
 * re-checks owner/manager anyway, and a granted button that 403s is worse than
 * no button.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Icon } from '../../components/ui/Icon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';
import { apiErrorMessage } from '../../api/errors';
import { attendanceApi } from '../../api/attendance';
import { farmMembersApi } from '../../api/farmMembers';
import { leaveRequestsApi } from '../../api/leaveRequests';
import {
    buildRoster,
    canDecideOnTeam,
    fetchTeamOverview,
    type AttendanceState,
    type RosterEntry,
    type RosterSection,
} from '../../api/teamOverview';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';
import { capture, EVENTS } from '../../features/analytics';

/** The roster is always every farm — narrowing it is what the Team tab is for. */
const ALL = 'all';

const ATTENDANCE_TONE: Record<AttendanceState, StatusType> = {
    in: 'safe',
    out: 'idle',
    absent: 'idle',
};

const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' });

const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export const AllWorkersScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const userId = useAuthStore((s) => s.user?.id);
    const grantForFarm = useMembershipStore((s) => s.grantForFarm);
    const memberships = useMembershipStore((s) => s.memberships);
    /** Which row has a request in flight — disables just that row's buttons. */
    const [busyKey, setBusyKey] = useState<string | null>(null);
    /** Optimistically hidden after Check out, until the refetch lands. */
    const [checkedOutId, setCheckedOutId] = useState<string | null>(null);

    // The SAME key the Team tab reads. Arriving from the tab this resolves from
    // cache with no request at all; arriving from Settings it costs the one
    // request the tab would have cost anyway.
    const query = useAppQuery({
        queryKey: qk.team(ALL),
        queryFn: () => fetchTeamOverview(ALL),
    });
    useRefetchOnFocus(qk.team(ALL));

    const overview = query.data;
    const hasData = overview != null;

    const sections = useMemo(
        () => buildRoster(overview, { selfUserId: userId, unknownLabel: t('team.unknownPerson') }),
        [overview, userId, t],
    );

    const rawMyAttendance = overview?.myAttendance ?? null;
    const myAttendance =
        rawMyAttendance && rawMyAttendance.id === checkedOutId ? null : rawMyAttendance;

    /**
     * Approving is a bare-role decision, per farm: an owner of two farms who is
     * a worker on a third must see the buttons on the two and never on the
     * third. `usePermissions` resolves one farm, so this goes to the store.
     */
    const canApprove = useCallback(
        (farmId: string) => canDecideOnTeam(grantForFarm(farmId).role),
        // `grantForFarm` closes over the store lazily, so its identity does not
        // change when the membership list loads — `memberships` is the trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [grantForFarm, memberships],
    );

    /** Every decision on this screen is "call, then re-read the one query". */
    const run = useCallback(
        async (key: string, action: () => Promise<unknown>) => {
            setBusyKey(key);
            try {
                await action();
                // A member approve/decline posts to /farms/..., which the write
                // interceptor maps to the `farm` entity — that does not include
                // ['team'], so this refetch is what keeps the roster honest.
                await query.refetch();
            } catch (e) {
                Alert.alert(t('common.error'), apiErrorMessage(e, t('team.actionError')));
            } finally {
                setBusyKey(null);
            }
        },
        [query, t],
    );

    const myFarmName = myAttendance
        ? sections.find((s) => s.farmId === myAttendance.farmId)?.farmName
        : undefined;

    const checkOut = useCallback(() => {
        if (!myAttendance) return;
        void run(`self-${myAttendance.id}`, async () => {
            await attendanceApi.checkOut(myAttendance.id);
            setCheckedOutId(myAttendance.id);
        });
    }, [myAttendance, run]);

    /**
     * Check in needs ONE farm. The roster spans every farm, so rather than
     * picking one for the farmer — a shift on the wrong payroll — this hands
     * the choice back to the Team tab, which already owns that chooser.
     */
    const goCheckIn = useCallback(
        () => navigation.navigate('MainApp', { screen: 'Team' }),
        [navigation],
    );

    const renderSelfCard = () => (
        <Card style={styles.selfCard}>
            <Icon name="schedule" size={22} color={theme.roles.light.primary} />
            <View style={styles.selfText}>
                <Text style={styles.selfTitle}>
                    {myAttendance ? t('team.youAreIn') : t('team.notCheckedIn')}
                </Text>
                <Text style={styles.selfSub} numberOfLines={1}>
                    {myAttendance
                        ? [myFarmName, t('team.sinceTime', { time: hhmm(myAttendance.checkInAt) })]
                              .filter(Boolean)
                              .join(' · ')
                        : t('team.checkInSub')}
                </Text>
            </View>
            <Button
                title={myAttendance ? t('team.checkOut') : t('team.checkInCta')}
                onPress={myAttendance ? checkOut : goCheckIn}
                disabled={busyKey !== null}
                style={styles.selfBtn}
            />
        </Card>
    );

    const renderSectionHeader = ({ section }: { section: RosterSection }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
                {section.farmName}
            </Text>
            <Text style={styles.sectionCount}>
                {t('members.allFarmMemberCountLabel', { count: section.data.length })}
            </Text>
        </View>
    );

    const renderItem = ({ item }: { item: RosterEntry }) => {
        const decide = canApprove(item.farmId);
        const rowBusy = busyKey === item.key;
        return (
            <View style={styles.row}>
                <View style={styles.rowTop}>
                    <View style={[styles.avatar, item.pendingJoin && styles.avatarPending]}>
                        <Icon
                            name={item.pendingJoin ? 'person_add' : 'groups'}
                            size={20}
                            color={
                                item.pendingJoin
                                    ? theme.roles.light.warningText
                                    : theme.roles.light.primary
                            }
                        />
                    </View>
                    <View style={styles.rowText}>
                        <Text style={styles.name} numberOfLines={1}>
                            {item.isSelf ? t('team.youSuffix', { name: item.name }) : item.name}
                        </Text>
                        <Text style={styles.role} numberOfLines={1}>
                            {t(`members.role_${item.role}`)}
                        </Text>
                    </View>
                    <StatusBadge
                        status={item.pendingJoin ? 'warning' : ATTENDANCE_TONE[item.attendance]}
                        label={
                            item.pendingJoin
                                ? t('team.pendingJoinBadge')
                                : t(`team.att_${item.attendance}`)
                        }
                    />
                </View>

                {/* Waiting to be let in. Owner/manager decide here; everyone
                    else just sees that the person is not in yet. */}
                {item.pendingJoin && decide && (
                    <View style={[styles.actions, styles.indent]}>
                        <Button
                            title={t('members.letIn')}
                            onPress={() =>
                                run(item.key, async () => {
                                    await farmMembersApi.approveMember(item.farmId, item.userId);
                                    // Same funnel step as FarmMembersScreen's
                                    // approve — the other door onto it.
                                    capture(EVENTS.INVITE_ACCEPTED, { role: item.role });
                                })
                            }
                            disabled={rowBusy}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t('members.decline')}
                            variant="outlined"
                            onPress={() =>
                                Alert.alert(
                                    t('members.declineTitle'),
                                    t('members.declineConfirm', { name: item.name }),
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: t('members.decline'),
                                            style: 'destructive',
                                            onPress: () =>
                                                void run(item.key, () =>
                                                    farmMembersApi.declineMember(
                                                        item.farmId,
                                                        item.userId,
                                                    ),
                                                ),
                                        },
                                    ],
                                )
                            }
                            disabled={rowBusy}
                            style={styles.actionBtn}
                        />
                    </View>
                )}

                {/* An open leave request, with the decision on the same row as
                    the person it is about — the queue screen is a second trip. */}
                {item.leave && (
                    <View style={styles.leaveBlock}>
                        <Text style={styles.leaveText} numberOfLines={2}>
                            {t('team.leaveRange', {
                                from: shortDate(item.leave.startDate),
                                to: shortDate(item.leave.endDate),
                            })}
                            {item.leave.reason ? ` · ${item.leave.reason}` : ''}
                        </Text>
                        {decide && (
                            <View style={styles.actions}>
                                <Button
                                    title={t('team.approve')}
                                    onPress={() =>
                                        run(item.key, () => leaveRequestsApi.approve(item.leave!.id))
                                    }
                                    disabled={rowBusy}
                                    style={styles.actionBtn}
                                />
                                <Button
                                    title={t('team.reject')}
                                    variant="outlined"
                                    onPress={() =>
                                        run(item.key, () => leaveRequestsApi.reject(item.leave!.id))
                                    }
                                    disabled={rowBusy}
                                    style={styles.actionBtn}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    if (query.isPending && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <ScreenHeader title={t('team.rosterTitle')} onBack={() => navigation.goBack()} />
                <View style={styles.loadingBlock}>
                    <Skeleton width="100%" height={72} />
                    <Skeleton width="100%" height={64} />
                    <Skeleton width="100%" height={64} />
                    <Skeleton width="100%" height={64} />
                </View>
            </ScreenWrapper>
        );
    }

    // "We could not read your team" is not "you have no team".
    if (query.isError && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <ScreenHeader title={t('team.rosterTitle')} onBack={() => navigation.goBack()} />
                <ErrorState
                    title={t('members.loadErrorTitle')}
                    error={query.error}
                    onRetry={() => query.refetch()}
                />
            </ScreenWrapper>
        );
    }

    const people = sections.reduce((n, s) => n + s.data.length, 0);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('team.rosterPeople', { count: people })}
                title={t('team.rosterTitle')}
                onBack={() => navigation.goBack()}
            />
            <SectionList
                sections={sections}
                keyExtractor={(m) => m.key}
                renderItem={renderItem}
                // One farm and the header is noise — it says what the only
                // group is. From two it is the only thing telling you where a
                // worker actually works.
                renderSectionHeader={sections.length > 1 ? renderSectionHeader : undefined}
                stickySectionHeadersEnabled={false}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={renderSelfCard}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={query.isRefetching}
                        onRefresh={() => query.refetch()}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="account-group-outline"
                        title={t('members.allEmptyTitle')}
                        subtitle={t('members.allEmptySub')}
                    />
                }
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    loadingBlock: { gap: theme.spacing[3], padding: theme.spacing[4] },
    list: { paddingBottom: theme.spacing[8] },

    selfCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        margin: theme.spacing[4],
        marginBottom: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg,
    },
    selfText: { flex: 1, minWidth: 0 },
    selfTitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '700',
    },
    selfSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    selfBtn: { paddingHorizontal: theme.spacing[4] },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        flex: 1,
        minWidth: 0,
    },
    sectionCount: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },

    row: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        gap: theme.spacing[2],
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], minHeight: 48 },
    rowText: { flex: 1, minWidth: 0 },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPending: { backgroundColor: theme.roles.light.warningBg },
    name: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    role: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },

    leaveBlock: { gap: theme.spacing[2], paddingLeft: 52 },
    leaveText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    /** Lines the actions up under the name, past the 40dp avatar + 12dp gap. */
    indent: { paddingLeft: 52 },
    // Wraps, so two long translated labels stack instead of squeezing to
    // nothing at 360dp.
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
    actionBtn: { flexGrow: 1, flexBasis: 120, paddingHorizontal: theme.spacing[4] },
});

export default AllWorkersScreen;
