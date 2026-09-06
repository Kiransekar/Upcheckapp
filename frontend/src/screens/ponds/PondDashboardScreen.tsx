/**
 * Pond — artboard p1.
 *
 * Two things changed, and both are about what a farmer opens this screen FOR.
 *
 * 1. If the pond has a problem, it is now the first thing on the page, in words
 *    ("Oxygen 2.8 mg/L — start aerators") with a way to act. It used to be a
 *    generic "log your water quality" banner that said nothing about this pond.
 *
 * 2. The numbers come from pond-context — the same snapshot the decision engines
 *    read — instead of being recomputed here from samplings, harvests and feed
 *    totals. That removed a five-call chain AND a second definition of biomass
 *    and FCR that could disagree with the engines' own.
 *
 * The fourteen log types stay. Six sit on the surface (the daily loop) and the
 * rest collapse to one line, which is the design's compromise between "the app
 * can log anything" and "I have to feed the shrimp".
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { StatRow, type Stat } from '../../components/ui/StatRow';
import { Icon, type IconName } from '../../components/ui/Icon';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { SessionHint, AgeHint } from '../../components/ui/SessionHint';
import { theme } from '../../theme';
import { pondsApi, type Pond } from '../../api/ponds';
import { cropsApi, type Crop } from '../../api/crops';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { activityApi, type ActivityItem } from '../../api/activity';
import { ACTIVITY_ICON, activityKindKey } from '../activity/activityKinds';
import { slotAt, pondSlotDone, pondFedThisSession, chemistryDone, pondFreshness } from '../../features/logProgress';
import { requiresActiveCycle } from '../../features/cycleRequirement';
import { survivalPctFrom } from '../calculators/prefill';
import { alertCenterApi, type BriefingItem } from '../../api/alertCenter';
import { pnlApi, type CropPnl } from '../../api/pnl';
import { useMembershipStore } from '../../store/membershipStore';
import { usePermissions } from '../../hooks/usePermissions';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';
import { usePendingRecords } from '../../sync/pending';
import { formatTime, formatAge } from '../../utils/formatDate';
import { pondLabel } from '../../utils/pondHealth';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';

/** The create form already names these; the detail view must not re-word them. */
const SHAPE_KEY: Record<string, string> = {
    rectangular: 'ponds.shapeRect',
    circular: 'ponds.shapeCircular',
    raceway: 'ponds.shapeRaceway',
    irregular: 'ponds.shapeIrregular',
};
const CONSTRUCTION_KEY: Record<string, string> = {
    earthen: 'ponds.constructionEarthen',
    lined: 'ponds.constructionLined',
    cage: 'ponds.constructionCage',
    biofloc_ras: 'ponds.constructionBioflocRas',
};

type LogMode = 'log' | 'history';

interface LogAction {
    key: string;
    icon: IconName;
    logRoute: string;
    historyRoute: string;
    /** The daily loop — shown without expanding. */
    core?: boolean;
}

/**
 * Ordered most-used first. The six core actions are what a farmer touches every
 * day or week; the remaining eight are occasional clinical and lab logs.
 */
const LOG_ACTIONS: LogAction[] = [
    { key: 'actionWaterQuality', icon: 'water_drop', logRoute: 'WaterQualityLog', historyRoute: 'WaterQualityHistory', core: true },
    { key: 'actionFeed', icon: 'grain', logRoute: 'FeedLog', historyRoute: 'FeedHistory', core: true },
    { key: 'actionDailyRoutine', icon: 'checklist', logRoute: 'DailyRoutine', historyRoute: 'DailyRoutine', core: true },
    { key: 'actionSampling', icon: 'scale', logRoute: 'SamplingLog', historyRoute: 'SamplingHistory', core: true },
    { key: 'actionMeasurements', icon: 'show_chart', logRoute: 'Measurements', historyRoute: 'Measurements', core: true },
    { key: 'actionAdvisor', icon: 'lightbulb', logRoute: 'EnginesHub', historyRoute: 'EnginesHub', core: true },
    // Promoted to the surface. Harvest history was reachable only by finding
    // the mode toggle AND then expanding "+8 more log types" — two discoveries
    // deep for the record of what actually came out of the pond.
    { key: 'actionHarvest', icon: 'set_meal', logRoute: 'HarvestLog', historyRoute: 'HarvestHistory', core: true },
    { key: 'actionTreatment', icon: 'science', logRoute: 'TreatmentLog', historyRoute: 'TreatmentHistory' },
    { key: 'actionMortality', icon: 'warning', logRoute: 'MortalityLog', historyRoute: 'MortalityHistory' },
    { key: 'actionDisease', icon: 'science', logRoute: 'DiseaseLog', historyRoute: 'DiseaseHistory' },
    { key: 'actionChemical', icon: 'science', logRoute: 'ChemicalLog', historyRoute: 'ChemicalHistory' },
    { key: 'actionPlankton', icon: 'grass', logRoute: 'PlanktonLog', historyRoute: 'PlanktonHistory' },
    { key: 'actionMicrobiology', icon: 'science', logRoute: 'MicrobiologyLog', historyRoute: 'MicrobiologyHistory' },
    // History goes to the dedicated chemistry history, NOT back to the blank
    // entry form ("History" that reopened the form it came from was the whole
    // of report #9). It was pointed at WaterQualityHistory because weekly-chem
    // readings land in `water_quality_records` and that was the only screen
    // reading them — but that list is dominated by daily probe rows, so the six
    // chemistry values were buried. WeeklyChemistryHistory reads the same table
    // through `chemistryOnly=true`, which drops the probe-only rows.
    { key: 'actionWeeklyChem', icon: 'calendar_month', logRoute: 'WeeklyChemistry', historyRoute: 'WeeklyChemistryHistory' },
];

/**
 * Whether this action is done for the CURRENT session, or `undefined` when
 * "done" has no meaning for it.
 *
 * Every answer here comes from features/logProgress.ts — the single definition
 * the reminders, the Today card and SessionHint also read. A second rule for
 * "logged" written on this screen is exactly the drift that module exists to
 * prevent, so there is none: this only routes a tile to the right predicate.
 *
 * `undefined` is not "not done". Eleven of the fourteen log types have no
 * cadence the app knows about — a mortality is not owed three times a day — and
 * an empty circle on those would read as a chore the farmer is behind on.
 */
export const tileDone = (
    ctx: PondContext | null | undefined,
    key: string,
    now: Date,
): boolean | undefined => {
    if (!ctx) return undefined;
    switch (key) {
        case 'actionWaterQuality':
            return pondSlotDone(ctx, slotAt(now), now);
        case 'actionFeed':
            return pondFedThisSession(ctx, slotAt(now), now);
        case 'actionWeeklyChem':
            return chemistryDone(ctx, now);
        default:
            return undefined;
    }
};

/**
 * The calendar day the farmer is standing in, as an instant range.
 *
 * Local midnight to the last millisecond of the day, in the phone's own
 * timezone — "today" is a calendar question, not a 24-hour window.
 */
export const todayRange = (now: Date): { from: string; to: string } => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
};

const num = (v: number | null | undefined, digits = 1): string =>
    v == null ? '—' : v.toFixed(digits);

const inr = (n: number): string => {
    const a = Math.abs(n);
    if (a >= 1e7) return `₹${(a / 1e7).toFixed(2)}Cr`;
    if (a >= 1e5) return `₹${(a / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `₹${(a / 1e3).toFixed(1)}k`;
    return `₹${Math.round(a)}`;
};

/**
 * `inr` takes the absolute value, so a loss and a profit of the same size print
 * identically. Money that went the wrong way must say so in the CHARACTERS, not
 * only in the colour — this screen is read in the sun, and red/green is the one
 * pair a colour-blind farmer cannot separate.
 */
const signedInr = (n: number): string => (n < 0 ? `−${inr(n)}` : inr(n));

const timeAgo = (iso?: string | null): string | null => {
    if (!iso) return null;
    const ms = Date.now() - Date.parse(iso);
    if (Number.isNaN(ms) || ms < 0) return null;
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
};

export const PondDashboardScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName } = route.params;
    const loadMemberships = useMembershipStore((s) => s.load);

    /** The P&L on show, and WHICH cycle it belongs to — see the effect below. */
    const [money, setMoney] = useState<
        { pnl: CropPnl; cycleName: string | null; closed: boolean } | null
    >(null);
    const [mode, setMode] = useState<LogMode>('log');
    const [showAll, setShowAll] = useState(false);

    /**
     * The pond, its cycle, its snapshot and its alert — one cached, persisted
     * read. Offline this paints from the last visit; every figure it shows is
     * the server's, stamped with the age via CacheNotice below.
     */
    const query = useAppQuery({
        queryKey: qk.pond(pondId),
        enabled: !!pondId,
        queryFn: async () => {
            const { data: pondData } = await pondsApi.getById(pondId);
            // Everything below needs only the pond (and its cycle id), so it all
            // goes out at once rather than in a chain.
            const [ctxRes, cycleRes, briefRes] = await Promise.all([
                pondContextApi.get(pondId).catch(() => ({ data: null as PondContext | null })),
                pondData.activeCycleId
                    ? cropsApi.getById(pondData.activeCycleId).catch(() => ({ data: null as Crop | null }))
                    : Promise.resolve({ data: null as Crop | null }),
                alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
            ]);
            return {
                pond: pondData,
                context: ctxRes.data,
                cycle: cycleRes.data,
                alert: briefRes.data.find((b) => b.pondId === pondId && b.topSeverity !== 'info') ?? null,
            };
        },
    });

    /**
     * Today's entries for this pond.
     *
     * ONE read of `/activity`, which unions all fourteen log tables server-side.
     * This used to be two calls — water quality and feed — filtered to today on
     * the phone, which meant a sampling, a treatment or a mortality recorded
     * this morning simply did not appear in "what have we already done today".
     *
     * The key still PREFIXES `['pond']`, so it persists to disk with the rest of
     * the pond and the axios invalidation table refetches it after the farmer's
     * own write with no new plumbing.
     */
    const todayQuery = useAppQuery({
        queryKey: [...qk.pond(pondId), 'today'] as const,
        enabled: !!pondId,
        queryFn: async () => {
            const { data } = await activityApi.list({
                pondId,
                ...todayRange(new Date()),
                limit: 50,
            });
            return data.items;
        },
    });
    const today: ActivityItem[] = todayQuery.data ?? [];

    const pond = query.data?.pond ?? null;
    const cycle = query.data?.cycle ?? null;
    const context = query.data?.context ?? null;
    const alert = query.data?.alert ?? null;
    const hasData = query.data != null;
    const offline = query.isError && !(query.error as any)?.response;

    const perms = usePermissions(pond?.farmId);

    /**
     * Records this farmer saved against THIS pond that have not reached the
     * server yet. Without this the pond looked untouched right after a log with
     * no signal — "Saved — will sync" and then nothing, which is the complaint.
     *
     * These are shown as their own rows and are deliberately NOT mixed into the
     * figures above. See src/sync/pending.ts for why that line must not be
     * crossed: a queued mortality changing `livePopulation`, or a queued
     * sampling changing `biomassKg`, would put a confident wrong number in front
     * of a farmer about to act on it.
     */
    const pendingHere = usePendingRecords({ pondId });

    useRefetchOnFocus(qk.pond(pondId));
    useFocusEffect(
        useCallback(() => {
            loadMemberships();
        }, [loadMemberships]),
    );

    /*
     * The money for this pond — a separate, permissioned call a worker never
     * triggers.
     *
     * It falls back to the LAST CLOSED cycle, and that is the whole bug the
     * farmer reported. A full harvest calls `closeCycle`, which nulls
     * `pond.activeCycleId` and sets the pond fallow — so the moment they logged
     * the harvest that realised their profit, this fetch short-circuited and the
     * entire money section unmounted. The pond went from showing a cost to
     * showing nothing, triggered by the exact action that made the profit
     * knowable.
     *
     * The fallback is one call, not a fan-out: `GET /crops?pondId=` already
     * returns this pond's cycles ordered createdAt DESC, so the most recent
     * `completed` one is the first match. It only runs when there is no active
     * cycle, which is precisely when there is nothing else to show.
     */
    useFocusEffect(
        useCallback(() => {
            if (!perms.canViewFinancials || !pond?.id) {
                setMoney(null);
                return;
            }
            let alive = true;
            (async () => {
                try {
                    let target: { id: string; name: string | null; closed: boolean } | null =
                        pond.activeCycleId ? { id: pond.activeCycleId, name: null, closed: false } : null;
                    if (!target) {
                        const { data } = await cropsApi.getAll(pond.id);
                        const last = (Array.isArray(data) ? data : []).find(
                            (c) => c.status === 'completed',
                        );
                        if (last) target = { id: last.id, name: last.name, closed: true };
                    }
                    if (!target) {
                        if (alive) setMoney(null);
                        return;
                    }
                    const { data } = await pnlApi.cropPnl(target.id);
                    if (alive) setMoney({ pnl: data, cycleName: target.name, closed: target.closed });
                } catch {
                    if (alive) setMoney(null);
                }
            })();
            return () => {
                alive = false;
            };
        }, [perms.canViewFinancials, pond?.id, pond?.activeCycleId]),
    );

    /**
     * Survival = live population over what was stocked, but only once a
     * sampling exists. Without one this rendered 100% directly above a card
     * saying survival cannot be worked out without a sampling (QA BUG-019).
     */
    const survival = useMemo(() => survivalPctFrom(context), [context]);

    /** Days between today and the cycle's target length. */
    const daysToTarget = useMemo(() => {
        const target = context?.crop?.targetCultivationDays;
        if (target == null || context?.doc == null) return null;
        return target - context.doc;
    }, [context]);

    /**
     * Which LOG destinations this pond cannot use right now.
     *
     * Per tile, not per screen. The gate is `features/cycleRequirement.ts` —
     * the same module QuickLog asks — so the two screens cannot disagree about
     * what a pond with no cycle may record. Notably water quality stays open:
     * `water_quality_records` has no crop column, and pond chemistry between
     * cycles is exactly what says whether the pond is fit to stock.
     *
     * History is never gated. A closed cycle's record is the main thing a
     * farmer comes back for.
     */
    const isLocked = (action: LogAction): boolean =>
        mode === 'log' && !cycle && requiresActiveCycle(action.logRoute);

    const openAction = (action: LogAction) => {
        // A locked tile is not dead — it goes where the lock is lifted.
        if (isLocked(action)) {
            navigation.navigate('CreateCycle', { pondId });
            return;
        }
        const params: Record<string, any> = { pondId, pondName };
        if (cycle) params.cropId = cycle.id;
        if (pond?.farmId) params.farmId = pond.farmId;
        navigation.navigate(mode === 'log' ? action.logRoute : action.historyRoute, params);
    };

    const wq = context?.waterQuality;
    const readingAgo = timeAgo(wq?.recordedAt);

    // A surveyed area is a measurement of the real pond; the calculated one
    // is a rectangle worth of arithmetic. Where both exist the survey wins,
    // exactly as the create form decides it.
    const areaM2 = Number(pond?.overrideAreaM2) || Number(pond?.calculatedAreaM2) || 0;

    /** "80 × 45 × 1.4 m" or "⌀ 20 × 1.4 m" — only the parts that exist. */
    const dimensionLine = (() => {
        if (!pond) return '—';
        const n = (v: unknown) => (v == null || v === '' ? null : String(v));
        const parts = pond.geometryType === 'circular'
            ? [n(pond.diameterM) ? `⌀ ${n(pond.diameterM)}` : null]
            : [n(pond.lengthM), n(pond.widthM)];
        const all = [...parts, n(pond.depthM)].filter(Boolean);
        return all.length ? `${all.join(' × ')} m` : '—';
    })();

    /** "4 units · 8 HP · 22 HP/ha" — the last is what a pond is judged by. */
    const aeratorLine = (() => {
        const count = Number(pond?.aeratorCount) || 0;
        const hp = Number(pond?.installedAeratorHp) || 0;
        if (!count && !hp) return '—';
        const hectares = areaM2 / 10000;
        return [
            count ? t('ponds.aeratorCountValue', { count }) : null,
            hp ? `${hp} HP` : null,
            hp > 0 && hectares > 0 ? `${Math.round(hp / hectares)} HP/ha` : null,
        ].filter(Boolean).join(' · ');
    })();

    const header = (
        <ScreenHeader
            eyebrow={pond ? t(`ponds.status_${pond.status}`, { defaultValue: pond.status }) : null}
            // The pond's own label once it has loaded — the route param is
            // whatever the previous screen happened to pass, and one of them
            // passed ''. `pondLabel` is the single definition of that name.
            title={pond ? pondLabel(pond) : (pondName ?? t('ponds.title'))}
            onBack={() => navigation.goBack()}
            accessibilityBackLabel={t('common.back')}
            actionLabel={perms.canManageOperations ? t('common.edit') : undefined}
            onAction={() =>
                navigation.navigate('CreatePond', {
                    farmId: pond?.farmId,
                    farmName: undefined,
                    editPondId: pondId,
                })
            }
        />
    );

    if (query.isPending && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.skeleton}>
                    <Skeleton width="100%" height={72} style={styles.mb} />
                    <Skeleton width="100%" height={56} style={styles.mb} />
                    <Skeleton width="100%" height={140} />
                </View>
            </ScreenWrapper>
        );
    }

    // Only when there is no cached copy at all. With one, the pond renders from
    // it and CacheNotice says how old it is — a failed read must never look
    // like an empty pond.
    if (query.isError && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                {offline ? (
                    <NetworkError onRetry={() => query.refetch()} />
                ) : (
                    <ErrorState title={t('ponds.errorPondTitle')} error={query.error} onRetry={() => query.refetch()} />
                )}
            </ScreenWrapper>
        );
    }

    // Recording a harvest needs RECORD_HARVEST; READING the history does not,
    // so the tile only disappears in log mode.
    const allowedActions =
        mode === 'log' && !perms.canRecordHarvest
            ? LOG_ACTIONS.filter((a) => a.key !== 'actionHarvest')
            : LOG_ACTIONS;
    const visibleActions = showAll ? allowedActions : allowedActions.filter((a) => a.core);
    const hiddenCount = allowedActions.length - allowedActions.filter((a) => a.core).length;
    const now = new Date();

    /*
     * The toggle, the tiles and the expander — one block, rendered whether or
     * not a cycle is running. Two changes to why the two history complaints
     * existed at all:
     *
     *  - The tile now SAYS which of the two things it will do. A clock badge in
     *    history mode, a tick badge in log mode, and one line of prose under
     *    the toggle. A control that silently changes every destination on the
     *    page, with nothing on the destinations to show it, is not a control a
     *    farmer can find by accident.
     *  - The tick is the same "done" the reminders use (see `tileDone`), and it
     *    is a different GLYPH, not a different colour, because this screen is
     *    read at midday in the sun on a ₹6,000 phone.
     *
     * With no cycle the toggle still works: only the CROP-KEYED log tiles lock
     * (see `isLocked`), and a locked tile opens CreateCycle rather than doing
     * nothing.
     */
    const actionsBlock = (
        <>
            <View style={styles.modeRow}>
                <ModeButton
                    label={t('ponds.tabLogData')}
                    active={mode === 'log'}
                    onPress={() => setMode('log')}
                />
                <ModeButton
                    label={t('ponds.tabViewHistory')}
                    active={mode === 'history'}
                    onPress={() => setMode('history')}
                />
            </View>
            <Text style={styles.modeHint}>
                {t(mode === 'log' ? 'ponds.modeHintLog' : 'ponds.modeHintHistory')}
            </Text>

            <View style={styles.grid}>
                {visibleActions.map((action) => {
                    const locked = isLocked(action);
                    const done = locked || mode !== 'log' ? undefined : tileDone(context, action.key, now);
                    const label = t(`ponds.${action.key}`);
                    return (
                        <TouchableOpacity
                            key={action.key}
                            testID={`pond-tile-${action.key}`}
                            style={[styles.gridTile, locked && styles.gridTileLocked]}
                            onPress={() => openAction(action)}
                            accessibilityRole="button"
                            /*
                             * Deliberately NOT accessibilityState.disabled: a
                             * locked tile still responds — it opens CreateCycle
                             * — and announcing a working control as disabled
                             * tells a screen-reader user not to try the one
                             * thing that unlocks it. The lock is carried by the
                             * label, the icon and the visible hint instead.
                             */
                            accessibilityState={done === undefined ? undefined : { checked: done }}
                            accessibilityLabel={[
                                label,
                                locked
                                    ? t('ponds.tileNeedsCycle')
                                    : t(mode === 'log' ? 'ponds.modeHintLog' : 'ponds.modeHintHistory'),
                                done === undefined ? null : t(done ? 'ponds.tileDone' : 'ponds.tilePending'),
                            ]
                                .filter(Boolean)
                                .join(', ')}
                        >
                            <View style={styles.tileBadge}>
                                {locked ? (
                                    <Icon name="key" size={13} color={theme.roles.light.textTertiary} />
                                ) : mode === 'history' ? (
                                    <Icon name="schedule" size={13} color={theme.roles.light.textTertiary} />
                                ) : done === undefined ? null : (
                                    <Icon
                                        name={done ? 'check_circle' : 'radio_button_unchecked'}
                                        size={13}
                                        color={done ? theme.roles.light.successText : theme.roles.light.textTertiary}
                                    />
                                )}
                            </View>
                            <Icon
                                name={action.icon}
                                size={20}
                                color={locked ? theme.roles.light.textDisabled : theme.roles.light.textSecondary}
                            />
                            <Text
                                style={[styles.gridLabel, locked && styles.gridLabelLocked]}
                                numberOfLines={1}
                            >
                                {label}
                            </Text>
                            {/* Not colour alone — the reason is spelled out. */}
                            {locked && (
                                <Text style={styles.gridLockedHint} numberOfLines={1}>
                                    {t('ponds.tileNeedsCycle')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {hiddenCount > 0 && (
                <TouchableOpacity
                    style={styles.moreRow}
                    onPress={() => setShowAll((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showAll }}
                >
                    <Text style={styles.moreLabel}>
                        {showAll ? t('ponds.showLess') : t('ponds.moreLogTypes', { count: hiddenCount })}
                    </Text>
                </TouchableOpacity>
            )}
        </>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={query.isRefetching}
                        onRefresh={() => {
                            void query.refetch();
                            void todayQuery.refetch();
                        }}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                {/*
                  * WHAT THE APP GUESSED, said out loud.
                  *
                  * Onboarding creates ponds without asking for shape,
                  * construction or area — the right trade in front of someone
                  * who has not seen the app yet. But the result was
                  * indistinguishable from an answer the farmer gave: the page
                  * rendered "Earthen" and an area with the same confidence as a
                  * surveyed figure, and volume, aeration adequacy and every
                  * dosing number downstream read them.
                  *
                  * So the guess is labelled rather than hidden, and answering
                  * any of it retires that label (backend `assumedFields`).
                  */}
                {(pond?.assumedFields?.length ?? 0) > 0 && (
                    <TouchableOpacity
                        testID="unconfirmed-banner"
                        style={styles.unconfirmed}
                        accessibilityRole="button"
                        disabled={!perms.canManageOperations}
                        onPress={() =>
                            navigation.navigate('CreatePond', {
                                farmId: pond?.farmId,
                                editPondId: pondId,
                            })
                        }
                    >
                        <Icon name="warning" size={20} color={theme.roles.light.warningText} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.unconfirmedTitle}>
                                {t('ponds.unconfirmedTitle')}
                            </Text>
                            <Text style={styles.unconfirmedBody}>
                                {t('ponds.unconfirmedBody', {
                                    fields: (pond?.assumedFields ?? [])
                                        .map((f) => t(`ponds.assumed_${f}`, { defaultValue: f }))
                                        .join(', '),
                                })}
                            </Text>
                            {perms.canManageOperations && (
                                <Text style={styles.unconfirmedCta}>
                                    {t('ponds.unconfirmedCta')}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                )}

                {/*
                  * What the farmer logged that the server has not got yet.
                  * Placed above the figures on purpose: the numbers below are
                  * the SERVER's, and this row is the honest explanation of why
                  * they have not moved yet.
                  */}
                {pendingHere.length > 0 && (
                    <>
                        <SectionHeader
                            label={t('sync.pendingSectionTitle')}
                            trailing={pendingHere.length}
                            actionLabel={t('sync.viewAll')}
                            onAction={() => navigation.navigate('SyncStatus')}
                        />
                        {pendingHere.map((rec) => (
                            <SummaryRow
                                key={rec.id}
                                icon={rec.failed ? 'warning' : 'schedule'}
                                title={t(`sync.entity_${rec.entity}`, {
                                    defaultValue: rec.entity.replace(/_/g, ' '),
                                })}
                                subtitle={`${t('sync.savedAt', { when: formatTime(rec.createdAt) })} · ${
                                    rec.failed ? t('sync.needsAttention') : t('sync.pending')
                                }`}
                                onPress={() => navigation.navigate('SyncStatus')}
                            />
                        ))}
                    </>
                )}
                {/*
                  * The pond's problem, in the engine's own words, above everything
                  * else. "Done" sends them to the log rather than clearing the
                  * alert here — recording the new reading is what actually
                  * resolves it, and marking it done without one would just hide a
                  * pond that still has 2.8 mg/L of oxygen in it.
                  */}
                {alert && (
                    <View style={styles.alert}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.alertTitle}>{alert.topTitle}</Text>
                            {!!readingAgo && (
                                <Text style={styles.alertMeta}>
                                    {t('ponds.readAgo', { ago: readingAgo })}
                                </Text>
                            )}
                        </View>
                        {perms.canRecordData && (
                            <TouchableOpacity
                                style={styles.alertBtn}
                                onPress={() => navigation.navigate('WaterQualityLog', { pondId, pondName, cropId: cycle?.id })}
                                accessibilityRole="button"
                            >
                                <Text style={styles.alertBtnLabel}>{t('ponds.markDone')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {cycle ? (
                    <>
                        <View style={styles.cycleRow}>
                            <View style={styles.docBox}>
                                <Text style={styles.docValue}>{context?.doc ?? '—'}</Text>
                                <Text style={styles.docLabel}>{t('ponds.doc')}</Text>
                            </View>
                            <View style={styles.cycleDivider} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.cycleName} numberOfLines={1}>
                                    {cycle.name}
                                </Text>
                                <Text style={styles.cycleMeta} numberOfLines={1}>
                                    {[
                                        cycle.stockingDate
                                            ? t('ponds.stocked', {
                                                  date: new Date(cycle.stockingDate).toLocaleDateString('en-IN', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  }),
                                              })
                                            : null,
                                        context?.crop?.stockingCount
                                            ? t('ponds.plCount', {
                                                  pl: context.crop.stockingCount.toLocaleString('en-IN'),
                                              })
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                                {/* Logged / fed this session — same rule the
                                    reminders and the Today progress card use
                                    (features/logProgress.ts), so this pond
                                    cannot disagree with either. */}
                                {!!context && (
                                    <View style={styles.sessionHint}>
                                        <SessionHint ctx={context} />
                                        {/* …and how long since each. The
                                            per-parameter ages further down are
                                            for reading a probe; this is the one
                                            line that says whether the pond has
                                            been looked at at all. */}
                                        <AgeHint
                                            loggedAt={context.waterQuality?.recordedAt ?? null}
                                            fedAt={context.lastFeedAt}
                                            stale={pondFreshness(context, now).state !== 'fresh'}
                                        />
                                    </View>
                                )}
                            </View>
                            {/* RECORD_HARVEST, not WRITE_OPERATIONAL: a harvest
                                books revenue and can close the cycle, so it is
                                not the same permission as a pH reading. */}
                            {perms.canRecordHarvest && (
                                <TouchableOpacity
                                    style={styles.harvestBtn}
                                    onPress={() => navigation.navigate('HarvestLog', { pondId, pondName, cropId: cycle.id })}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.harvestLabel}>{t('ponds.harvest')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/*
                          * How much of the pond's snapshot is real, current data
                          * versus a stale or missing reading — the same trust
                          * signal the engines show, right where the farmer can
                          * act on it: `showHint` names what to log next.
                          */}
                        {context?.confidence && (
                            <View style={styles.confidenceRow}>
                                <ConfidenceChip confidence={context.confidence} showHint />
                            </View>
                        )}

                        <StatRow
                            divider
                            stats={[
                                { value: num(context?.abwG), label: t('ponds.metricMbwG') },
                                { value: survival != null ? String(survival) : '—', label: t('ponds.metricSurvivalPct') },
                                {
                                    value: context?.biomassKg != null ? Math.round(context.biomassKg).toLocaleString('en-IN') : '—',
                                    label: t('ponds.metricBiomassKg'),
                                },
                                { value: num(context?.runningFcr, 2), label: t('ponds.metricFcr') },
                            ]}
                        />

                        {/*
                          * Biomass is DERIVED, never typed: live population ×
                          * mean body weight ÷ 1000, where the weight comes from
                          * the latest sampling. A farmer looking for somewhere to
                          * enter it will not find one, and four dashes in a row
                          * do not explain why — so when there is no sampling to
                          * derive it from, say what is missing and open the form
                          * that supplies it.
                          */}
                        {context?.abwG == null && (
                            <SummaryRow
                                icon="scale"
                                title={t('ponds.needSamplingTitle')}
                                subtitle={t('ponds.needSamplingBody')}
                                onPress={() =>
                                    navigation.navigate('SamplingLog', { pondId, pondName, cropId: cycle.id })
                                }
                                divider="strong"
                            />
                        )}

                        {actionsBlock}

                        {wq && (
                            <>
                                <SectionHeader
                                    label={t('ponds.latestReading')}
                                    actionLabel={readingAgo ? t('ponds.agoShort', { ago: readingAgo }) : undefined}
                                    onAction={() => navigation.navigate('WaterQualityHistory', { pondId, pondName })}
                                />
                                <StatRow
                                    stats={
                                        [
                                            {
                                                value: num(wq.dissolvedOxygen),
                                                label: t('ponds.wqDo'),
                                                tone: alert?.topSeverity === 'critical' ? 'danger' : 'default',
                                            },
                                            { value: num(wq.ph), label: t('ponds.wqPh') },
                                            { value: num(wq.temperature), label: t('ponds.wqTemp') },
                                            { value: num(wq.salinity, 0), label: t('ponds.wqSalt') },
                                        ] as Stat[]
                                    }
                                />
                                {/*
                                  * Each figure above can come from a DIFFERENT
                                  * record — a pH-only log does not refresh
                                  * yesterday's DO reading — so every figure gets
                                  * its OWN age, not the tile's newest one
                                  * (`readingAgo`). Same 4-cell layout as the
                                  * StatRow above so each caption sits under the
                                  * value it describes.
                                  */}
                                <View style={styles.readingAgeRow}>
                                    <Text style={styles.readingAge}>{formatAge(wq.dissolvedOxygenAsOf)}</Text>
                                    <Text style={styles.readingAge}>{formatAge(wq.phAsOf)}</Text>
                                    <Text style={styles.readingAge}>{formatAge(wq.temperatureAsOf)}</Text>
                                    <Text style={styles.readingAge}>{formatAge(wq.salinityAsOf)}</Text>
                                </View>
                            </>
                        )}

                    </>
                ) : (
                    <View style={styles.idle}>
                        <Icon name="waves" size={40} color={theme.roles.light.textDisabled} />
                        <Text style={styles.idleTitle}>{t('ponds.idleTitle')}</Text>
                        <Text style={styles.idleSub}>{t('ponds.idleSubtitle')}</Text>
                        {perms.canStartCycle && (
                            <TouchableOpacity
                                style={styles.startBtn}
                                onPress={() => navigation.navigate('CreateCycle', { pondId })}
                                accessibilityRole="button"
                            >
                                <Text style={styles.startLabel}>{t('ponds.startNewCycle')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Idle or stocked, the pond's past stays reachable. */}
                {!cycle && actionsBlock}

                {/*
                  * What this pond EARNED, not only what it cost.
                  *
                  * The screen already fetched the full P&L and rendered one
                  * field of it — total cost — so the one page about this pond
                  * showed the farmer their spend and never their revenue. And
                  * it lived inside the `cycle ?` branch, so it vanished the
                  * instant a full harvest closed the cycle. Now it sits outside
                  * that branch and names which cycle it is talking about.
                  *
                  * `perms.canViewFinancials` is unchanged: a worker who cannot
                  * see money still sees none of this.
                  */}
                {perms.canViewFinancials && money && (
                    <>
                        <SectionHeader
                            label={money.closed ? t('ponds.moneyLastCycle') : t('ponds.moneyForPond')}
                            actionLabel={money.closed ? money.cycleName ?? undefined : undefined}
                        />
                        <StatRow
                            divider
                            stats={
                                [
                                    { value: inr(money.pnl.revenue), label: t('ponds.metricRevenue') },
                                    {
                                        // The WORD changes with the sign, and so
                                        // does the figure ("−₹12.5k"). A loss
                                        // must never be legible only as a colour.
                                        value: signedInr(money.pnl.profit),
                                        label:
                                            money.pnl.profit < 0
                                                ? t('ponds.metricLoss')
                                                : t('ponds.metricProfit'),
                                        tone: money.pnl.profit < 0 ? 'danger' : 'success',
                                    },
                                    {
                                        value: `${Math.round(money.pnl.marginPct)}`,
                                        unit: '%',
                                        label: t('ponds.metricMargin'),
                                        tone: money.pnl.profit < 0 ? 'danger' : 'default',
                                    },
                                ] as Stat[]
                            }
                        />
                        <SummaryRow
                            icon="receipt_long"
                            title={t('ponds.viewExpenses')}
                            subtitle={t('ponds.spentThisCycle', { amount: inr(money.pnl.totalCost) })}
                            onPress={() =>
                                navigation.navigate('Expenses', { cropId: money.pnl.cropId, pondName })
                            }
                            divider={cycle ? 'light' : 'strong'}
                        />
                        {/* A harvest plan for a cycle that is already over is
                            not a plan, so this stays with the active one. */}
                        {!!cycle && (
                            <SummaryRow
                                icon="event_available"
                                title={t('ponds.harvestPlan')}
                                subtitle={
                                    daysToTarget != null
                                        ? daysToTarget > 0
                                            ? t('ponds.windowOpensIn', { count: daysToTarget })
                                            : t('ponds.windowOpen')
                                        : undefined
                                }
                                onPress={() =>
                                    navigation.navigate('HarvestPlans', {
                                        pondId,
                                        pondName,
                                        cropId: cycle.id,
                                        farmId: pond?.farmId,
                                    })
                                }
                                divider="strong"
                            />
                        )}
                    </>
                )}

                {/* Every cycle this pond has ever run. The dashboard only ever
                    showed the CURRENT one, so a farmer comparing this crop with
                    the last had nowhere to look. */}
                <SummaryRow
                    icon="history"
                    title={t('cycles.listTitle')}
                    onPress={() =>
                        navigation.navigate('CycleList', {
                            pondId,
                            pondName,
                            farmId: pond?.farmId,
                        })
                    }
                    divider="strong"
                />

                {/*
                  * "What have we already done today" — the question asked
                  * standing at the pond, before feeding again. Nothing in the
                  * app answered it: the history screens are undated full lists,
                  * so today's three entries were somewhere in a scroll of two
                  * hundred.
                  */}
                <SectionHeader
                    label={t('ponds.todayTitle')}
                    trailing={today.length || undefined}
                    actionLabel={t('activity.seeAll')}
                    onAction={() =>
                        navigation.navigate('Activity', {
                            pondId,
                            pondName,
                            farmId: pond?.farmId,
                        })
                    }
                />
                {today.length === 0 ? (
                    <Text style={styles.todayEmpty}>
                        {todayQuery.isPending ? t('common.loading') : t('ponds.todayEmpty')}
                    </Text>
                ) : (
                    today.map((entry, i) => (
                        <SummaryRow
                            key={`${entry.kind}-${entry.recordId}`}
                            icon={ACTIVITY_ICON[entry.kind] ?? 'checklist'}
                            title={t(activityKindKey(entry.kind))}
                            subtitle={
                                [entry.summary, entry.actorName].filter(Boolean).join(' · ') ||
                                t('activity.noDetail')
                            }
                            value={formatTime(entry.at)}
                            divider={i === today.length - 1 ? 'strong' : 'light'}
                        />
                    ))
                )}

                {/*
                  * The pond itself. Every one of these figures is asked for when
                  * the pond is created and then went nowhere — the shape, the
                  * bottom, the measurements, the aerators. A farmer who typed
                  * them had no way to check them, correct them, or even see
                  * that the app had kept them. Area and volume are shown
                  * alongside because they are what the numbers above are FOR:
                  * every stocking, dosing and feed figure divides by them.
                  */}
                {!!pond && (
                    <>
                        <SectionHeader
                            label={t('ponds.aboutThisPond')}
                            actionLabel={perms.canManageOperations ? t('common.edit') : undefined}
                            onAction={() =>
                                navigation.navigate('CreatePond', { farmId: pond.farmId, editPondId: pondId })
                            }
                        />
                        <SummaryRow
                            icon="waves"
                            title={t('ponds.labelPondShape')}
                            subtitle={[
                                pond.geometryType ? t(SHAPE_KEY[pond.geometryType] ?? '', { defaultValue: pond.geometryType }) : null,
                                pond.constructionType ? t(CONSTRUCTION_KEY[pond.constructionType] ?? '', { defaultValue: pond.constructionType }) : null,
                            ].filter(Boolean).join(' · ') || '—'}
                        />
                        <SummaryRow
                            icon="scale"
                            title={t('ponds.labelMeasurements')}
                            subtitle={dimensionLine}
                        />
                        {areaM2 > 0 && (
                            <StatRow
                                stats={[
                                    { value: Math.round(areaM2).toLocaleString('en-IN'), label: t('ponds.metricArea') },
                                    { value: Math.round(areaM2 * (Number(pond.depthM) || 0)).toLocaleString('en-IN'), label: t('ponds.metricVolume') },
                                    { value: (areaM2 / 10000).toFixed(2), label: t('ponds.metricHectares') },
                                ]}
                                divider
                            />
                        )}
                        <SummaryRow
                            icon="grain"
                            title={t('ponds.labelAerators')}
                            subtitle={aeratorLine}
                            divider="strong"
                        />
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

/** "Log data" / "History" — a filled pair, not a tab strip. */
const ModeButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({
    label,
    active,
    onPress,
}) => (
    <TouchableOpacity
        style={[styles.modeBtn, active ? styles.modeBtnActive : styles.modeBtnIdle]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.modeLabel, active ? styles.modeLabelActive : styles.modeLabelIdle]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: theme.roles.light.surface },
    skeleton: { padding: theme.spacing[4] },
    mb: { marginBottom: theme.spacing[3] },

    unconfirmed: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        alignItems: 'flex-start',
        marginHorizontal: theme.spacing[4],
        marginTop: theme.spacing[4],
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.warningBorder,
        backgroundColor: theme.roles.light.warningBg,
    },
    unconfirmedTitle: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.warningText,
    },
    unconfirmedBody: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[1],
    },
    unconfirmedCta: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
        marginTop: theme.spacing[2],
    },

    alert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        backgroundColor: theme.roles.light.dangerBg,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerBorder,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.dangerBorder,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    alertTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.dangerText },
    alertMeta: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: theme.roles.light.dangerText,
        opacity: 0.85,
    },
    alertBtn: {
        backgroundColor: theme.roles.light.dangerText,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[4],
        minHeight: 44,
        justifyContent: 'center',
    },
    alertBtnLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textInverse },

    confidenceRow: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3] },
    readingAgeRow: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
    },
    readingAge: { flex: 1, ...theme.typeScale.caption, color: theme.roles.light.textTertiary },

    cycleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    docBox: { alignItems: 'flex-start' },
    docValue: { fontFamily: 'DMMono-Medium', fontSize: 24, lineHeight: 28, color: theme.roles.light.textPrimary },
    docLabel: {
        ...theme.typeScale.labelSmall,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: theme.roles.light.textDisabled,
    },
    cycleDivider: { width: 1, alignSelf: 'stretch', backgroundColor: theme.roles.light.borderDefault },
    cycleName: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    cycleMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: theme.roles.light.textTertiary },
    sessionHint: { marginTop: theme.spacing[1.5], gap: 2 },
    harvestBtn: {
        borderWidth: 1.5,
        borderColor: theme.roles.light.successText,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
        justifyContent: 'center',
    },
    harvestLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.successText },

    modeRow: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
    },
    modeBtn: {
        flex: 1,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[3],
        alignItems: 'center',
        minHeight: 44,
        justifyContent: 'center',
    },
    modeBtnActive: { backgroundColor: theme.roles.light.textPrimary },
    modeBtnIdle: { borderWidth: 1, borderColor: theme.roles.light.textSecondary },
    modeLabel: { ...theme.typeScale.labelLarge },
    modeLabelActive: { color: theme.roles.light.textInverse },
    modeLabelIdle: { color: theme.roles.light.textSecondary },
    modeHint: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2],
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[1.5],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2.5],
    },
    gridTile: {
        // Three across, whatever the phone: each takes a third of the row minus
        // the two gaps between them.
        width: '31.8%',
        alignItems: 'center',
        gap: 3,
        borderWidth: 1,
        borderColor: theme.roles.light.borderStrong,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[1],
        minHeight: 60,
        justifyContent: 'center',
    },
    gridLabel: { ...theme.typeScale.labelMedium, fontSize: 11, color: theme.roles.light.textPrimary },
    // Top-right of the tile, out of the icon+label column so nothing shifts
    // when a tile has no badge.
    tileBadge: { position: 'absolute', top: 4, right: 5 },
    gridTileLocked: {
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    gridLabelLocked: { color: theme.roles.light.textTertiary },
    gridLockedHint: {
        ...theme.typeScale.labelSmall,
        fontSize: 9,
        color: theme.roles.light.textTertiary,
    },
    todayEmpty: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    moreRow: {
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        minHeight: 44,
        justifyContent: 'center',
    },
    moreLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textLink },

    idle: { alignItems: 'center', gap: theme.spacing[2], padding: theme.spacing[8] },
    idleTitle: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    idleSub: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textTertiary },
    startBtn: {
        marginTop: theme.spacing[3],
        backgroundColor: theme.roles.light.primaryHover,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[6],
        minHeight: 44,
        justifyContent: 'center',
    },
    startLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textInverse },
});

export default PondDashboardScreen;
