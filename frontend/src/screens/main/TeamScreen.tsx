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
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { leaveRequestsApi, type LeaveRequest } from '../../api/leaveRequests';
import { tasksApi, type Task } from '../../api/tasks';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';
import { farmsApi, type Farm } from '../../api/farms';
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

/** "6h 27m" — how long the current check-in has been running. */
const elapsedSince = (iso: string): string => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    const h = Math.floor(mins / 60);
    return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
};

const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const memberName = (m?: FarmMember) => personName(m?.user, "");

/** Status pill colour — the design uses colour AND the word, never colour alone. */
const STATUS_COLOR: Record<string, string> = {
    open: theme.roles.light.textTertiary,
    in_progress: theme.roles.light.primary,
    done: theme.roles.light.warningText,
    verified: theme.roles.light.successText,
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

    /**
     * One cached read for the tab, keyed on scope. Memory-only rather than
     * persisted: rosters and tasks change hour to hour and are not what a
     * farmer opens the app with no signal to see (see src/query/client.ts).
     */
    const query = useAppQuery({
        queryKey: qk.team(scope),
        queryFn: async () => {
            const list = (await farmsApi.getAll()).data ?? [];
            const inScope =
                scope !== ALL && list.some((f) => f.id === scope)
                    ? list.filter((f) => f.id === scope)
                    : list;

            // Independent reads — fan out rather than waterfall. Each failure is
            // isolated so one unavailable farm cannot blank the whole tab.
            const per = await Promise.all(
                inScope.map(async (farm) => {
                    const [mine, all, leave, taskList, memberList] = await Promise.allSettled([
                        attendanceApi.mine(farm.id),
                        attendanceApi.getAll(farm.id), // the API decides; a 403 lands in the catch
                        leaveRequestsApi.getAll(farm.id, 'pending'),
                        tasksApi.getAll(farm.id),
                        farmMembersApi.listMembers(farm.id),
                    ]);
                    const val = <T,>(r: PromiseSettledResult<{ data: T }>, fallback: T): T =>
                        r.status === 'fulfilled' ? r.value.data : fallback;
                    return {
                        mine: val(mine, [] as AttendanceRecord[]),
                        all: val(all, [] as AttendanceRecord[]),
                        leave: val(leave, [] as LeaveRequest[]),
                        tasks: val(taskList, [] as Task[]),
                        members: val(memberList, [] as FarmMember[]),
                    };
                }),
            );

            return {
                farms: list,
                // The open record is the one with no check-out. Across farms you can
                // only be checked in to one at a time in practice, and if you are in
                // two the earliest is the one you have been on longest.
                myAttendance:
                    per
                        .flatMap((p) => p.mine)
                        .filter((r) => !r.checkOutAt)
                        .sort((a, b) => a.checkInAt.localeCompare(b.checkInAt))[0] ?? null,
                allAttendance: per.flatMap((p) => p.all),
                pendingLeave: per.flatMap((p) => p.leave),
                tasks: per.flatMap((p) => p.tasks),
                members: per.flatMap((p) => p.members),
            };
        },
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

    // Inviting, assigning and opening the roster all need ONE farm even while
    // showing every farm's work. The active farm is the farmer's own answer to
    // "which one"; the scoped farm wins when they have narrowed it.
    const primaryFarm =
        scopeFarms.find((f) => f.id === activeScope) ??
        farms.find((f) => f.id === selectedFarm?.id) ??
        farms[0];
    const farmId = primaryFarm?.id;
    const perms = usePermissions(farmId);
    const farmName = (id: string) => farms.find((f) => f.id === id)?.name;

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
                {perms.canInviteMember && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('FarmMembers', { farmId, farmName: primaryFarm?.name })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.headerAction}>{t('team.addWorker')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />

            {/* Scope chips, like Money. The header's one text-link slot is
                already "Add worker", and with a single farm "All farms" and
                its name are the same view under two labels. */}
            {farms.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    <Chip
                        label={t('team.allFarms')}
                        active={activeScope === ALL}
                        onPress={() => setScope(ALL)}
                    />
                    {farms.map((f) => (
                        <Chip
                            key={f.id}
                            label={f.name}
                            active={activeScope === f.id}
                            onPress={() => {
                                setScope(f.id);
                                // Keep the app-wide active farm in step, so the
                                // roster and leave screens open on the same one.
                                setSelectedFarm({ id: f.id, name: f.name });
                            }}
                        />
                    ))}
                </ScrollView>
            )}

            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={
                    <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
                }
            >
                {/* Your own check-in — the one thing on this screen you act on. */}
                {myAttendance && (
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
                )}

                {perms.canManageMembers && (
                    <>
                        <TouchableOpacity
                            style={styles.summaryRow}
                            onPress={() => navigation.navigate('Attendance', { farmId })}
                        >
                            <Icon name="groups" size={24} color={theme.roles.light.textSecondary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.summaryTitle}>{t('team.attendance')}</Text>
                                <Text style={styles.summarySub}>
                                    {t('team.checkedInCount', { count: checkedInToday, total: activeMembers.length })}
                                </Text>
                            </View>
                            <Text style={styles.summaryCount}>
                                {checkedInToday}
                                <Text style={styles.summaryCountTotal}>/{activeMembers.length}</Text>
                            </Text>
                            <Icon name="chevron_right" size={22} color={theme.roles.light.textTertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.summaryRow, pendingLeave.length > 0 && styles.summaryRowAlert]}
                            onPress={() =>
                                navigation.navigate('LeaveRequests', {
                                    farmId: activeScope === ALL ? undefined : farmId,
                                    farmName: activeScope === ALL ? undefined : primaryFarm?.name,
                                })
                            }
                        >
                            <Icon
                                name="event_busy"
                                size={24}
                                color={pendingLeave.length > 0 ? theme.roles.light.warningText : theme.roles.light.textSecondary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.summaryTitle}>{t('team.leave')}</Text>
                                <Text style={styles.summarySub}>
                                    {pendingLeave.length > 0
                                        ? t('team.leaveWaiting', { count: pendingLeave.length })
                                        : t('team.leaveNone')}
                                </Text>
                            </View>
                            {pendingLeave.length > 0 && (
                                <Text style={[styles.summaryCount, { color: theme.roles.light.warningText }]}>
                                    {pendingLeave.length}
                                </Text>
                            )}
                            <Icon name="chevron_right" size={22} color={theme.roles.light.textTertiary} />
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>{t('team.tasksToday')}</Text>
                    <View style={styles.sectionRule} />
                    {perms.canManageMembers && (
                        <TouchableOpacity onPress={() => navigation.navigate('TaskList', { farmId, farmName: primaryFarm?.name })}>
                            <Text style={styles.headerAction}>{t('team.assign')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

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
                                <Text style={[styles.taskStatus, { color: STATUS_COLOR[tk.status] ?? theme.roles.light.textTertiary }]}>
                                    {t(`team.status_${tk.status}`, tk.status)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })
                )}

                {!showAllTasks && tasks.length > 5 && (
                    <TouchableOpacity onPress={() => setShowAllTasks(true)} style={styles.showMore}>
                        <Text style={styles.headerAction}>
                            {t('team.showMoreTasks', { count: tasks.length - 5 })}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({
    label,
    active,
    onPress,
}) => (
    <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    loadingBlock: { gap: theme.spacing[3], padding: theme.spacing[4] },
    chips: {
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    chip: {
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        justifyContent: 'center',
        minHeight: 36,
    },
    chipActive: { borderColor: theme.roles.light.borderStrong, backgroundColor: theme.roles.light.surfaceVariant },
    chipLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
    chipLabelActive: { color: theme.roles.light.textPrimary },
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
    headerAction: { ...theme.typeScale.bodyMedium, color: theme.roles.light.primary, fontWeight: '600' },
    body: { paddingBottom: theme.spacing[8] },

    checkInCard: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        padding: theme.spacing[4], margin: theme.spacing[4], marginBottom: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg,
    },
    checkInTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '700' },
    checkInSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    checkOutBtn: { paddingHorizontal: theme.spacing[4] },

    summaryRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        paddingVertical: theme.spacing[4], paddingHorizontal: theme.spacing[4],
        borderTopWidth: 1, borderTopColor: theme.roles.light.borderDefault,
    },
    summaryRowAlert: { backgroundColor: theme.roles.light.warningBg },
    summaryTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    summarySub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    summaryCount: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    summaryCountTotal: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textTertiary },

    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[5], paddingBottom: theme.spacing[2],
    },
    sectionLabel: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
        letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600',
    },
    sectionRule: { flex: 1, height: 1, backgroundColor: theme.roles.light.borderDefault },

    tallyRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4],
        paddingHorizontal: theme.spacing[4], paddingBottom: theme.spacing[2], flexWrap: 'wrap',
    },
    tally: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    tallyNum: { fontWeight: '700', color: theme.roles.light.textPrimary },
    overdue: { ...theme.typeScale.bodyMedium, color: theme.roles.light.dangerText, fontWeight: '600' },

    taskRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        paddingVertical: theme.spacing[3], paddingRight: theme.spacing[4],
        borderTopWidth: 1, borderTopColor: theme.roles.light.borderDefault,
    },
    taskBar: { width: 3, height: 34, borderRadius: 2 },
    taskTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    taskMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    taskStatus: { ...theme.typeScale.bodySmall, fontWeight: '700', textTransform: 'uppercase' },
    showMore: { padding: theme.spacing[4] },
});

export default TeamScreen;
