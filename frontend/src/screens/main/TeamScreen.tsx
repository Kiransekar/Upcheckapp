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
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { leaveRequestsApi, type LeaveRequest } from '../../api/leaveRequests';
import { tasksApi, type Task } from '../../api/tasks';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';

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

const memberName = (m?: FarmMember) => {
    const u = m?.user;
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || '';
};

/** Status pill colour — the design uses colour AND the word, never colour alone. */
const STATUS_COLOR: Record<string, string> = {
    open: theme.roles.light.textTertiary,
    in_progress: theme.roles.light.primary,
    done: theme.roles.light.warningText,
    verified: theme.roles.light.successText,
};

export const TeamScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { selectedFarm } = useActiveFarmStore();
    const farmId = selectedFarm?.id;
    const userId = useAuthStore((s) => s.user?.id);
    const perms = usePermissions(farmId);

    const [myAttendance, setMyAttendance] = useState<AttendanceRecord | null>(null);
    const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
    const [pendingLeave, setPendingLeave] = useState<LeaveRequest[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<FarmMember[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showAllTasks, setShowAllTasks] = useState(false);

    const load = useCallback(async () => {
        if (!farmId) return;
        // Independent reads — fan out rather than waterfall. Each failure is
        // isolated so one unavailable section cannot blank the whole tab.
        const [mine, all, leave, taskList, memberList] = await Promise.allSettled([
            attendanceApi.mine(farmId),
            perms.canManageMembers ? attendanceApi.getAll(farmId) : Promise.resolve({ data: [] as AttendanceRecord[] }),
            perms.canManageMembers ? leaveRequestsApi.getAll(farmId, 'pending') : Promise.resolve({ data: [] as LeaveRequest[] }),
            tasksApi.getAll(farmId),
            farmMembersApi.listMembers(farmId),
        ]);

        if (mine.status === 'fulfilled') {
            // The open record is the one with no check-out.
            setMyAttendance(mine.value.data.find((r) => !r.checkOutAt) ?? null);
        }
        if (all.status === 'fulfilled') setAllAttendance(all.value.data);
        if (leave.status === 'fulfilled') setPendingLeave(leave.value.data);
        if (taskList.status === 'fulfilled') setTasks(taskList.value.data);
        if (memberList.status === 'fulfilled') setMembers(memberList.value.data);
        setRefreshing(false);
    }, [farmId, perms.canManageMembers]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const checkOut = useCallback(async () => {
        if (!myAttendance) return;
        try {
            await attendanceApi.checkOut(myAttendance.id);
            setMyAttendance(null);
            load();
        } catch {
            // Non-fatal; the attendance screen shows the authoritative state.
        }
    }, [myAttendance, load]);

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
    const activeMembers = members.filter((m) => m.status !== 'pending');
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
                        {selectedFarm?.name?.toUpperCase()}
                    </Text>
                    <Text style={styles.title}>{t('team.title')}</Text>
                </View>
                {perms.canInviteMember && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('FarmMembers', { farmId, farmName: selectedFarm?.name })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.headerAction}>{t('team.addWorker')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
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
                            onPress={() => navigation.navigate('LeaveRequests', { farmId })}
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
                        <TouchableOpacity onPress={() => navigation.navigate('Tasks', { farmId })}>
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
                                onPress={() => navigation.navigate('TaskDetail', { id: tk.id })}
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
                                        {[memberName(assignee), tk.dueDate ? hhmm(tk.dueDate) : null, isOverdue ? t('team.overdue') : null]
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

const styles = StyleSheet.create({
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
