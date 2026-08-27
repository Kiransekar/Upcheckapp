import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import {
    NextActionCard,
    rankActions,
    type ActionGroup,
} from '../../components/dashboard/NextActionCard';
import { HeroCard } from '../../components/dashboard/HeroCard';
import { ThenList } from '../../components/dashboard/ThenList';
import { MyTasksList } from '../../components/dashboard/MyTasksList';
import { TodayStats } from '../../components/dashboard/TodayStats';
import { GettingStarted } from '../../components/dashboard/GettingStarted';
import { LunarRow } from '../../components/dashboard/LunarRow';
import { FarmOverview } from '../../components/dashboard/FarmOverview';
import { buildPondRows, mergeBriefings } from '../../utils/pondHealth';
import type { PondContext } from '../../api/pondContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { formatWeekday } from '../../utils/formatDate';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { usePermissions } from '../../hooks/usePermissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { farmsApi } from '../../api/farms';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondContextApi } from '../../api/pondContext';
import { farmMembersApi } from '../../api/farmMembers';
import { attendanceApi } from '../../api/attendance';
import { tasksApi, type Task } from '../../api/tasks';
import { alertCenterApi, type BriefingItem, type AlertSeverity } from '../../api/alertCenter';
import { toLocalISODate, todayLocalISODate } from '../../utils/localDate';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';
import Svg, { Ellipse, Path } from 'react-native-svg';

/** Stable empty fallbacks — a fresh `[]` each render would break the memos. */
const EMPTY_FARMS: { id: string; name: string }[] = [];
const EMPTY_PONDS: Pond[] = [];
const EMPTY_ALERTS: BriefingItem[] = [];
const EMPTY_CONTEXTS: PondContext[] = [];

/**
 * The empty first-run dashboard (artboard 09). An outline pond rather than a
 * warning glyph: nothing has gone wrong, there is simply nothing here yet, and
 * an alert icon on a brand-new account reads as a fault.
 */
const EmptyPondArt = () => (
    <Svg width={120} height={72} viewBox="0 0 120 72" fill="none">
        <Ellipse cx={60} cy={40} rx={46} ry={24} stroke={theme.roles.light.borderStrong} strokeWidth={1.6} />
        <Path d="M26 40c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke={theme.roles.light.borderStrong} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M34 50c5-3 10-3 15 0s10 3 15 0" stroke={theme.roles.light.borderStrong} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M14 34c0-4 2-8 6-11" stroke={theme.roles.light.borderStrong} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M106 34c0-4-2-8-6-11" stroke={theme.roles.light.borderStrong} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
);

const EmptyChoice = ({ icon, title, subtitle, onPress }: {
    icon: IconName; title: string; subtitle: string; onPress: () => void;
}) => (
    <TouchableOpacity
        style={styles.emptyChoice}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
    >
        <Icon name={icon} size={26} color={theme.roles.light.primary} />
        <View style={styles.emptyChoiceText}>
            <Text style={styles.emptyChoiceTitle}>{title}</Text>
            <Text style={styles.emptyChoiceSub}>{subtitle}</Text>
        </View>
        <Icon name="chevron_right" size={22} color={theme.roles.light.textTertiary} />
    </TouchableOpacity>
);

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 3, watch: 2, info: 1 };

/** Every alert a deferred group covers, in the same shape `deferred` holds. */
const deferKeys = (group: ActionGroup): string[] =>
    group.items.map((i) => i.pondId ?? i.topTitle);

// Someone who joined an existing farm never sees WelcomeScreen/CreateFarm/
// PondSetup (pendingFarmSetup is only set when they said they run their own
// farm), so before this session's fix their first app-open had ZERO onboarding
// of any kind: no role explanation, no context on the farm they'd joined
// (docs/ONBOARDING_MODULE_PLAN.md §1.2/Phase 1). This one-time, dismissible
// interstitial closes that gap without blocking anything.
export const WORKER_WELCOME_FLAG = '@upcheck:worker_welcomed';

/** Set when the farmer confirms they want the Getting Started list gone. */
export const CHECKLIST_HIDDEN_FLAG = '@upcheck:checklist_hidden';

export const HomeScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { selectedFarm, setSelectedFarm } = useActiveFarmStore();
    const perms = usePermissions(selectedFarm?.id);
    /**
     * The full farm list — 1b's header counts them, the Filter switches between
     * them, and "Then" resolves each alert's farm name against it.
     *
     * Deliberately the SAME cache key the Farms tab uses: one read, shared, so
     * moving between the two tabs is instant and a phone with no signal opens
     * on the last-known list instead of the create-your-first-farm screen.
     */
    const farmsQuery = useAppQuery({
        queryKey: qk.farms(),
        queryFn: async () => (await farmsApi.getAll()).data,
    });
    const farms = (farmsQuery.data as { id: string; name: string }[] | undefined) ?? EMPTY_FARMS;

    /** Ponds for the one-tap "Your Ponds" shortcut. Persisted; enrichment. */
    const pondsQuery = useAppQuery({
        queryKey: qk.ponds(),
        queryFn: async () => (await pondsApi.getMine()).data,
    });
    const ponds = pondsQuery.data ?? EMPTY_PONDS;

    const [showFarmFilter, setShowFarmFilter] = useState(false);
    /**
     * Home's own scope. `null` means ALL farms, which is what 1b opens on —
     * the header says "All farms" and every figure below is the sum.
     *
     * Deliberately NOT the global `selectedFarm`. That store exists because
     * Team, Inventory and the farm screens each need one concrete farm to work
     * on, so something has to keep it populated; Home just must not inherit it
     * as a filter. Picking a farm here sets both, so the rest of the app
     * follows you — picking "All farms" only widens Home.
     */
    const [scopeFarmId, setScopeFarmId] = useState<string | null>(null);
    /** The farms every figure on this screen is computed over. */
    const scopeFarms = React.useMemo(
        () => (scopeFarmId ? farms.filter((f) => f.id === scopeFarmId) : farms),
        [scopeFarmId, farms],
    );
    /** The one farm in scope, or undefined when showing all of them. */
    const scopeFarm = scopeFarmId ? farms.find((f) => f.id === scopeFarmId) : undefined;
    // Only the farm list gates the first paint; everything else fills in. With
    // a persisted cache this is false from the first frame on a return visit.
    const isLoading = farmsQuery.isPending && farmsQuery.data == null;
    const isRefreshing = farmsQuery.isRefetching;
    // "Getting Started" checklist (onboarding-plan Phase 2, extending the
    // finish-setup nudge from Task 7 into real activation milestones, not
    // just pond count): set up ponds → log a first reading → invite your
    // team. It disappears on its own once every milestone is done — unlike a
    // reminder, a finished checklist has nothing left to say — and "Hide"
    // retires it for good, which is why that asks first.
    const [plannedPondCount, setPlannedPondCount] = useState<number | null>(null);
    const [hasLoggedSomething, setHasLoggedSomething] = useState<boolean | null>(null);
    const [hasInvitedWorker, setHasInvitedWorker] = useState<boolean | null>(null);
    // Starts hidden, not shown: reading the flag is async, and defaulting to
    // visible would flash the checklist at someone who retired it months ago.
    const [checklistHidden, setChecklistHidden] = useState(true);
    // Worker first-run interstitial — see WORKER_WELCOME_FLAG above.
    const [showWorkerWelcome, setShowWorkerWelcome] = useState(false);
    // Worker dashboard v1: tasks assigned to this worker, not yet done.
    const [myOpenTasks, setMyOpenTasks] = useState<Task[] | null>(null);
    // "Needs Attention" — the cross-pond alert severity data already proven in
    // MorningBriefingScreen, surfaced at the top of Home so a critical issue
    // in any pond doesn't sit unseen behind five other sections and a "Today"
    // tap (docs/UI_UX_AUDIT.md homepage redesign, Phase 1).
    const alertsQuery = useAppQuery({
        // Prefixed 'briefing' so a log invalidates it along with the Morning
        // Briefing screen — and so it is persisted for the first offline paint.
        queryKey: [...qk.briefing(), 'home'],
        queryFn: async () => {
            const [live, persisted] = await Promise.all([
                alertCenterApi.liveBriefing().catch(() => ({ data: [] as BriefingItem[] })),
                alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
            ]);
            // One shared merge — see utils/pondHealth.mergeBriefings for why
            // live and persisted must both be read, and why every screen has to
            // do it the same way.
            return mergeBriefings(live.data, persisted.data);
        },
    });
    const alerts = alertsQuery.data ?? EMPTY_ALERTS;
    const alertsLoading = alertsQuery.isPending && alertsQuery.data == null;
    // Actions deferred with "Later" — component state on purpose. It is a
    // "not right now", not a decision worth persisting: next time the farmer
    // opens Home the pond either still needs attention (so it comes back) or
    // it does not (so it is gone). Persisting would need an expiry policy for
    // something that expires naturally.
    const [deferred, setDeferred] = useState<string[]>([]);
    // Distinct from farms===[]: on a fetch FAILURE we must show a retry state,
    // not the "no farm data / create your first farm" CTA (which is for a genuinely
    // empty account). Conflating them pushes an existing owner to re-create a farm.
    const error = farmsQuery.isError ? farmsQuery.error : null;

    // Keep the GLOBAL active farm populated for the screens that need one (Team,
    // Inventory, the farm screens). This does not narrow Home — `scopeFarmId`
    // does, and it starts at null / all farms.
    useEffect(() => {
        const first = farms[0];
        if (!selectedFarm?.id && first) {
            setSelectedFarm({ id: first.id, name: first.name, location: (first as any).location });
        }
    }, [farms, selectedFarm?.id, setSelectedFarm]);

    /**
     * The three figures in artboard 1b's closing band.
     *
     * All three are enrichment: they load after the page has painted and are
     * simply absent if they fail. None is worth blocking Home on, and
     * TodayStats hides the band unless it has something real to show.
     */
    const statsQuery = useAppQuery({
        // Under 'home', which is persisted — this band is the part of Today a
        // farmer most wants to still see with no signal, stamped with its age.
        queryKey: [...qk.home(scopeFarmId), scopeFarms.map((f) => f.id).join(','), perms.canManageOperations],
        enabled: scopeFarms.length > 0,
        queryFn: async (): Promise<{
            contexts: PondContext[];
            homeBiomassKg: number | null;
            logsToday: { done: number; total: number } | null;
            onDutyToday: { present: number; total: number } | null;
        }> => {
        const absent = { contexts: [], homeBiomassKg: null, logsToday: null, onDutyToday: null };

        // One batched pond-context call per farm — see pondContextApi.forFarm.
        //
        // A farm that FAILS must not quietly contribute zero. These figures sit
        // under a header that says "All farms", so a sum missing one farm of
        // three is not an approximation, it is a wrong number presented as a
        // complete one — and "logs today" is worse than wrong, because the hero
        // reads it: every farm failing would leave total 0, which is
        // indistinguishable from "nothing is stocked" and would tell an owner
        // with nine stocked ponds to go and start their first cycle.
        //
        // So: any failure and the band goes absent. An absent figure sends a
        // farmer to pull-to-refresh; a confident wrong one sends them to act.
        const perFarm = await Promise.all(
            scopeFarms.map((f) =>
                pondContextApi
                    .forFarm(f.id)
                    .then((r) => r.data)
                    .catch(() => null),
            ),
        );
        if (perFarm.some((c) => c === null)) return absent;
        // Kept rather than discarded: the overview under the fold is the same
        // data asked a different question, and re-fetching it would double the
        // most expensive call on the screen.
        const contexts = (perFarm as NonNullable<(typeof perFarm)[number]>[]).flat();
        const sampled = contexts
            .map((c) => c.biomassKg)
            .filter((v): v is number => typeof v === 'number');
        // null, not 0 — an owner who has not sampled should see nothing here
        // rather than a confident zero next to a stocked pond.
        //
        // These are the SERVER's figures. A record the farmer logged with no
        // signal is not in them and must not be spliced in here — see
        // src/sync/pending.ts. It shows as a pending row on the pond instead.
        const homeBiomassKg = sampled.length ? sampled.reduce((a, b) => a + b, 0) : null;

        // "Logs today" out of the SAME snapshot — no extra round trips. A pond
        // counts as logged once anything has been recorded against it today;
        // only stocked ponds are counted, because an empty pond has no round
        // to miss and would otherwise sit in the denominator forever.
        const today = todayLocalISODate();
        const isToday = (iso: string | null | undefined) =>
            !!iso && toLocalISODate(new Date(iso)) === today;
        const stocked = contexts.filter((ctx) => ctx.cropId);
        const logsToday = {
            total: stocked.length,
            done: stocked.filter(
                (ctx) =>
                    isToday(ctx.lastFeedAt) ||
                    isToday(ctx.waterQuality?.recordedAt) ||
                    isToday(ctx.samplingAt),
            ).length,
        };

        // "On duty" is a manager's view of the roster, so it is gated the same
        // way the roster itself is.
        if (!perms.canManageOperations) {
            return { contexts, homeBiomassKg, logsToday, onDutyToday: null };
        }
        // Same rule as the contexts above: a roster we could not read is not a
        // roster of nobody. "3 of 5 on duty" with two farms silently missing is
        // a number a manager would act on.
        const rosters = await Promise.all(
            scopeFarms.map(async (f) => {
                const [att, members] = await Promise.all([
                    attendanceApi.getAll(f.id, todayLocalISODate()).then((r) => r.data).catch(() => null),
                    farmMembersApi.listMembers(f.id).then((r) => r.data).catch(() => null),
                ]);
                if (!att || !members) return null;
                return { present: new Set(att.map((a) => a.userId)).size, total: members.length };
            }),
        );
        if (rosters.some((r) => r === null)) {
            return { contexts, homeBiomassKg, logsToday, onDutyToday: null };
        }
        const complete = rosters as NonNullable<(typeof rosters)[number]>[];
        const total = complete.reduce((a, r) => a + r.total, 0);
        return {
            contexts,
            homeBiomassKg,
            logsToday,
            onDutyToday:
                total > 0 ? { present: complete.reduce((a, r) => a + r.present, 0), total } : null,
        };
        },
    });

    /**
     * The pond snapshots behind the band. Kept rather than discarded: the
     * overview under the fold is the same data asked a different question, and
     * re-fetching it would double the most expensive call on the screen.
     */
    const contexts = statsQuery.data?.contexts ?? EMPTY_CONTEXTS;
    const homeBiomassKg = statsQuery.data?.homeBiomassKg ?? null;
    const logsToday = statsQuery.data?.logsToday ?? null;
    const onDutyToday = statsQuery.data?.onDutyToday ?? null;

    /**
     * Can the Getting Started checklist still appear at all?
     *
     * It is retired, or the farmer is a worker who never sees it. Either way
     * the three fetches below have nothing to fill, and skipping them takes
     * three round trips off every visit to Today for the whole life of the
     * account. They cannot be skipped once it is merely COMPLETE — the
     * completeness is what they measure.
     */
    const checklistPossible = !checklistHidden && perms.canManageOperations;

    // Planned vs. actual pond count for the selected farm — one of the
    // Getting Started checklist items below.
    const fetchPlannedPondCount = useCallback(() => {
        if (!selectedFarm?.id || !checklistPossible) {
            setPlannedPondCount(null);
            return;
        }
        farmsApi
            .getById(selectedFarm.id)
            .then(({ data }) => setPlannedPondCount(data.plannedPondCount ?? null))
            .catch(() => setPlannedPondCount(null));
    }, [selectedFarm?.id, checklistPossible]);

    // React Navigation keeps this screen mounted across the stack, so a
    // mount-only effect never re-ran after e.g. PondSetup/CreatePond added a
    // pond and navigated back — the dashboard, pond list, and Getting
    // Started checklist all stayed stale until the app was force-restarted.
    // Refetch every time Home regains focus instead. `useRefetchOnFocus` only
    // refetches what is actually stale, so a quick tab bounce costs nothing but
    // the farmer's own write (which invalidates these keys) always lands.
    useRefetchOnFocus(qk.farms());
    useRefetchOnFocus(qk.ponds());
    useRefetchOnFocus(qk.briefing());
    useRefetchOnFocus(qk.home(scopeFarmId));
    useFocusEffect(
        useCallback(() => {
            fetchPlannedPondCount();
        }, [fetchPlannedPondCount]),
    );

    const onRefresh = useCallback(() => {
        void farmsQuery.refetch();
        void pondsQuery.refetch();
        void alertsQuery.refetch();
        void statsQuery.refetch();
        fetchPlannedPondCount();
    }, [farmsQuery, pondsQuery, alertsQuery, statsQuery, fetchPlannedPondCount]);

    const onRetry = useCallback(() => {
        void farmsQuery.refetch();
    }, [farmsQuery]);

    /**
     * The portfolio under the fold: each farm in scope with its ponds joined to
     * their snapshots and the briefing. Same three inputs the Farm tab uses, so
     * the two screens cannot disagree about which pond is in trouble.
     */
    const overviewFarms = React.useMemo(
        () =>
            scopeFarms.map((f) => ({
                id: f.id,
                name: f.name,
                rows: buildPondRows(
                    ponds.filter((p) => p.farmId === f.id),
                    contexts,
                    alerts,
                ),
            })),
        [scopeFarms, ponds, contexts, alerts],
    );

    /** The ponds in scope — every pond when showing all farms. */
    const scopePonds = React.useMemo(
        () => (scopeFarmId ? ponds.filter((p) => p.farmId === scopeFarmId) : ponds),
        [scopeFarmId, ponds],
    );

    // Alerts still worth acting on right now, narrowed to the farms in scope.
    // The alert endpoints span every farm the user can see, so without this
    // filter picking a farm would leave another farm's emergency in the hero.
    const nextActions = rankActions(alerts).filter((a) => {
        if (deferred.includes(a.pondId ?? a.topTitle)) return false;
        if (!scopeFarmId) return true;
        // A pond we have not loaded cannot be attributed, so it stays — an
        // unattributable alert is better shown in the wrong scope than hidden.
        const pond = a.pondId ? ponds.find((p) => p.id === a.pondId) : undefined;
        return !pond || pond.farmId === scopeFarmId;
    });
    // Everything after the hero's one item — artboard 1b's "Then" list.
    // Cap at the point of DISPLAY, not at the source. Then is a shortlist —
    // the full queue is behind its "View all" — but the severity map the
    // portfolio reads must stay complete.
    const thenActions = nextActions.slice(1, 5);

    /**
     * The setup step standing between this account and a screen with anything
     * on it, or null once there is none.
     *
     * A new farmer has no alerts, so the hero was empty and "All clear" took
     * its place — which claims nothing has gone wrong on a farm nothing is
     * watching yet. Today's job is "the next decision"; on day one the next
     * decision is setup, so it belongs in the hero like any other.
     *
     * Ordered by what unblocks the most: a pond can hold a cycle, a cycle can
     * be logged against, a log produces the readings every alert comes from.
     * `logsToday` counts STOCKED ponds, so its total doubles as "is anything
     * stocked" — it is null only until the enrichment call lands, and a hero
     * that flashes the wrong step for one frame is worse than one that waits.
     */
    const firstStep = React.useMemo(() => {
        if (isLoading || scopeFarms.length === 0 || logsToday == null) return null;
        const farm = scopeFarm ?? scopeFarms[0];

        if (scopePonds.length === 0) {
            // A worker cannot create ponds. Telling them to is worse than
            // telling them nothing, so they get the calm state instead.
            if (!perms.canManageOperations) return null;
            return {
                key: 'ponds',
                farm: farm?.name,
                headline: t('home.stepPondsTitle'),
                why: t('home.stepPondsWhy'),
                cta: t('home.stepPondsCta'),
                go: () => goRoot('PondSetup', { farmId: farm!.id, totalPonds: 1 }),
            };
        }
        if (logsToday.total === 0) {
            if (!perms.canManageOperations) return null;
            const pond = scopePonds[0];
            return {
                key: 'cycle',
                farm: farms.find((f) => f.id === pond.farmId)?.name,
                headline: t('home.stepCycleTitle', { pond: pond.displayName || pond.name }),
                why: t('home.stepCycleWhy'),
                cta: t('home.stepCycleCta'),
                go: () => goRoot('CreateCycle', { pondId: pond.id }),
            };
        }
        if (logsToday.done === 0) {
            return {
                key: 'log',
                farm: farm?.name,
                headline: t('home.stepLogTitle'),
                why: t('home.stepLogWhy'),
                cta: t('home.stepLogCta'),
                go: () => goRoot('QuickLog'),
            };
        }
        return null;
    }, [isLoading, scopeFarms, scopeFarm, scopePonds, logsToday, farms, perms.canManageOperations, t]);

    // Each item carries the farm it came from — Home spans every farm, so an
    // action without its farm name is ambiguous the moment you have two.
    // Resolves against the FULL farm list, not just the one in scope: an alert
    // from another farm previously rendered with no farm at all.
    const farmNameForPond = (pondId: string | null) => {
        if (!pondId) return undefined;
        const pond = ponds.find((pd) => pd.id === pondId);
        if (!pond) return scopeFarm?.name;
        return farms.find((f) => f.id === pond.farmId)?.name ?? scopeFarm?.name;
    };

    /**
     * "Wed 25 Aug · 3 farms · 24 ponds" — the header's context line.
     *
     * It counts what is IN SCOPE, not what exists: narrowing to one farm and
     * still being told you have three is the header contradicting its own
     * title. The farm count drops out entirely once there is only one.
     */
    const homeEyebrow = React.useMemo(() => {
        const parts = [formatWeekday(new Date())];
        if (scopeFarms.length > 1) parts.push(t('farms.countFarms', { count: scopeFarms.length }));
        if (scopePonds.length) parts.push(t('farms.countPonds', { count: scopePonds.length }));
        return parts.join(' · ');
    }, [scopeFarms.length, scopePonds.length, t]);

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
        if (!firstPond || !checklistPossible) {
            setHasLoggedSomething(false);
            return;
        }
        pondContextApi
            .get(firstPond.id)
            .then(({ data }) => setHasLoggedSomething(
                data.lastFeedAt != null || data.waterQuality?.recordedAt != null || data.samplingAt != null,
            ))
            .catch(() => setHasLoggedSomething(false));
    }, [selectedFarm?.id, ponds, checklistPossible]);

    // "Invited your team" — more than just the owner as a farm member.
    const fetchInvitedWorker = useCallback(() => {
        if (!selectedFarm?.id || !checklistPossible) {
            setHasInvitedWorker(null);
            return;
        }
        farmMembersApi
            .listMembers(selectedFarm.id)
            .then(({ data }) => setHasInvitedWorker(data.length > 1))
            .catch(() => setHasInvitedWorker(false));
    }, [selectedFarm?.id, checklistPossible]);

    useFocusEffect(fetchInvitedWorker);

    const checklistItems = [
        { key: 'ponds', done: pondsStepDone, label: t('home.checklistPonds', 'Set up your ponds') },
        { key: 'log', done: hasLoggedSomething ?? false, label: t('home.checklistLog', 'Log your first reading') },
        { key: 'invite', done: hasInvitedWorker ?? false, label: t('home.checklistInvite', 'Invite your team') },
    ];
    const checklistLoading = hasLoggedSomething == null || hasInvitedWorker == null;
    const checklistDoneCount = checklistItems.filter((i) => i.done).length;
    // Two of the three items (ponds, invite) are owner/manager actions — a
    // plain worker met every other render condition here and saw a checklist
    // nudging them toward actions they can't take. Gate the whole checklist
    // behind the same capability that gates those actions
    // (docs/UI_UX_AUDIT.md homepage redesign).
    const showGettingStarted =
        !checklistHidden && !!selectedFarm?.id && perms.canManageOperations && !checklistLoading && checklistDoneCount < checklistItems.length;

    // The retire-forever flag. Read once on mount; "Hide" writes it after the
    // farmer confirms, and nothing ever clears it.
    useEffect(() => {
        AsyncStorage.getItem(CHECKLIST_HIDDEN_FLAG)
            .then((flag) => setChecklistHidden(!!flag))
            // Unreadable storage must not permanently hide a setup aid, so a
            // failure falls back to showing it.
            .catch(() => setChecklistHidden(false));
    }, []);

    const dismissChecklistForever = () => {
        setChecklistHidden(true);
        AsyncStorage.setItem(CHECKLIST_HIDDEN_FLAG, '1').catch(() => {});
    };

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
        // Was gated on `perms.isWorker`. Artboard 1b gives "My tasks" to
        // EVERYONE — an owner is assigned work too, and hiding their own tasks
        // from them was the reason this section only ever appeared for workers.
        if (!user?.id) {
            setMyOpenTasks(null);
            return;
        }
        // Home spans every farm, so ask each one. `verified` is excluded but
        // `done` is NOT: a finished task waiting on a verifier is precisely
        // what 1b's "Verify" button is for.
        if (scopeFarms.length === 0) {
            setMyOpenTasks(null);
            return;
        }
        Promise.all(
            scopeFarms.map((f) =>
                tasksApi
                    .getAll(f.id, { assignedToId: user.id })
                    .then(({ data }) => (Array.isArray(data) ? data : (data as any)?.data ?? []))
                    .catch(() => [] as Task[]),
            ),
        )
            .then((lists) =>
                setMyOpenTasks(
                    lists.flat().filter((task: Task) => task.status !== 'verified'),
                ),
            )
            .catch(() => setMyOpenTasks(null));
    }, [scopeFarms, user?.id]);

    useFocusEffect(useCallback(() => { fetchMyTasks(); }, [fetchMyTasks]));


    /**
     * How much is still sitting on this phone.
     *
     * Deliberately a COUNT of records, not a contribution to any figure above —
     * a queued mortality does not move biomass or survival here (see
     * src/sync/pending.ts). Those come from the server, which has not seen it.
     */
    const pendingCount = useSyncStore((s) => s.queue.length + s.failedOperations.length);
    const isConnected = useSyncStore((s) => s.isConnected);

    // Root-stack screens (CreateFarm, PondDashboard, Settings…) live above the
    // tab navigator; navigate via the parent so they resolve from a tab.
    const goRoot = (screen: string, params?: any) =>
        navigation.getParent()?.navigate(screen, params) ?? navigation.navigate(screen, params);

    return (
        <ScreenWrapper
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[theme.roles.light.primary]} tintColor={theme.roles.light.primary} />
            }
        >
            {/*
              * Artboard 1b's header. The old one greeted the farmer by name,
              * which is the least useful thing a working screen can say at
              * 05:00. The eyebrow answers "what day is it and how much am I
              * responsible for"; the title answers "whose farm am I looking
              * at" — "All farms" until they narrow it.
              */}
            <ScreenHeader
                eyebrow={homeEyebrow}
                title={scopeFarm?.name ?? t('home.allFarms')}
                actionLabel={farms.length > 1 ? t('home.filter') : undefined}
                onAction={() => setShowFarmFilter((v) => !v)}
                onMore={() => navigation.navigate('Settings')}
            />

            {/* The whole screen is the server's numbers. If they are the last
                copy rather than a fresh one, say so and say how old. */}
            <CacheNotice
                updatedAt={farmsQuery.dataUpdatedAt}
                stale={farmsQuery.isError || statsQuery.isError}
            />

            {/* Everything the farmer has saved that has not reached the server
                yet. One row, always the same place, tappable through to the
                full list — the answer to "did my reading actually save". */}
            {pendingCount > 0 && (
                <SummaryRow
                    icon="schedule"
                    title={t('sync.pendingSectionTitle')}
                    subtitle={isConnected ? t('sync.waitingBodyOnline') : t('sync.waitingBodyOffline')}
                    value={String(pendingCount)}
                    tone="warning"
                    onPress={() => goRoot('SyncStatus')}
                />
            )}

            {/* The farm switcher the header's "Filter" opens. 1b puts the
                current scope in the TITLE, so a permanent second bar restating
                it would be a duplicate — this exists only while it is open.
                Picking a farm also sets the app-wide active farm so Team and
                Inventory follow you; "All farms" only widens Home. */}
            {showFarmFilter && (
                <View style={styles.filterList}>
                    <TouchableOpacity
                        style={styles.filterRow}
                        onPress={() => { setScopeFarmId(null); setShowFarmFilter(false); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: scopeFarmId === null }}
                    >
                        <Text style={[styles.filterLabel, scopeFarmId === null && styles.filterLabelActive]}>
                            {t('home.allFarms')}
                        </Text>
                        {scopeFarmId === null && <Icon name="check" size={20} color={theme.roles.light.primary} />}
                    </TouchableOpacity>
                    {farms.map((f) => (
                        <TouchableOpacity
                            key={f.id}
                            style={styles.filterRow}
                            onPress={() => {
                                setScopeFarmId(f.id);
                                setSelectedFarm({ id: f.id, name: f.name });
                                setShowFarmFilter(false);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: scopeFarmId === f.id }}
                        >
                            <Text style={[styles.filterLabel, scopeFarmId === f.id && styles.filterLabelActive]}>
                                {f.name}
                            </Text>
                            {scopeFarmId === f.id && <Icon name="check" size={20} color={theme.roles.light.primary} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {isLoading ? (
                <View style={styles.loadingBlock}>
                    <Skeleton width="100%" height={220} />
                    <Skeleton width="100%" height={64} />
                    <Skeleton width="100%" height={64} />
                </View>
            ) : error && farms.length === 0 ? (
                // The request failed and nothing is cached. This must NOT fall
                // through to the create-a-farm empty state: an owner who is
                // merely offline would be told to re-create their farm.
                <ErrorState
                    title={t('home.summaryErrorTitle', "Couldn't load your dashboard")}
                    error={error}
                    onRetry={onRetry}
                />
            ) : farms.length === 0 ? (
                /* Artboard 09 — the first-run dashboard. Two routes, always:
                   the old either/or branched on a global owner/worker flag, so
                   someone who picked "worker" at signup was never shown "Create
                   farm" even after leasing a pond. Neither is a real constraint —
                   any account can create a farm or join one. Both are offered as
                   equals rather than a primary button and a lesser outlined one. */
                <View style={styles.emptyFarms}>
                    <EmptyPondArt />
                    <Text style={styles.emptyTitle}>{t('home.noFarmsYet')}</Text>
                    <View style={styles.emptyCards}>
                        <EmptyChoice
                            icon="warehouse"
                            title={t('home.quickLogCreateFarm')}
                            subtitle={t('home.createFarmCardSub')}
                            onPress={() => goRoot('CreateFarm')}
                        />
                        <EmptyChoice
                            icon="qr_code_scanner"
                            title={t('home.joinCodeCardTitle')}
                            subtitle={t('home.joinCodeCardSub')}
                            onPress={() => goRoot('JoinFarm')}
                        />
                    </View>
                </View>
            ) : (
                <>
                    {/* Worker first-run interstitial (onboarding-plan Phase 1):
                        a worker previously got zero explanation of their role or
                        which farm they had joined on their very first app-open.
                        One-time, dismissible, never blocks what is underneath. */}
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

                    {/* "Do this first" — the redesign's centrepiece (artboard 1b).
                        Home used to open on a LIST of alerts, which makes the farmer
                        rank severity, pond and farm before they can act. This does the
                        ranking and states ONE action; the list below becomes "then". */}
                    {!alertsLoading && nextActions.length > 0 && (
                        <NextActionCard
                            items={nextActions}
                            farmNameForPond={farmNameForPond}
                            onDone={(group) => {
                                // Recording the reading is what actually clears the
                                // alert, so send them to the log rather than
                                // optimistically marking it resolved here. The whole
                                // GROUP is deferred, not one pond of it: a farm-wide
                                // finding that reappeared pond by pond after each tap
                                // would be five heroes for one decision.
                                setDeferred((d) => [...d, ...deferKeys(group)]);
                                goRoot(
                                    'QuickLog',
                                    group.pondIds.length === 1 ? { pondId: group.pondIds[0] } : undefined,
                                );
                            }}
                            onLater={(group) => setDeferred((d) => [...d, ...deferKeys(group)])}
                        />
                    )}

                    {/* Before there is anything to raise an alert about, the hero
                        carries the setup step blocking everything else instead.
                        A new account has no alerts, and this slot standing empty
                        is what made a fresh Today read as broken. No "Later":
                        there is nothing to defer this in favour of. */}
                    {!alertsLoading && nextActions.length === 0 && !!firstStep && (
                        <HeroCard
                            eyebrow={t('home.startHere')}
                            farm={firstStep.farm}
                            headline={firstStep.headline}
                            why={firstStep.why}
                            primaryLabel={firstStep.cta}
                            onPrimary={firstStep.go}
                        />
                    )}

                    {/*
                      * "Then" — the rest of the queue, after the hero has taken the
                      * top item. This replaces the old "Needs Attention" card, which
                      * listed alert titles in identical styling with no farm and no
                      * reason, so every row had to be opened to find out whether it
                      * mattered. Its "All ›" is the only route left to the full
                      * Morning Briefing now that the quick-actions grid is gone.
                      */}
                    {!alertsLoading && (
                        thenActions.length > 0 ? (
                            <ThenList
                                items={thenActions}
                                farmNameForPond={farmNameForPond}
                                onSeeAll={() => goRoot('MorningBriefing')}
                                onOpen={(item) =>
                                    item.pondId
                                        ? goRoot('PondDashboard', { pondId: item.pondId })
                                        : goRoot('MorningBriefing')
                                }
                            />
                        ) : nextActions.length === 0 && !firstStep ? (
                            // All clear is a RESULT, not an empty list — and it only
                            // means anything once there is something to be clear
                            // about. With setup unfinished it claimed nothing had
                            // gone wrong on a farm nothing was watching yet, so it
                            // waits until the hero has no setup step left to show.
                            <TouchableOpacity activeOpacity={0.85} onPress={() => goRoot('MorningBriefing')}>
                                <Card style={styles.allClearCard}>
                                    <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.roles.light.successText} />
                                    <View style={styles.allClearText}>
                                        <Text style={styles.allClearTitle}>{t('home.allClearTitle', 'All clear')}</Text>
                                        <Text style={styles.allClearBody}>{t('home.allClearBody', 'No issues need your attention right now.')}</Text>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ) : null
                    )}

                    {/* "My tasks" — mine only. The Team tab shows the whole team's. */}
                    <MyTasksList
                        tasks={myOpenTasks ?? []}
                        farmNameForTask={(task) => farms.find((f) => f.id === task.farmId)?.name}
                        // The whole board, not just mine — an owner who has
                        // handed every task to someone else still has to see
                        // whether it is getting done.
                        onSeeAll={() => navigation.navigate('Team')}
                        onOpen={(task) =>
                            goRoot('TaskList', {
                                farmId: task.farmId,
                                farmName: farms.find((f) => f.id === task.farmId)?.name,
                                // Carry the assignee through — without it this opens the
                                // whole farm's task list, which is the Team tab's job.
                                assignedToId: user?.id,
                            })
                        }
                    />

                    {/* The three figures that close 1b. */}
                    <TodayStats
                        biomassKg={homeBiomassKg}
                        logsToday={logsToday}
                        onDuty={onDutyToday}
                    />

                    {/* Molting status. Not in 1b, and dropping it was a mistake:
                        a soft-shelled pond is fed less and never handled, which
                        is a decision about today. It costs no request — the
                        phase is arithmetic on the date. */}
                    <LunarRow onPress={() => goRoot('Lunar')} />

                    {/* Everything above answers "what needs me now" and then
                        stops, so on a calm day the screen ran out of things to
                        say halfway down. This is the other half: what the whole
                        business looks like. It repeats nothing — the hero names
                        ONE pond, this names every farm and its shape. */}
                    <FarmOverview
                        farms={overviewFarms}
                        onOpenFarm={(farmId, farmName) =>
                            goRoot('FarmDetail', { farmId, farmName })
                        }
                        onSeeAll={() => navigation.navigate('Farms')}
                    />

                    {/* Getting Started (onboarding-plan Phase 2). Not in 1b —
                        1b draws an established farm — so it is the quietest
                        thing on the page and it goes below the band: setup
                        advice must not outrank a dying pond. It disappears for
                        good once every milestone is done, or when the farmer
                        confirms they want it gone. */}
                    {showGettingStarted && (
                        <GettingStarted
                            items={checklistItems}
                            onSelect={(key) => {
                                if (key === 'ponds') goRoot('PondSetup', { farmId: selectedFarm!.id, totalPonds: remainingPonds || 1 });
                                else if (key === 'log') goRoot('QuickLog');
                                else if (key === 'invite') goRoot('AddWorker', { farmId: selectedFarm!.id });
                            }}
                            onDismissForever={dismissChecklistForever}
                        />
                    )}
                </>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    filterList: {
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    filterRow: {
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        minHeight: 48,
        justifyContent: 'center',
    },
    // The scope menu rows. Deliberately plain: this is a menu, not a section
    // of the page, so it borrows nothing from the redesign vocabulary below.
    filterLabelActive: { fontFamily: 'DMSans-SemiBold', color: theme.roles.light.primary },
    loadingBlock: { gap: theme.spacing[3], padding: theme.spacing[4] },
    filterLabel: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary },
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
    ctaBtn: { alignSelf: 'stretch', marginTop: theme.spacing[2] },
    emptyFarms: { alignItems: 'center', paddingVertical: theme.spacing[8], marginBottom: theme.spacing[4] },
    emptyTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[6],
    },
    emptyCards: { alignSelf: 'stretch', gap: theme.spacing[3] },
    emptyChoice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        minHeight: 72,
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderStrong,
        backgroundColor: theme.roles.light.surface,
    },
    emptyChoiceText: { flex: 1, minWidth: 0, gap: 2 },
    emptyChoiceTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    emptyChoiceSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
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
    // Used when a Card is nested inside a `statCardTouchable` wrapper — the
    // width belongs on the wrapper so 47%-of-47% doesn't double-shrink it.
});
