/**
 * TeamScreen — the "Team" tab of the redesigned owner/manager navigation.
 *
 * Built to frontend/design/team.png. It pulls the three team-shaped things that
 * were previously scattered behind the "More" menu into one place, in the order
 * the design puts them:
 *
 *   1. Your own attendance, with a single Check out action — the thing you act
 *      on first, so it sits above everything.
 *   2. Attendance and Leave as summary rows with counts, tappable through to
 *      the full screens.
 *   3. Today's team tasks, per-person tallies first, then the tasks themselves.
 *
 * Note the split with Home: Home shows YOUR tasks, Team shows the WHOLE team's.
 * Both read the same tasks API; the difference is the assignee filter.
 *
 * Like Money and Today, it opens on EVERY farm at once. It used to read the
 * app-wide active farm and show only that one, with no way to switch and no
 * total — so an owner with three farms had to visit three Team tabs and add up
 * the rosters by hand to answer "who is working today". The scope chips narrow
 * it; the farm name on each row says where the work is.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';
import { roleCan, type FarmCapability } from '../../permissions/capabilities';
import { saveRecord } from '../../sync/recordSync';
import { apiErrorMessage } from '../../api/errors';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { leaveRequestsApi, type LeaveRequest } from '../../api/leaveRequests';
import { tasksApi, type Task } from '../../api/tasks';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';
import { farmsApi, type Farm } from '../../api/farms';
import { fetchTeamOverview } from '../../api/teamOverview';
import { personName } from '../../utils/personName';
import { formatWeekday } from '../../utils/formatDate';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';

/** Scope value meaning "every farm I can see". */
const ALL = 'all';

// Stable empty fallbacks — a fresh `[]` each render would break the memos below.
const EMPTY_FARMS: Farm[] = [];
const EMPTY_ATTENDANCE: AttendanceRecord[] = [];
const EMPTY_LEAVE: LeaveRequest[] = [];
const EMPTY_TASKS: Task[] = [];
const EMPTY_MEMBERS: FarmMember[] = [];

/** Tasks the design treats as "still to do" for the per-person tallies. */
const OPEN_STATUSES = ['open', 'in_progress'];

/**
 * The four actions on this tab that need ONE farm while the tab is showing
 * every farm's work, and the capability each one needs on that farm.
 *
 * This screen used to hand them `farms[0]` — an arbitrary farm the farmer
 * never chose. Opening the roster of the wrong farm is merely confusing;
 * checking in on the wrong farm puts a shift on the wrong payroll. So when
 * more than one farm qualifies, the farmer picks.
 */
type TeamAction = 'members' | 'attendance' | 'assign' | 'checkin';

const ACTION_CAPABILITY: Record<TeamAction, FarmCapability> = {
    members: 'MANAGE_WORKERS',
    assign: 'MANAGE_WORKERS',
    attendance: 'WRITE_OPERATIONAL',
    checkin: 'WRITE_OPERATIONAL',
};

/** "6h 27m" — how long the current check-in has been running. */
const elapsedSince = (iso: string): string => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    const h = Math.floor(mins / 60);
    return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
};

const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const memberName = (m?: FarmMember) => personName(m?.user, "");

/**
 * Task status → StatusBadge tone. A bordered pill reads at arm's length in
 * sun far better than the coloured uppercase text this used to be, and the
 * word is still there — colour is never the only signal.
 */
const STATUS_TONE: Record<string, StatusType> = {
    open: 'idle',
    in_progress: 'info',
    done: 'warning',
    verified: 'safe',
};

export const TeamScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { selectedFarm, setSelectedFarm } = useActiveFarmStore();
    const userId = useAuthStore((s) => s.user?.id);

    /** `ALL` means every farm — the tab's default, same as Money and Today. */
    const [scope, setScope] = useState<string>(ALL);
    const [showAllTasks, setShowAllTasks] = useState(false);
    /** Optimistically hidden after Check out, until the refetch lands. */
    const [checkedOutId, setCheckedOutId] = useState<string | null>(null);
    /** Which farm-needing action the chooser is currently open for. */
    const [chooserFor, setChooserFor] = useState<TeamAction | null>(null);
    const [busy, setBusy] = useState(false);

    /**
     * One cached read for the tab, keyed on scope. Memory-only rather than
     * persisted: rosters and tasks change hour to hour and are not what a
     * farmer opens the app with no signal to see (see src/query/client.ts).
     */
    const query = useAppQuery({
        queryKey: qk.team(scope),
        // ONE request for the whole tab. This used to fan out to 1 + 5×N calls
        // (26 for a five-farm owner) from the phone, and at ~265ms of network
        // per request from rural India that fan-out WAS the load time. The
        // server does the same work far more cheaply — see api/teamOverview.ts.
        queryFn: () => fetchTeamOverview(scope),
    });

    useRefetchOnFocus(qk.team(scope));

    const farms = query.data?.farms ?? EMPTY_FARMS;
    const rawMyAttendance = query.data?.myAttendance ?? null;
    const myAttendance = rawMyAttendance && rawMyAttendance.id === checkedOutId ? null : rawMyAttendance;
    const allAttendance = query.data?.allAttendance ?? EMPTY_ATTENDANCE;
    const pendingLeave = query.data?.pendingLeave ?? EMPTY_LEAVE;
    const tasks = query.data?.tasks ?? EMPTY_TASKS;
    const members = query.data?.members ?? EMPTY_MEMBERS;
    const hasData = query.data != null;

    const activeScope = scope !== ALL && farms.some((f) => f.id === scope) ? scope : ALL;
    const scopeFarms = useMemo(
        () => (activeScope === ALL ? farms : farms.filter((f) => f.id === activeScope)),
        [activeScope, farms],
    );

    // The farm this screen is *about* — the eyebrow, and the fallback target
    // for rows that legitimately span every farm. It is NOT the farm an action
    // silently runs against any more; see `startAction`.
    const primaryFarm =
        scopeFarms.find((f) => f.id === activeScope) ??
        farms.find((f) => f.id === selectedFarm?.id) ??
        farms[0];
    const farmId = primaryFarm?.id;
    const farmName = (id: string) => farms.find((f) => f.id === id)?.name;

    // Capabilities per farm rather than for one farm. An owner of three farms
    // who is a viewer on the fourth must see the actions (they can act on
    // three) but must never be offered the fourth in the chooser.
    //
    // usePermissions resolves ONE farm and cannot be called in a loop, so this
    // goes to the same `roleCan` it calls.
    const roleForFarm = useMembershipStore((s) => s.roleForFarm);
    const memberships = useMembershipStore((s) => s.memberships);
    const farmsWith = useCallback(
        // `memberships` is in the deps because `roleForFarm` closes over the
        // store lazily — its identity does not change when the list loads.
        (cap: FarmCapability) => scopeFarms.filter((f) => roleCan(roleForFarm(f.id), cap)),
        [scopeFarms, roleForFarm, memberships],
    );

    const canManage = farmsWith('MANAGE_WORKERS').length > 0;
    const canRecordData = farmsWith('WRITE_OPERATIONAL').length > 0;

    const checkIn = useCallback(
        async (id: string) => {
            setBusy(true);
            try {
                // Through the sync queue, exactly like AttendanceScreen: a
                // check-in is a field log and the farmer may have no signal.
                const res = await saveRecord({
                    entity: 'attendance',
                    endpoint: '/attendance/check-in',
                    payload: { farmId: id },
                });
                Alert.alert(
                    t('attendance.checkedInTitle'),
                    res.queued ? t('team.savedOffline') : t('attendance.checkedInSub'),
                );
                void query.refetch();
            } catch (e) {
                Alert.alert(t('common.error'), apiErrorMessage(e, t('attendance.checkInError')));
            } finally {
                setBusy(false);
            }
        },
        [query, t],
    );

    const runAction = useCallback(
        (action: TeamAction, farm: Farm) => {
            switch (action) {
                case 'members':
                    navigation.navigate('FarmMembers', { farmId: farm.id, farmName: farm.name });
                    break;
                case 'attendance':
                    navigation.navigate('Attendance', { farmId: farm.id, farmName: farm.name });
                    break;
                case 'assign':
                    navigation.navigate('TaskList', { farmId: farm.id, farmName: farm.name });
                    break;
                case 'checkin':
                    void checkIn(farm.id);
                    break;
            }
        },
        [navigation, checkIn],
    );

    /** One eligible farm: just do it. More than one: ask. */
    const startAction = useCallback(
        (action: TeamAction) => {
            const eligible = farmsWith(ACTION_CAPABILITY[action]);
            if (eligible.length === 1) runAction(action, eligible[0]);
            else if (eligible.length > 1) setChooserFor(action);
        },
        [farmsWith, runAction],
    );

    const chooserFarms = chooserFor ? farmsWith(ACTION_CAPABILITY[chooserFor]) : EMPTY_FARMS;

    const checkOut = useCallback(async () => {
        if (!myAttendance) return;
        try {
            await attendanceApi.checkOut(myAttendance.id);
            setCheckedOutId(myAttendance.id);
            void query.refetch();
        } catch {
            // Non-fatal; the attendance screen shows the authoritative state.
        }
    }, [myAttendance, query]);

    if (query.isPending && !hasData) {
        return (
            <ScreenWrapper>
                <View style={styles.loadingBlock}>
                    <Skeleton width="100%" height={72} />
                    <Skeleton width="100%" height={64} />
                    <Skeleton width="100%" height={64} />
                </View>
            </ScreenWrapper>
        );
    }

    // "We could not read your team" is not "you have no farm" — this screen
    // used to fall through to the empty state on a failed read and tell a
    // manager with a full roster that they had no farm.
    if (query.isError && !hasData) {
        return (
            <ScreenWrapper>
                <ErrorState title={t('team.title')} error={query.error} onRetry={() => query.refetch()} />
            </ScreenWrapper>
        );
    }

    if (!farmId) {
        return (
            <ScreenWrapper>
                <EmptyState
                    icon="account-group-outline"
                    title={t('team.noFarmTitle')}
                    subtitle={t('team.noFarmSub')}
                />
            </ScreenWrapper>
        );
    }

    const checkedInToday = allAttendance.filter((r) => !r.checkOutAt).length;
    // Deduped by person: someone who works two of your farms is one member of
    // your team, and counting them twice would make "2 of 4" out of two people.
    const activeMembers = members
        .filter((m) => m.status !== 'pending')
        .filter((m, i, all) => all.findIndex((x) => x.userId === m.userId) === i);
    const openTasks = tasks.filter((tk) => OPEN_STATUSES.includes(tk.status));
    const overdue = openTasks.filter(
        (tk) => tk.dueDate && new Date(tk.dueDate).getTime() < Date.now(),
    ).length;
    const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 5);

    /** "Ravi 1/3" — done vs assigned, per person, for today. */
    const tallies = activeMembers
        .map((m) => {
            const assigned = tasks.filter((tk) => tk.assignedToId === m.userId);
            if (assigned.length === 0) return null;
            const done = assigned.filter((tk) => !OPEN_STATUSES.includes(tk.status)).length;
            return { name: memberName(m).split(' ')[0], done, total: assigned.length };
        })
        .filter(Boolean) as { name: string; done: number; total: number }[];

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow} numberOfLines={1}>
                        {[
                            activeScope === ALL ? t('team.allFarms') : primaryFarm?.name,
                            formatWeekday(new Date()),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                    <Text style={styles.title}>{t('team.title')}</Text>
                </View>
                {/* The roster is the thing this opens, so it says so — and it
                    is a real 48dp button, not a text link that nobody on a
                    low-end screen in sun reads as tappable. */}
                {canManage && (
                    <Button
                        title={t('team.manageTeam')}
                        variant="outlined"
                        onPress={() => startAction('members')}
                        style={styles.manageBtn}
                    />
                )}
            </View>

            <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />

            {/* Scope chips, like Money. With a single farm "All farms" and its
                name are the same view under two labels, so they only appear
                from two. ChipGroup wraps rather than scrolling: a chip a
                farmer cannot see is a filter they will not find. */}
            {farms.length > 1 && (
                <View style={styles.chips}>
                    <ChipGroup
                        options={[
                            { value: ALL, label: t('team.allFarms') },
                            ...farms.map((f) => ({ value: f.id, label: f.name })),
                        ]}
                        value={activeScope}
                        // ChipGroup deselects on a second tap of the active
                        // chip; "no scope" means every farm here.
                        onChange={(next: string | null) => {
                            const value = next ?? ALL;
                            setScope(value);
                            // Keep the app-wide active farm in step, so the
                            // roster and leave screens open on the same one.
                            const farm = farms.find((f) => f.id === value);
                            if (farm) setSelectedFarm({ id: farm.id, name: farm.name });
                        }}
                    />
                </View>
            )}

            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={
                    <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
                }
            >
                {/* Your own shift — the one thing on this screen you act on.
                    The card used to appear only once you were ALREADY checked
                    in, so the check-in itself had no control anywhere on the
                    tab and a worker had no route to one. */}
                {canRecordData && (myAttendance ? (
                    <Card style={styles.checkInCard}>
                        <Icon name="schedule" size={22} color={theme.roles.light.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.checkInTitle}>
                                {t('team.checkedInAt', { time: hhmm(myAttendance.checkInAt) })}
                            </Text>
                            <Text style={styles.checkInSub}>
                                {t('team.stillCheckedIn', { elapsed: elapsedSince(myAttendance.checkInAt) })}
                            </Text>
                        </View>
                        <Button title={t('team.checkOut')} onPress={checkOut} style={styles.checkOutBtn} />
                    </Card>
                ) : (
                    <Card style={styles.checkInCard}>
                        <Icon name="schedule" size={22} color={theme.roles.light.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.checkInTitle}>{t('team.notCheckedIn')}</Text>
                            <Text style={styles.checkInSub}>{t('team.checkInSub')}</Text>
                        </View>
                        <Button
                            title={t('team.checkInCta')}
                            onPress={() => startAction('checkin')}
                            disabled={busy}
                            style={styles.checkOutBtn}
                        />
                    </Card>
                ))}

                {/* Visible to everyone who can record data, not just managers.
                    Behind `canManageMembers` these two rows were a worker's
                    ONLY route to attendance and leave, and it was closed. */}
                {canRecordData && (
                    <>
                        <SummaryRow
                            icon="groups"
                            title={t('team.attendance')}
                            subtitle={
                                canManage
                                    ? t('team.checkedInCount', {
                                          count: checkedInToday,
                                          total: activeMembers.length,
                                      })
                                    : myAttendance
                                      ? t('team.yourAttendanceIn', {
                                            elapsed: elapsedSince(myAttendance.checkInAt),
                                        })
                                      : t('team.notCheckedIn')
                            }
                            value={canManage ? String(checkedInToday) : null}
                            unit={canManage ? `/${activeMembers.length}` : null}
                            onPress={() => startAction('attendance')}
                        />

                        <SummaryRow
                            icon="event_busy"
                            title={t('team.leave')}
                            subtitle={
                                !canManage
                                    ? t('team.leaveSelfSub')
                                    : pendingLeave.length > 0
                                      ? t('team.leaveWaiting', { count: pendingLeave.length })
                                      : t('team.leaveNone')
                            }
                            value={canManage && pendingLeave.length > 0 ? String(pendingLeave.length) : null}
                            tone={canManage && pendingLeave.length > 0 ? 'warning' : 'default'}
                            divider="strong"
                            // Leave legitimately spans farms — reviewing does
                            // not need one, and the screen picks a farm for the
                            // request form itself. This row is the reference the
                            // other three now follow.
                            onPress={() =>
                                navigation.navigate('LeaveRequests', {
                                    farmId: activeScope === ALL ? undefined : farmId,
                                    farmName: activeScope === ALL ? undefined : primaryFarm?.name,
                                })
                            }
                        />
                    </>
                )}

                <SectionHeader
                    label={t('team.tasksToday')}
                    actionLabel={canManage ? t('team.assign') : undefined}
                    onAction={() => startAction('assign')}
                />

                {tallies.length > 0 && (
                    <View style={styles.tallyRow}>
                        {tallies.map((x) => (
                            <Text key={x.name} style={styles.tally}>
                                {x.name} <Text style={styles.tallyNum}>{x.done}/{x.total}</Text>
                            </Text>
                        ))}
                        <View style={{ flex: 1 }} />
                        {overdue > 0 && (
                            <Text style={styles.overdue}>{t('team.overdueCount', { count: overdue })}</Text>
                        )}
                    </View>
                )}

                {tasks.length === 0 ? (
                    <EmptyState
                        icon="clipboard-check-outline"
                        title={t('team.noTasksTitle')}
                        subtitle={t('team.noTasksSub')}
                    />
                ) : (
                    visibleTasks.map((tk) => {
                        const assignee = activeMembers.find((m) => m.userId === tk.assignedToId);
                        const isOverdue =
                            !!tk.dueDate &&
                            OPEN_STATUSES.includes(tk.status) &&
                            new Date(tk.dueDate).getTime() < Date.now();
                        return (
                            <TouchableOpacity
                                key={tk.id}
                                style={styles.taskRow}
                                accessibilityRole="button"
                                accessibilityLabel={`${tk.title} · ${t(`team.status_${tk.status}`, tk.status)}`}
                                onPress={() => navigation.navigate('TaskList', { farmId: tk.farmId, farmName: farmName(tk.farmId) })}
                            >
                                <View
                                    style={[
                                        styles.taskBar,
                                        { backgroundColor: isOverdue ? theme.roles.light.dangerBorder : theme.roles.light.borderDefault },
                                    ]}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.taskTitle} numberOfLines={1}>{tk.title}</Text>
                                    <Text
                                        style={[styles.taskMeta, isOverdue && { color: theme.roles.light.dangerText }]}
                                        numberOfLines={1}
                                    >
                                        {[
                                            memberName(assignee),
                                            activeScope === ALL ? farmName(tk.farmId) : null,
                                            tk.dueDate ? hhmm(tk.dueDate) : null,
                                            isOverdue ? t('team.overdue') : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                </View>
                                <StatusBadge
                                    status={STATUS_TONE[tk.status] ?? 'idle'}
                                    label={t(`team.status_${tk.status}`, tk.status)}
                                />
                            </TouchableOpacity>
                        );
                    })
                )}

                {!showAllTasks && tasks.length > 5 && (
                    <Button
                        title={t('team.showMoreTasks', { count: tasks.length - 5 })}
                        variant="text"
                        onPress={() => setShowAllTasks(true)}
                        style={styles.showMore}
                    />
                )}
            </ScrollView>

            {/* Which farm? Only the ones the farmer can actually do this on. */}
            <Modal
                visible={chooserFor !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setChooserFor(null)}
            >
                <Pressable style={styles.backdrop} onPress={() => setChooserFor(null)}>
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <Card style={styles.sheet}>
                            <Text style={styles.sheetTitle}>{t('team.chooseFarmTitle')}</Text>
                            {chooserFarms.map((f) => (
                                <TouchableOpacity
                                    key={f.id}
                                    testID={`farm-choice-${f.id}`}
                                    style={styles.farmRow}
                                    accessibilityRole="button"
                                    accessibilityLabel={f.name}
                                    onPress={() => {
                                        const action = chooserFor;
                                        setChooserFor(null);
                                        if (action) runAction(action, f);
                                    }}
                                >
                                    <Text style={styles.farmRowLabel} numberOfLines={1}>{f.name}</Text>
                                    <Icon
                                        name="chevron_right"
                                        size={20}
                                        color={theme.roles.light.textSecondary}
                                    />
                                </TouchableOpacity>
                            ))}
                        </Card>
                    </Pressable>
                </Pressable>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    loadingBlock: { gap: theme.spacing[3], padding: theme.spacing[4] },
    chips: {
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    header: {
        flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[2], paddingBottom: theme.spacing[3],
        borderBottomWidth: 1, borderBottomColor: theme.roles.light.textPrimary,
    },
    eyebrow: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
        letterSpacing: 1.2, fontWeight: '600',
    },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    // Sized to its label rather than to the header, so a long translation
    // shrinks the button instead of squeezing the screen title off the row.
    manageBtn: { flexShrink: 1, maxWidth: '52%', paddingHorizontal: theme.spacing[4] },
    body: { paddingBottom: theme.spacing[8] },

    checkInCard: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        padding: theme.spacing[4], margin: theme.spacing[4], marginBottom: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg,
    },
    checkInTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '700' },
    checkInSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    checkOutBtn: { paddingHorizontal: theme.spacing[4] },

    tallyRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4],
        paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[2], flexWrap: 'wrap',
    },
    tally: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    tallyNum: { fontWeight: '700', color: theme.roles.light.textPrimary },
    overdue: { ...theme.typeScale.bodyMedium, color: theme.roles.light.dangerText, fontWeight: '600' },

    taskRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        paddingVertical: theme.spacing[3], paddingRight: theme.spacing[5],
        borderTopWidth: 1, borderTopColor: theme.roles.light.surfaceVariant,
        minHeight: 56,
    },
    taskBar: { width: 4, height: 40, borderRadius: 2 },
    taskTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    taskMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    showMore: { alignSelf: 'flex-start', marginHorizontal: theme.spacing[4], marginTop: theme.spacing[2] },

    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', padding: theme.spacing[5],
    },
    sheet: { padding: theme.spacing[4], gap: theme.spacing[1] },
    sheetTitle: {
        ...theme.typeScale.h3, color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[2],
    },
    farmRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        paddingVertical: theme.spacing[3], minHeight: 48,
        borderTopWidth: 1, borderTopColor: theme.roles.light.surfaceVariant,
    },
    farmRowLabel: {
        ...theme.typeScale.bodyLarge, flex: 1, minWidth: 0,
        color: theme.roles.light.textPrimary, fontWeight: '600',
    },
});

export default TeamScreen;
