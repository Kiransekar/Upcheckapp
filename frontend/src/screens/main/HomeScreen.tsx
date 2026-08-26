import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { MoonPhaseCard } from '../../components/ui/MoonPhaseCard';
import { FarmGlanceCards } from '../../components/dashboard/FarmGlanceCards';
import { FarmContextBar } from '../../components/dashboard/FarmContextBar';
import { NextActionCard, rankActions } from '../../components/dashboard/NextActionCard';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { usePermissions } from '../../hooks/usePermissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportsApi, DashboardSummary } from '../../api/reports';
import { farmsApi } from '../../api/farms';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondContextApi } from '../../api/pondContext';
import { farmMembersApi } from '../../api/farmMembers';
import { tasksApi, type Task } from '../../api/tasks';
import { alertCenterApi, type BriefingItem, type AlertSeverity } from '../../api/alertCenter';
import { waterQualityApi } from '../../api/waterQuality';
import { toLocalISODate, todayLocalISODate } from '../../utils/localDate';
import { ONBOARDING_FLAG } from '../onboarding/WelcomeScreen';

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 3, watch: 2, info: 1 };
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
    critical: theme.roles.light.dangerBorder,
    watch: theme.roles.light.warningBorder,
    info: theme.roles.light.infoBorder,
};

interface DailyWindows {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
}

// Someone who joined an existing farm never sees WelcomeScreen/CreateFarm/
// PondSetup (pendingFarmSetup is only set when they said they run their own
// farm), so before this session's fix their first app-open had ZERO onboarding
// of any kind: no role explanation, no context on the farm they'd joined
// (docs/ONBOARDING_MODULE_PLAN.md §1.2/Phase 1). This one-time, dismissible
// interstitial closes that gap without blocking anything — same pattern as
// ONBOARDING_FLAG, just keyed separately since it's a different milestone.
export const WORKER_WELCOME_FLAG = '@upcheck:worker_welcomed';

export const HomeScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { selectedFarm, setSelectedFarm } = useActiveFarmStore();
    const perms = usePermissions(selectedFarm?.id);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [ponds, setPonds] = useState<Pond[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // "Getting Started" checklist (onboarding-plan Phase 2, extending the
    // finish-setup nudge from Task 7 into real activation milestones, not
    // just pond count): set up ponds → log a first reading → invite your
    // team. Reappears every visit while incomplete (persistent); a farmer
    // mid-task can dismiss it for this visit without it blocking anything
    // (dismissible) — plain component state is enough, it resets naturally
    // next time this screen mounts. Disappears entirely once every milestone
    // is done — unlike a reminder, a finished checklist has nothing left to say.
    const [plannedPondCount, setPlannedPondCount] = useState<number | null>(null);
    const [hasLoggedSomething, setHasLoggedSomething] = useState<boolean | null>(null);
    const [hasInvitedWorker, setHasInvitedWorker] = useState<boolean | null>(null);
    const [nudgeDismissed, setNudgeDismissed] = useState(false);
    // Worker first-run interstitial — see WORKER_WELCOME_FLAG above.
    const [showWorkerWelcome, setShowWorkerWelcome] = useState(false);
    // Worker dashboard v1: tasks assigned to this worker, not yet done.
    const [myOpenTasks, setMyOpenTasks] = useState<Task[] | null>(null);
    // "Needs Attention" — the cross-pond alert severity data already proven in
    // MorningBriefingScreen, surfaced at the top of Home so a critical issue
    // in any pond doesn't sit unseen behind five other sections and a "Today"
    // tap (docs/UI_UX_AUDIT.md homepage redesign, Phase 1).
    const [alerts, setAlerts] = useState<BriefingItem[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    // Actions deferred with "Later" — component state on purpose. It is a
    // "not right now", not a decision worth persisting: next time the farmer
    // opens Home the pond either still needs attention (so it comes back) or
    // it does not (so it is gone). Persisting would need an expiry policy for
    // something that expires naturally.
    const [deferred, setDeferred] = useState<string[]>([]);
    // Per-pond severity, keyed by pondId — drives the small severity dot on
    // "Your Ponds" cards below, from the SAME fetch (no extra round trips).
    const [pondSeverity, setPondSeverity] = useState<Record<string, AlertSeverity>>({});
    // "Today's Logs" — morning/afternoon/evening logging checkpoints plus the
    // weekly chemistry check, for the farm's representative pond (same
    // single-pond signal already used for the "logged something" checklist
    // item below — a precise per-pond breakdown isn't needed for a glance widget).
    const [dailyWindows, setDailyWindows] = useState<DailyWindows | null>(null);
    const [weeklyChemistryDays, setWeeklyChemistryDays] = useState<number | null>(null);
    // Distinct from summary===null: on a fetch FAILURE we must show a retry state,
    // not the "no farm data / create your first farm" CTA (which is for a genuinely
    // empty account). Conflating them pushes an existing owner to re-create a farm.
    const [error, setError] = useState<any>(null);

    const fetchSummary = useCallback(async () => {
        setError(null);
        try {
            // The dashboard aggregates per-farm; without a farmId the backend
            // returns all-zeros. Use the selected farm, else default to the
            // user's first farm (and remember it as the active farm).
            let farmId = selectedFarm?.id;
            if (!farmId) {
                const { data: farms } = await farmsApi.getAll();
                const first = Array.isArray(farms) ? farms[0] : undefined;
                if (first) {
                    farmId = first.id;
                    setSelectedFarm({ id: first.id, name: first.name, location: (first as any).location });
                }
            }
            const { data } = await reportsApi.getDashboardSummary(farmId);
            setSummary(data);
        } catch (err) {
            console.error("Failed to fetch dashboard summary", err);
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedFarm?.id, setSelectedFarm]);

    // Ponds for the one-tap "Your Ponds" shortcut — so the farmer reaches a pond
    // (and its daily loop) without drilling Farms → Farm → Pond.
    const fetchPonds = useCallback(() => {
        pondsApi.getMine().then(({ data }) => setPonds(data)).catch(() => setPonds([]));
    }, []);

    // Planned vs. actual pond count for the selected farm — one of the
    // Getting Started checklist items below.
    const fetchPlannedPondCount = useCallback(() => {
        if (!selectedFarm?.id) {
            setPlannedPondCount(null);
            return;
        }
        farmsApi
            .getById(selectedFarm.id)
            .then(({ data }) => setPlannedPondCount(data.plannedPondCount ?? null))
            .catch(() => setPlannedPondCount(null));
    }, [selectedFarm?.id]);

    // Cross-pond alert summary for the "Needs Attention" card. Mirrors
    // MorningBriefingScreen's merge (live + persisted, deduped by pond, kept
    // at the higher severity) — this is a compact top-N view; the full list
    // with per-item detail still lives in Morning Briefing.
    const fetchAlerts = useCallback(() => {
        Promise.all([
            alertCenterApi.liveBriefing().catch(() => ({ data: [] as BriefingItem[] })),
            alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
        ])
            .then(([live, persisted]) => {
                const merged = new Map<string, BriefingItem>();
                [...live.data, ...persisted.data].forEach((item) => {
                    const key = item.pondId ?? `${item.source}:${item.topTitle}`;
                    const existing = merged.get(key);
                    if (!existing) {
                        merged.set(key, item);
                        return;
                    }
                    const higher = SEVERITY_RANK[item.topSeverity] > SEVERITY_RANK[existing.topSeverity] ? item : existing;
                    merged.set(key, { ...higher, alertCount: existing.alertCount + item.alertCount });
                });
                const sorted = Array.from(merged.values()).sort(
                    (a, b) => SEVERITY_RANK[b.topSeverity] - SEVERITY_RANK[a.topSeverity],
                );
                setAlerts(sorted.slice(0, 3));
                const sevMap: Record<string, AlertSeverity> = {};
                sorted.forEach((item) => {
                    if (item.pondId) sevMap[item.pondId] = item.topSeverity;
                });
                setPondSeverity(sevMap);
            })
            .catch(() => {
                setAlerts([]);
                setPondSeverity({});
            })
            .finally(() => setAlertsLoading(false));
    }, []);

    // React Navigation keeps this screen mounted across the stack, so a
    // mount-only effect never re-ran after e.g. PondSetup/CreatePond added a
    // pond and navigated back — the dashboard, pond list, and Getting
    // Started checklist all stayed stale until the app was force-restarted.
    // Refetch every time Home regains focus instead.
    useFocusEffect(
        useCallback(() => {
            fetchSummary();
            fetchPonds();
            fetchPlannedPondCount();
            fetchAlerts();
        }, [fetchSummary, fetchPonds, fetchPlannedPondCount, fetchAlerts]),
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchSummary();
        fetchPonds();
        fetchPlannedPondCount();
        fetchAlerts();
    }, [fetchSummary, fetchPonds, fetchPlannedPondCount, fetchAlerts]);

    const onRetry = useCallback(() => {
        setIsLoading(true);
        fetchSummary();
    }, [fetchSummary]);

    // Alerts still worth acting on right now.
    const nextActions = rankActions(alerts).filter(
        (a) => !deferred.includes(a.pondId ?? a.topTitle),
    );
    // Each item carries the farm it came from — Home spans every farm, so an
    // action without its farm name is ambiguous the moment you have two.
    const farmNameForPond = (pondId: string | null) => {
        if (!pondId) return undefined;
        const pond = ponds.find((pd) => pd.id === pondId);
        if (!pond) return selectedFarm?.name;
        return pond.farmId === selectedFarm?.id ? selectedFarm?.name : undefined;
    };

    const pondsForSelectedFarm = selectedFarm?.id
        ? ponds.filter((p) => p.farmId === selectedFarm.id).length
        : ponds.length;
    const remainingPonds =
        plannedPondCount != null ? Math.max(0, plannedPondCount - pondsForSelectedFarm) : 0;
    const pondsStepDone = plannedPondCount == null || remainingPonds === 0;

    // "Logged a reading" — checked against the first pond's latest-input
    // snapshot rather than every pond (a representative signal is enough for
    // an activation checklist; it doesn't need to be a precise per-pond
    // analytics count).
    useEffect(() => {
        const firstPond = selectedFarm?.id ? ponds.find((p) => p.farmId === selectedFarm.id) : ponds[0];
        if (!firstPond) {
            setHasLoggedSomething(false);
            return;
        }
        pondContextApi
            .get(firstPond.id)
            .then(({ data }) => setHasLoggedSomething(
                data.lastFeedAt != null || data.waterQuality?.recordedAt != null || data.samplingAt != null,
            ))
            .catch(() => setHasLoggedSomething(false));
    }, [selectedFarm?.id, ponds]);

    // "Today's Logs" — bucket the representative pond's today's water-quality
    // readings into morning/afternoon/evening windows, and read the last
    // chemistry check date from pond-context. No new backend endpoint: the
    // paginated /water-quality list and pond-context snapshot already exist,
    // this is pure client-side derivation over data fetched elsewhere too.
    useEffect(() => {
        const firstPond = selectedFarm?.id ? ponds.find((p) => p.farmId === selectedFarm.id) : ponds[0];
        if (!firstPond) {
            setDailyWindows(null);
            setWeeklyChemistryDays(null);
            return;
        }
        Promise.all([
            waterQualityApi.getAll(firstPond.id, { take: 30 }),
            pondContextApi.get(firstPond.id),
        ])
            .then(([wqRes, ctxRes]) => {
                const raw = wqRes.data;
                const records: { recordedAt?: string }[] = Array.isArray(raw) ? raw : raw?.data || [];
                const today = todayLocalISODate();
                const windows: DailyWindows = { morning: false, afternoon: false, evening: false };
                records.forEach((r) => {
                    if (!r.recordedAt) return;
                    const d = new Date(r.recordedAt);
                    if (toLocalISODate(d) !== today) return;
                    const hour = d.getHours();
                    if (hour < 12) windows.morning = true;
                    else if (hour < 17) windows.afternoon = true;
                    else windows.evening = true;
                });
                setDailyWindows(windows);

                const chemAsOf = ctxRes.data.waterQuality?.chemistryAsOf;
                setWeeklyChemistryDays(
                    chemAsOf ? Math.floor((Date.now() - new Date(chemAsOf).getTime()) / 86_400_000) : null,
                );
            })
            .catch(() => {
                setDailyWindows(null);
                setWeeklyChemistryDays(null);
            });
    }, [selectedFarm?.id, ponds]);

    // "Invited your team" — more than just the owner as a farm member.
    const fetchInvitedWorker = useCallback(() => {
        if (!selectedFarm?.id) {
            setHasInvitedWorker(null);
            return;
        }
        farmMembersApi
            .listMembers(selectedFarm.id)
            .then(({ data }) => setHasInvitedWorker(data.length > 1))
            .catch(() => setHasInvitedWorker(false));
    }, [selectedFarm?.id]);

    useFocusEffect(fetchInvitedWorker);

    const checklistItems = [
        { key: 'ponds', done: pondsStepDone, label: t('home.checklistPonds', 'Set up your ponds'), icon: 'water-outline' as const },
        { key: 'log', done: hasLoggedSomething ?? false, label: t('home.checklistLog', 'Log your first reading'), icon: 'clipboard-check-outline' as const },
        { key: 'invite', done: hasInvitedWorker ?? false, label: t('home.checklistInvite', 'Invite your team'), icon: 'account-plus-outline' as const },
    ];
    const checklistLoading = hasLoggedSomething == null || hasInvitedWorker == null;
    const checklistDoneCount = checklistItems.filter((i) => i.done).length;
    // Two of the three items (ponds, invite) are owner/manager actions — a
    // plain worker met every other render condition here and saw a checklist
    // nudging them toward actions they can't take, stacked right above their
    // own "Log now" CTA. Gate the whole checklist behind the same capability
    // that gates those actions (docs/UI_UX_AUDIT.md homepage redesign).
    const showGettingStarted =
        !nudgeDismissed && !!selectedFarm?.id && perms.canManageOperations && !checklistLoading && checklistDoneCount < checklistItems.length;

    // First-run: a brand-new farmer with no farms and who hasn't seen the welcome
    // gets a one-time guided intro. The flag is set inside WelcomeScreen.
    useEffect(() => {
        (async () => {
            try {
                if (await AsyncStorage.getItem(ONBOARDING_FLAG)) return;
                const { data: farms } = await farmsApi.getAll();
                if (Array.isArray(farms) && farms.length === 0) {
                    (navigation.getParent() ?? navigation).navigate('Welcome');
                }
            } catch {
                /* non-blocking; onboarding is a nicety, never a gate */
            }
        })();
    }, []);

    // Worker first-run interstitial: only once, only for a worker who has
    // resolved a farm (so there's a real name/role to show), never re-shown
    // once dismissed. Waiting on selectedFarm/perms.role avoids a flash of
    // the banner with blank content before the farm/membership loads.
    useEffect(() => {
        if (!perms.isWorker || !selectedFarm?.id || !perms.role) return;
        (async () => {
            try {
                if (await AsyncStorage.getItem(WORKER_WELCOME_FLAG)) return;
                setShowWorkerWelcome(true);
            } catch {
                /* non-blocking; the interstitial is a nicety, never a gate */
            }
        })();
    }, [perms.isWorker, perms.role, selectedFarm?.id]);

    const dismissWorkerWelcome = () => {
        setShowWorkerWelcome(false);
        AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1').catch(() => {});
    };

    // Worker dashboard v1: surface the worker's own assigned, not-yet-done
    // tasks right on Home instead of requiring a drill into Farms → Farm →
    // Tasks to discover them. Re-fetches on focus (screen stays mounted).
    const fetchMyTasks = useCallback(() => {
        if (!perms.isWorker || !selectedFarm?.id || !user?.id) {
            setMyOpenTasks(null);
            return;
        }
        tasksApi.getAll(selectedFarm.id, { assignedToId: user.id })
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
                setMyOpenTasks(list.filter((t: Task) => t.status === 'open' || t.status === 'in_progress'));
            })
            .catch(() => setMyOpenTasks(null));
    }, [perms.isWorker, selectedFarm?.id, user?.id]);

    useFocusEffect(useCallback(() => { fetchMyTasks(); }, [fetchMyTasks]));

    // Root-stack screens (CreateFarm, PondDashboard, Settings…) live above the
    // tab navigator; navigate via the parent so they resolve from a tab.
    const goRoot = (screen: string, params?: any) =>
        navigation.getParent()?.navigate(screen, params) ?? navigation.navigate(screen, params);

    const quickActions = [
        // "Today" (Morning Briefing) is the actual "what do I do right now"
        // destination, so it leads — previously this screen had zero
        // navigation entry points anywhere in the app (see docs/UI_UX_AUDIT.md
        // Tier 1 #2 / docs/ONBOARDING_MODULE_PLAN.md Phase 2).
        { icon: 'weather-sunset-up' as const, label: t('home.actionToday', 'Today'), screen: 'MorningBriefing', isTab: false, color: theme.roles.light.primary },
        { icon: 'barn' as const, label: t('home.actionFarms'), screen: 'Farms', isTab: true, color: theme.roles.light.primary },
        { icon: 'calculator-variant-outline' as const, label: t('home.actionCalculators'), screen: 'CalculatorHub', isTab: false, color: theme.roles.light.infoBorder },
        // Simulations are an owner/manager planning tool — hide for worker/viewer.
        ...(perms.canManageOperations
            ? [{ icon: 'chart-timeline-variant' as const, label: t('home.actionSimulate'), screen: 'SimulationList', isTab: false, color: theme.roles.light.successText }]
            : []),
        { icon: 'cog-outline' as const, label: t('home.actionSettings'), screen: 'Settings', isTab: true, color: theme.roles.light.warningText },
    ];

    return (
        <ScreenWrapper
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[theme.roles.light.primary]} tintColor={theme.roles.light.primary} />
            }
        >
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Text style={styles.greeting}>{t('home.greeting')}</Text>
                    <Text style={styles.userName} numberOfLines={1}>
                        {user?.name || user?.email?.split('@')[0] || t('home.farmerFallback')}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.avatar} accessibilityRole="button" accessibilityLabel={t('common.settings', 'Settings')}>
                    <MaterialCommunityIcons name="account-circle" size={40} color={theme.roles.light.primary} />
                </TouchableOpacity>
            </View>

            {/* "Which farm am I on, and what's my role here?" — a persistent
                context bar with a role badge, plus an inline switcher for
                multi-farm members. This is the core fix for the owner-vs-worker
                ambiguity: role is now a distinct colored badge, not a faint line. */}
            <FarmContextBar />

            {/* "Do this first" — the redesign's centrepiece (artboard 1b).
                Home used to open on a LIST of alerts, which makes the farmer
                rank severity, pond and farm before they can act. This does the
                ranking and states ONE action; the list below becomes "then". */}
            {!alertsLoading && nextActions.length > 0 && (
                <NextActionCard
                    items={nextActions}
                    farmNameForPond={farmNameForPond}
                    onDone={(item) => {
                        // Recording the reading is what actually clears the
                        // alert, so send them to the log for that pond rather
                        // than optimistically marking it resolved here.
                        setDeferred((d) => [...d, item.pondId ?? item.topTitle]);
                        goRoot('QuickLog', item.pondId ? { pondId: item.pondId } : undefined);
                    }}
                    onLater={(item) => setDeferred((d) => [...d, item.pondId ?? item.topTitle])}
                />
            )}

            {/* "Needs Attention" — top of the page, always, so a critical issue in
                any pond is visible before Getting Started/stats/ponds, not just
                reachable via a "Today" tap five sections down
                (docs/UI_UX_AUDIT.md homepage redesign, Phase 1). Reuses the same
                alert-center data MorningBriefingScreen already shows in full. */}
            {!alertsLoading && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => goRoot('MorningBriefing')}>
                    {alerts.length === 0 ? (
                        <Card style={styles.allClearCard}>
                            <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.roles.light.successText} />
                            <View style={styles.allClearText}>
                                <Text style={styles.allClearTitle}>{t('home.allClearTitle', 'All clear')}</Text>
                                <Text style={styles.allClearBody}>{t('home.allClearBody', 'No issues need your attention right now.')}</Text>
                            </View>
                        </Card>
                    ) : (
                        <Card style={styles.attentionCard}>
                            <Text style={styles.attentionTitle}>{t('home.needsAttentionTitle', 'Needs Attention')}</Text>
                            {alerts.map((item, i) => (
                                <View key={item.pondId ?? i} style={[styles.attentionRow, i > 0 && styles.attentionRowBorder]}>
                                    <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLOR[item.topSeverity] }]} />
                                    <Text style={styles.attentionRowText} numberOfLines={1}>{item.topTitle}</Text>
                                    {item.alertCount > 1 && (
                                        <Text style={styles.attentionMore}>{t('home.moreAlerts', { count: item.alertCount - 1 })}</Text>
                                    )}
                                </View>
                            ))}
                        </Card>
                    )}
                </TouchableOpacity>
            )}

            {/* "Today's Logs" — minimal morning/afternoon/evening progress for the
                representative pond, plus the weekly chemistry check freshness,
                so a farmer can tell at a glance whether today's routine is done
                without opening Daily Routine. */}
            {dailyWindows && (
                <Card style={styles.dailyProgressCard}>
                    <Text style={styles.dailyProgressTitle}>{t('home.dailyProgressTitle', "Today's Logs")}</Text>
                    <View style={styles.dailyProgressRow}>
                        {([
                            ['morning', dailyWindows.morning, t('home.dailyProgressMorning', 'Morning')],
                            ['afternoon', dailyWindows.afternoon, t('home.dailyProgressAfternoon', 'Afternoon')],
                            ['evening', dailyWindows.evening, t('home.dailyProgressEvening', 'Evening')],
                        ] as const).map(([key, done, label]) => (
                            <View key={key} style={styles.dailyProgressSlot}>
                                <View style={[styles.dailyProgressDot, done && styles.dailyProgressDotDone]}>
                                    <MaterialCommunityIcons
                                        name={done ? 'check' : 'circle-outline'}
                                        size={14}
                                        color={done ? theme.roles.light.textInverse : theme.roles.light.textTertiary}
                                    />
                                </View>
                                <Text style={styles.dailyProgressLabel}>{label}</Text>
                            </View>
                        ))}
                    </View>
                    {weeklyChemistryDays != null && (
                        <View style={styles.weeklyChemistryRow}>
                            <MaterialCommunityIcons name="flask-outline" size={16} color={theme.roles.light.textSecondary} />
                            <Text style={styles.weeklyChemistryLabel}>{t('home.weeklyChemistryLabel', 'Weekly chemistry check')}</Text>
                            <Text style={[
                                styles.weeklyChemistryValue,
                                weeklyChemistryDays > 7 && styles.weeklyChemistryOverdue,
                            ]}>
                                {weeklyChemistryDays === 0
                                    ? t('home.weeklyChemistryToday', 'Checked today')
                                    : weeklyChemistryDays > 7
                                        ? t('home.weeklyChemistryOverdue', { days: weeklyChemistryDays })
                                        : t('home.weeklyChemistryDaysAgo', { days: weeklyChemistryDays })}
                            </Text>
                        </View>
                    )}
                </Card>
            )}

            {/* Getting Started checklist (onboarding-plan Phase 2): tracks real
                activation milestones, not just pond count. Reappears every visit
                while incomplete, dismissible for now, and disappears entirely
                once every milestone is done. */}
            {showGettingStarted && (
                <Card style={styles.checklistCard}>
                    <View style={styles.checklistHead}>
                        <Text style={styles.checklistTitle}>{t('home.gettingStartedTitle', 'Getting started')}</Text>
                        <View style={styles.checklistHeadRight}>
                            <Text style={styles.checklistCount}>{checklistDoneCount}/{checklistItems.length}</Text>
                            <TouchableOpacity
                                onPress={() => setNudgeDismissed(true)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={t('common.dismiss', 'Dismiss')}
                                style={styles.nudgeDismiss}
                            >
                                <MaterialCommunityIcons name="close" size={18} color={theme.roles.light.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {checklistItems.map((item) => (
                        <TouchableOpacity
                            key={item.key}
                            activeOpacity={item.done ? 1 : 0.7}
                            disabled={item.done}
                            onPress={() => {
                                if (item.key === 'ponds') goRoot('PondSetup', { farmId: selectedFarm!.id, totalPonds: remainingPonds || 1 });
                                else if (item.key === 'log') goRoot('QuickLog');
                                else if (item.key === 'invite') goRoot('AddWorker', { farmId: selectedFarm!.id });
                            }}
                            style={styles.checklistRow}
                        >
                            <View style={[styles.checklistBadge, item.done && styles.checklistBadgeDone]}>
                                <MaterialCommunityIcons
                                    name={item.done ? 'check' : item.icon}
                                    size={16}
                                    color={item.done ? theme.roles.light.textInverse : theme.roles.light.textSecondary}
                                />
                            </View>
                            <Text style={[styles.checklistLabel, item.done && styles.checklistLabelDone]}>{item.label}</Text>
                            {!item.done && <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />}
                        </TouchableOpacity>
                    ))}
                </Card>
            )}

            {/* Worker first-run interstitial (onboarding-plan Phase 1): a worker
                previously got zero explanation of their role or which farm
                they'd joined on their very first app-open. One-time, dismissible,
                never blocks reaching the rest of the app underneath it. */}
            {showWorkerWelcome && selectedFarm && perms.role && (
                <Card style={styles.workerWelcomeCard}>
                    <View style={styles.workerWelcomeIcon}>
                        <MaterialCommunityIcons name="account-check-outline" size={24} color={theme.roles.light.primary} />
                    </View>
                    <Text style={styles.workerWelcomeTitle}>
                        {t('home.workerWelcomeTitle', { farmName: selectedFarm.name, role: t(`members.role_${perms.role}`), defaultValue: "You're part of {{farmName}}'s team as a {{role}}" })}
                    </Text>
                    <Text style={styles.workerWelcomeBody}>
                        {t('home.workerWelcomeBody', 'Tap "Log now" anytime to record today\'s water, feed, or other readings for your ponds.')}
                    </Text>
                    <Button
                        title={t('home.workerWelcomeCta', 'Got it')}
                        onPress={dismissWorkerWelcome}
                        style={styles.ctaBtn}
                    />
                </Card>
            )}

            {/* Worker home is task-first: a single large "Log now" entry to the
                daily loop. Owners/managers get the portfolio below instead. */}
            {perms.isWorker && (
                <Card style={styles.logNowCard}>
                    <View style={styles.logNowIcon}>
                        <MaterialCommunityIcons name="clipboard-check-outline" size={28} color={theme.roles.light.primary} />
                    </View>
                    <Text style={styles.logNowText}>{t('home.workerLogPrompt', "Record today's readings for your ponds")}</Text>
                    <Button
                        title={t('home.logNow', 'Log now')}
                        onPress={() => goRoot('QuickLog')}
                        style={styles.ctaBtn}
                    />
                </Card>
            )}

            {/* Worker dashboard v1: assigned tasks + attendance + leave, all
                real (attendance #50, leave #51). */}
            {perms.isWorker && selectedFarm?.id && (
                <>
                    <Text style={styles.sectionTitle}>{t('home.workerDashboardTitle')}</Text>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => goRoot('TaskList', { farmId: selectedFarm.id, farmName: selectedFarm.name, assignedToId: user?.id })}
                    >
                        <Card style={styles.workerModuleCard}>
                            <MaterialCommunityIcons name="clipboard-check-outline" size={28} color={theme.roles.light.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.workerModuleTitle}>{t('home.myTasksTitle')}</Text>
                                <Text style={styles.workerModuleSub}>
                                    {myOpenTasks == null
                                        ? t('home.myTasksLoading')
                                        : t('home.myTasksCount', { count: myOpenTasks.length })}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
                        </Card>
                    </TouchableOpacity>
                    <View style={styles.workerModuleRow}>
                        <TouchableOpacity
                            style={styles.workerTileWrap}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('home.attendanceCta')}
                            onPress={() => goRoot('Attendance', { farmId: selectedFarm.id, farmName: selectedFarm.name })}
                        >
                            <Card style={styles.workerTile}>
                                <MaterialCommunityIcons name="calendar-check-outline" size={24} color={theme.roles.light.primary} />
                                <Text style={styles.workerTileText}>{t('home.attendanceCta')}</Text>
                            </Card>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.workerTileWrap}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('home.leaveCta')}
                            onPress={() => goRoot('LeaveRequests', { farmId: selectedFarm.id, farmName: selectedFarm.name })}
                        >
                            <Card style={styles.workerTile}>
                                <MaterialCommunityIcons name="calendar-remove-outline" size={24} color={theme.roles.light.primary} />
                                <Text style={styles.workerTileText}>{t('home.leaveCta')}</Text>
                            </Card>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Attendance v1 (#50) / Leave v1 (#51): owner/manager entry
                points — workers already reach both via the row above; this
                covers the manage-operations audience the worker-only block
                skips. */}
            {selectedFarm?.id && !perms.isWorker && perms.canManageOperations && (
                <>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => goRoot('Attendance', { farmId: selectedFarm.id, farmName: selectedFarm.name })}
                    >
                        <Card style={styles.attendanceCard}>
                            <MaterialCommunityIcons name="calendar-check-outline" size={28} color={theme.roles.light.primary} />
                            <Text style={styles.attendanceCardText}>{t('home.attendanceCta')}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
                        </Card>
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => goRoot('LeaveRequests', { farmId: selectedFarm.id, farmName: selectedFarm.name })}
                    >
                        <Card style={styles.leaveCard}>
                            <MaterialCommunityIcons name="calendar-remove-outline" size={28} color={theme.roles.light.primary} />
                            <Text style={styles.leaveCardText}>{t('home.leaveCta')}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
                        </Card>
                    </TouchableOpacity>
                </>
            )}

            <Text style={styles.sectionTitle}>{t('home.dashboardSummary')}</Text>
            {isLoading ? (
                // Skeleton placeholders matching the stat grid — perceived speed
                // beats a spinner on low-end devices (design system §6/§7).
                <View style={styles.statsGrid}>
                    {[0, 1, 2, 3].map((i) => (
                        <Card key={i} style={styles.statCard}>
                            <Skeleton width={44} height={28} />
                            <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
                        </Card>
                    ))}
                </View>
            ) : error && !summary ? (
                // Fetch failed and we have nothing cached — show retry, NOT the
                // create-farm CTA (the owner already has farms; only the request failed).
                <ErrorState
                    title={t('home.summaryErrorTitle', "Couldn't load your dashboard")}
                    error={error}
                    onRetry={onRetry}
                />
            ) : summary ? (
                <View style={styles.statsGrid}>
                    <TouchableOpacity style={styles.statCardTouchable} activeOpacity={0.7} onPress={() => navigation.navigate('Farms')}>
                        <Card style={[styles.statCard, styles.statCardNested]}>
                            <MaterialCommunityIcons name="water" size={32} color={theme.roles.light.primary} />
                            <Text style={styles.statValue}>{summary.activePondsCount}</Text>
                            <Text style={styles.statLabel}>{t('home.activePonds')}</Text>
                        </Card>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.statCardTouchable} activeOpacity={0.7} onPress={() => navigation.navigate('Farms')}>
                        <Card style={[styles.statCard, styles.statCardNested]}>
                            <MaterialCommunityIcons name="water-outline" size={32} color={theme.roles.light.textSecondary} />
                            <Text style={styles.statValue}>{summary.totalPondsCount}</Text>
                            <Text style={styles.statLabel}>{t('home.totalPonds')}</Text>
                        </Card>
                    </TouchableOpacity>
                    {/* Low-stock is an actionable alert, not a neutral count — give it
                        a distinct tint (not just a differently-colored icon) and route
                        straight to Inventory instead of being a dead end. */}
                    <TouchableOpacity style={styles.statCardTouchable} activeOpacity={0.7} onPress={() => goRoot('Inventory')}>
                        <Card style={[styles.statCard, styles.statCardNested, summary.lowStockAlerts > 0 && styles.statCardAlert]}>
                            <MaterialCommunityIcons name="alert" size={32} color={theme.roles.light.dangerText} />
                            <Text style={styles.statValue}>{summary.lowStockAlerts}</Text>
                            <Text style={styles.statLabel}>{t('home.lowStockAlerts')}</Text>
                        </Card>
                    </TouchableOpacity>
                    {/* No single unambiguous farm-wide feed screen to link to (FeedStats
                        needs a specific pondId) — left as a plain glance card rather
                        than a misleading/arbitrary navigation target. */}
                    <Card style={styles.statCard}>
                        <MaterialCommunityIcons name="corn" size={32} color={theme.roles.light.warningText} />
                        <Text style={styles.statValue}>{summary.todayFeedUsage}</Text>
                        <Text style={styles.statLabel}>{t('home.todayFeed')}</Text>
                    </Card>
                </View>
            ) : (
                <Card style={styles.ctaCard}>
                    <View style={styles.ctaIcon}>
                        <MaterialCommunityIcons name="barn" size={28} color={theme.roles.light.primary} />
                    </View>
                    {/* Both routes, always. The old either/or branched on a global
                        owner/worker account flag, so someone who picked "worker" at
                        signup was never shown "Create farm" even after leasing a pond,
                        and an owner was never shown "Join with code" even when a
                        neighbour invited them. Neither is a real constraint: any
                        account can create a farm (becoming its owner) or join one. */}
                    <Text style={styles.ctaText}>{t('home.noFarmEither')}</Text>
                    <Button
                        title={t('home.quickLogCreateFarm')}
                        onPress={() => goRoot('CreateFarm')}
                        style={styles.ctaBtn}
                    />
                    <Button
                        title={t('home.workerJoinFarmCta')}
                        onPress={() => goRoot('JoinFarm')}
                        variant="outlined"
                        style={styles.ctaBtn}
                    />
                </Card>
            )}

            {/* Farm-at-a-glance includes expenses + P&L, so it's owner/manager only
                (VIEW_FINANCIALS); workers/viewers don't see farm economics.
                Moved above Your Ponds/Moon Phase — financial + operational
                context outranks a pond-name list and a lunar widget. */}
            {selectedFarm?.id && perms.canViewFinancials && (
                <>
                    <Text style={styles.sectionTitle}>{t('home.farmGlance')}</Text>
                    <FarmGlanceCards farmId={selectedFarm.id} farmName={selectedFarm.name} navigation={navigation} />
                </>
            )}

            {/* Your Ponds — one tap from the dashboard into any pond's daily loop.
                Each card now carries a severity dot (from the same alert fetch
                above) so this doubles as a scan-able triage list, not just names. */}
            {ponds.length > 0 && (
                <>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>{t('home.yourPonds')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Farms')}>
                            <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pondRow}>
                        {ponds.slice(0, 8).map((p) => {
                            const severity = pondSeverity[p.id];
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    activeOpacity={0.85}
                                    onPress={() => goRoot('PondDashboard', { pondId: p.id, pondName: p.displayName || p.name })}
                                >
                                    <Card style={styles.pondCard}>
                                        {severity && <View style={[styles.pondSeverityDot, { backgroundColor: SEVERITY_COLOR[severity] }]} />}
                                        <MaterialCommunityIcons name="water" size={22} color={theme.roles.light.primary} />
                                        <Text style={styles.pondName} numberOfLines={1}>{p.displayName || p.name}</Text>
                                        <Text style={styles.pondMeta} numberOfLines={1}>
                                            {p.activeCycleId ? t('home.pondActive') : t('home.pondIdle')}
                                        </Text>
                                    </Card>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </>
            )}

            {/* Lunar phase demoted to a single-line strip — a nice-to-know, not a
                decision-driving metric, so it no longer carries the same visual
                weight (full card + section title) as alerts/financials above. */}
            <View style={styles.moonStrip}>
                <MoonPhaseCard compact />
            </View>

            <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
            <View style={styles.grid}>
                {quickActions.map((action) => (
                    <TouchableOpacity
                        key={action.label}
                        style={styles.actionCard}
                        onPress={() => action.isTab ? navigation.navigate(action.screen) : navigation.getParent()?.navigate(action.screen) ?? navigation.navigate(action.screen)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: action.color + '15' }]}>
                            <MaterialCommunityIcons name={action.icon} size={28} color={action.color} />
                        </View>
                        <Text style={styles.actionLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    allClearCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
        backgroundColor: theme.roles.light.successBg,
    },
    allClearText: { flex: 1 },
    allClearTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.successText, fontWeight: '600' },
    allClearBody: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginTop: 2 },
    attentionCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    attentionTitle: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        marginBottom: theme.spacing[2],
    },
    attentionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
    },
    attentionRowBorder: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    severityDot: { width: 8, height: 8, borderRadius: 4 },
    attentionRowText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    attentionMore: { ...theme.typeScale.labelSmall, color: theme.roles.light.textTertiary },
    dailyProgressCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    dailyProgressTitle: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        marginBottom: theme.spacing[3],
    },
    dailyProgressRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    dailyProgressSlot: { alignItems: 'center', gap: theme.spacing[1] },
    dailyProgressDot: {
        width: 28, height: 28, borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant,
        alignItems: 'center', justifyContent: 'center',
    },
    dailyProgressDotDone: { backgroundColor: theme.roles.light.successBorder },
    dailyProgressLabel: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary },
    weeklyChemistryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginTop: theme.spacing[4],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    weeklyChemistryLabel: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, flex: 1 },
    weeklyChemistryValue: { ...theme.typeScale.labelMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
    weeklyChemistryOverdue: { color: theme.roles.light.dangerText },
    checklistCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    checklistHead: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: theme.spacing[3],
    },
    checklistHeadRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    checklistTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    checklistCount: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
    checklistRow: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        paddingVertical: theme.spacing[2],
    },
    checklistBadge: {
        width: 28, height: 28, borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center',
    },
    checklistBadgeDone: { backgroundColor: theme.roles.light.successBorder },
    checklistLabel: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    checklistLabelDone: { color: theme.roles.light.textTertiary, textDecorationLine: 'line-through' },
    nudgeDismiss: { padding: theme.spacing[1] },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[4],
    },
    headerText: { flex: 1, marginRight: theme.spacing[3] },
    greeting: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    userName: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
    },
    logNowCard: {
        alignItems: 'center',
        padding: theme.spacing[5],
        marginBottom: theme.spacing[6],
        gap: theme.spacing[2],
    },
    logNowIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: theme.roles.light.primary + '15',
        alignItems: 'center', justifyContent: 'center',
    },
    logNowText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    leaveCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    leaveCardText: {
        flex: 1,
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    attendanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    attendanceCardText: {
        flex: 1,
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    workerModuleRow: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[6],
    },
    workerModuleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[3],
    },
    workerModuleTitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    workerModuleSub: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: 2,
    },
    workerTileWrap: { flex: 1 },
    workerTile: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[5],
        paddingHorizontal: theme.spacing[3],
    },
    workerTileText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    moonStrip: {
        paddingHorizontal: theme.spacing[1],
        marginBottom: theme.spacing[6],
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    actionCard: {
        width: '47%',
        backgroundColor: theme.roles.light.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing[4],
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing[3],
    },
    actionLabel: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
    },
    ctaCard: {
        alignItems: 'center',
        padding: theme.spacing[5],
        marginBottom: theme.spacing[6],
        gap: theme.spacing[2],
    },
    ctaIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: theme.roles.light.primary + '15',
        alignItems: 'center', justifyContent: 'center',
    },
    ctaText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    ctaBtn: { alignSelf: 'stretch', marginTop: theme.spacing[2] },
    workerWelcomeCard: {
        alignItems: 'center',
        padding: theme.spacing[5],
        marginBottom: theme.spacing[6],
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg,
    },
    workerWelcomeIcon: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: theme.roles.light.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    workerWelcomeTitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    workerWelcomeBody: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    sectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[4],
    },
    viewAll: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary },
    pondRow: { gap: theme.spacing[3], paddingBottom: theme.spacing[2], marginBottom: theme.spacing[6] },
    pondCard: { width: 130, padding: theme.spacing[4], gap: theme.spacing[1] },
    pondSeverityDot: {
        position: 'absolute', top: theme.spacing[3], right: theme.spacing[3],
        width: 8, height: 8, borderRadius: 4,
    },
    pondName: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600', marginTop: theme.spacing[1] },
    pondMeta: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary },
    loadingContainer: {
        paddingVertical: theme.spacing[8],
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    statCard: {
        width: '47%',
        padding: theme.spacing[4],
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Used when a Card is nested inside a `statCardTouchable` wrapper — the
    // width belongs on the wrapper so 47%-of-47% doesn't double-shrink it.
    statCardTouchable: { width: '47%' },
    statCardNested: { width: '100%' },
    statCardAlert: {
        backgroundColor: theme.roles.light.dangerBg,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerBorder,
    },
    statValue: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[2],
        marginBottom: 4,
    },
    statLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
});
