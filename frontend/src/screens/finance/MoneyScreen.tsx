/**
 * Money — artboard 3d. The tab, not the ledger.
 *
 * The Money tab used to open straight into the transaction list: hundreds of
 * rows, newest first, which answers "what did I write down" and not "am I
 * making money". This screen answers the second question in its first
 * screenful — net, then where the money went, then what is owed — and hands
 * the list off behind "All ›".
 *
 * It opens on EVERY farm combined, not on the active one. A farmer with three
 * farms was reading three separate Money tabs and adding them up in their head
 * to answer "am I making money", which is the one question this screen exists
 * for. The scope chips narrow to a single farm; the by-farm rows underneath
 * the combined total say which farm the number came from.
 *
 * Every figure here is gated on VIEW_FINANCIALS — per farm. A farm whose
 * report we cannot read is in neither the total nor the by-farm list, so the
 * rows always add up to the hero figure.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';
import { toLocalISODate } from '../../utils/localDate';
import { reportsApi, type FinancialReport } from '../../api/reports';
import { transactionsApi, type Transaction } from '../../api/transactions';
import { creditApi, type CreditLedger } from '../../api/credit';
import { farmsApi, type Farm } from '../../api/farms';
import { pondsApi, type Pond } from '../../api/ponds';
import { cropsApi, type Crop } from '../../api/crops';
import { expensesApi, type Expense } from '../../api/expenses';
import { fetchMoneyOverview, type MoneyEntry } from '../../api/moneyOverview';
import {
    DEFAULT_MONEY_PREFS,
    loadMoneyPrefs,
    moneyPeriodRange,
    saveMoneyPrefs,
    type MoneyPeriod,
    type MoneyPrefs,
} from '../../features/moneyPrefs';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { usePermissions } from '../../hooks/usePermissions';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';

const c = theme.roles.light;

// Stable empty fallbacks — a fresh `[]`/`{}` on every render would defeat the
// useMemo dependencies below.
const EMPTY_REPORTS: Record<string, FinancialReport> = {};
const EMPTY_ENTRIES: MoneyEntry[] = [];
const EMPTY_CREDIT: CreditLedger[] = [];
const EMPTY_PONDS: Pond[] = [];
const EMPTY_CYCLES: Crop[] = [];
const EMPTY_EXPENSES: Expense[] = [];

/** Recent entries shown before "All ›" takes over. */
const RECENT_COUNT = 6;

/** Scope value meaning "every farm I can see financials for". */
const ALL = 'all';

/** Period chips, in the order a farmer reaches for them. */
const PERIODS: MoneyPeriod[] = ['all', 'today', 'week', 'month', 'custom'];

/** Written out rather than built from the value, so the keys stay greppable. */
const PERIOD_KEY: Record<MoneyPeriod, string> = {
    all: 'finance.periodAll',
    today: 'finance.periodToday',
    week: 'finance.periodWeek',
    month: 'finance.periodMonth',
    custom: 'finance.periodCustom',
};

const parseISO = (iso: string | null): Date => {
    if (!iso) return new Date();
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/**
 * Cost-category ribbon. Six colours, cycled — the seventh category and beyond
 * repeat, which is fine: the ribbon shows PROPORTION, and the row beneath it
 * carries the name and the number.
 */
const SEGMENT_COLORS = [
    c.primaryHover,
    c.borderBrand,
    c.warningText,
    c.successText,
    c.infoText,
    c.textDisabled,
];

const inr = (n: number): string => {
    const a = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
    if (a >= 1e3) return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
    return `${sign}₹${Math.round(a)}`;
};

const shortDate = (iso: string) => formatDate(iso);

/**
 * Add up N farms into one report.
 *
 * `profit` is summed rather than recomputed as revenue − expenses: the backend
 * decides what counts as profit for a farm, and this screen must not quietly
 * disagree with the per-farm figure sitting right below the total.
 */
export const combineReports = (reports: FinancialReport[]): FinancialReport | null => {
    if (reports.length === 0) return null;
    const byCategory: Record<string, number> = {};
    let revenue = 0;
    let totalExpenses = 0;
    let profit = 0;
    let inventoryExpenses = 0;
    const ponds: NonNullable<FinancialReport['ponds']> = [];
    for (const r of reports) {
        revenue += Number(r.revenue || 0);
        totalExpenses += Number(r.totalExpenses || 0);
        profit += Number(r.profit || 0);
        inventoryExpenses += Number(r.inventoryExpenses || 0);
        // Concatenated, not merged: pond ids are unique across farms, and the
        // archived split is read per pond.
        if (r.ponds) ponds.push(...r.ponds);
        for (const row of r.expensesByCategory ?? []) {
            byCategory[row.category] = (byCategory[row.category] || 0) + Number(row.amount || 0);
        }
    }
    return {
        revenue,
        totalExpenses,
        profit,
        inventoryExpenses,
        ponds,
        // A combined report only "included archived ponds" if every farm did.
        includedArchivedPonds: reports.every((r) => r.includedArchivedPonds !== false),
        expensesByCategory: Object.keys(byCategory).map((category) => ({
            category,
            amount: byCategory[category],
        })),
    };
};

export const MoneyScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);

    // A caller that navigates here with an explicit farm means it — "show me
    // THIS farm's money". Everything else opens combined.
    const [scope, setScope] = useState<string>(route?.params?.farmId ?? ALL);

    // Pond and cycle narrow the costs BELOW the farm figures. They are not
    // persisted: "which pond am I looking at" is a question about right now,
    // unlike the period and the two toggles, which are how the farmer wants
    // their books read every time.
    const [pondId, setPondId] = useState<string | null>(null);
    const [cropId, setCropId] = useState<string | null>(null);

    /**
     * Period + the two toggles, restored from disk.
     *
     * Rendering the defaults for one frame and then swapping is deliberate:
     * blocking the whole tab on an AsyncStorage read to find out whether a
     * checkbox is ticked would be a worse trade than one extra fetch.
     */
    const [prefs, setPrefs] = useState<MoneyPrefs>(DEFAULT_MONEY_PREFS);
    useEffect(() => {
        let alive = true;
        void loadMoneyPrefs().then((p) => {
            if (alive) setPrefs(p);
        });
        return () => {
            alive = false;
        };
    }, []);

    const updatePrefs = useCallback((patch: Partial<MoneyPrefs>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            void saveMoneyPrefs(next);
            return next;
        });
    }, []);

    const range = useMemo(() => moneyPeriodRange(prefs), [prefs]);

    const filters = useMemo(
        () => ({
            startDate: range.startDate,
            endDate: range.endDate,
            includeArchivedPonds: prefs.includeArchivedPonds,
            includeInventoryPurchases: prefs.includeInventoryPurchases,
        }),
        [range, prefs.includeArchivedPonds, prefs.includeInventoryPurchases],
    );

    // Every filter is part of the cache identity — two different periods are
    // two different answers, and serving one for the other is a wrong number.
    const filterKey = `${range.startDate ?? ''}~${range.endDate ?? ''}~${
        prefs.includeArchivedPonds ? 1 : 0
    }${prefs.includeInventoryPurchases ? 1 : 0}`;

    /**
     * One cached read for the tab, and ONE request to fill it.
     *
     * This used to fan out to 3 + N calls from the phone (the farm list, then a
     * financial report per farm, plus transactions and credit). At ~265ms of
     * network per request from rural India that fan-out WAS the load time — the
     * server was never the slow part. See api/moneyOverview.ts.
     *
     * Persisted to disk since the offline work: Money is one of the two tabs
     * that used to always fail with no signal.
     */
    const query = useAppQuery({
        queryKey: qk.money(filterKey),
        queryFn: () => fetchMoneyOverview(filters),
    });

    useRefetchOnFocus(qk.money(filterKey));

    const farms = query.data?.farms ?? [];
    const reports = query.data?.reports ?? EMPTY_REPORTS;
    const allEntries = query.data?.allEntries ?? EMPTY_ENTRIES;
    const credit = query.data?.credit ?? EMPTY_CREDIT;
    const hasData = query.data != null;

    // Farms whose financials actually loaded. A worker-only farm 403s on the
    // report; leaving it out of both the total and the list keeps the two
    // consistent with each other.
    const visibleFarms = useMemo(() => farms.filter((f) => reports[f.id]), [farms, reports]);

    // A scope pinned to a farm that has since disappeared would show an empty
    // screen with no way back, so fall through to combined.
    const activeScope =
        scope !== ALL && visibleFarms.some((f) => f.id === scope) ? scope : ALL;

    const scopedFarms = useMemo(
        () => (activeScope === ALL ? visibleFarms : visibleFarms.filter((f) => f.id === activeScope)),
        [activeScope, visibleFarms],
    );

    // Writing an entry needs one specific farm even when we are showing all of
    // them — the active farm is the farmer's own answer to "which one".
    const writeFarm =
        scopedFarms.find((f) => f.id === activeScope) ??
        visibleFarms.find((f) => f.id === selectedFarm?.id) ??
        visibleFarms[0];
    const perms = usePermissions(writeFarm?.id);

    const report = useMemo(
        () => combineReports(scopedFarms.map((f) => reports[f.id])),
        [scopedFarms, reports],
    );

    const entries = useMemo(
        () => (activeScope === ALL ? allEntries : allEntries.filter((tx) => tx.farmId === activeScope)),
        [allEntries, activeScope],
    );

    /** Changing farm invalidates the pond and cycle chosen inside the old one. */
    const selectScope = useCallback((next: string) => {
        setScope(next);
        setPondId(null);
        setCropId(null);
    }, []);

    /**
     * The ponds of the scoped farm — ARCHIVED ONES INCLUDED, so a farmer can
     * still open the books of a pond they retired. Only fetched once a single
     * farm is in scope; "all farms" has no meaningful pond list.
     */
    const pondsQuery = useAppQuery({
        queryKey: ['money', 'ponds', activeScope],
        queryFn: async () => {
            const res = await pondsApi.getAll(activeScope, { take: 100, includeArchived: true });
            const data: any = res.data;
            return (Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])) as Pond[];
        },
        enabled: activeScope !== ALL,
    });
    const ponds: Pond[] = pondsQuery.data ?? EMPTY_PONDS;

    const cyclesQuery = useAppQuery({
        queryKey: ['money', 'crops', pondId],
        queryFn: async () => (await cropsApi.getAll(pondId as string)).data ?? [],
        enabled: !!pondId,
    });
    const cycles: Crop[] = cyclesQuery.data ?? EMPTY_CYCLES;

    /**
     * Pond- and cycle-scoped costs, filtered ON THE SERVER.
     *
     * This is the only way to answer "what did this pond cost me this week":
     * costs recorded against a CYCLE never appear in the transaction list, so
     * no amount of client-side filtering of `allEntries` could have shown them.
     */
    const scopedQuery = useAppQuery({
        queryKey: ['money', 'expenses', activeScope, pondId, cropId, filterKey],
        queryFn: async () =>
            (
                await expensesApi.list({
                    farmId: activeScope,
                    pondId: pondId as string,
                    cropId: cropId ?? undefined,
                    ...filters,
                })
            ).data ?? [],
        enabled: !!pondId,
    });
    const scopedExpenses: Expense[] = scopedQuery.data ?? EMPTY_EXPENSES;

    const scopedTotal = useMemo(
        () => scopedExpenses.reduce((a, e) => a + Number(e.amount || 0), 0),
        [scopedExpenses],
    );

    /** What the "count inventory purchases" toggle is worth, in rupees. */
    const inventoryTotal = useMemo(
        () => scopedFarms.reduce((a, f) => a + Number(reports[f.id]?.inventoryExpenses ?? 0), 0),
        [scopedFarms, reports],
    );

    /**
     * What the "count archived ponds" toggle is worth — from the report's
     * per-pond split, which is the ONLY place that knows.
     *
     * Not from the entry list: a transaction hangs off a farm and has no pond,
     * so the backend hard-codes `archived: false` on every one of them. Reading
     * that as "no archived money" would be a wrong answer confidently given.
     */
    const archivedTotal = useMemo(
        () =>
            scopedFarms.reduce(
                (a, f) =>
                    a +
                    (reports[f.id]?.ponds ?? [])
                        .filter((p) => p.archived)
                        .reduce((s, p) => s + Number(p.revenue || 0) + Number(p.expenses || 0), 0),
                0,
            ),
        [scopedFarms, reports],
    );

    /** Categories sorted biggest-first, with each one's share of the total. */
    const breakdown = useMemo(() => {
        const rows = report?.expensesByCategory ?? [];
        const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
        if (total <= 0) return [];
        return [...rows]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((row, i) => ({
                category: row.category,
                amount: Number(row.amount),
                share: Number(row.amount) / total,
                color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            }));
    }, [report]);

    const outstanding = useMemo(() => {
        const open = credit.filter((l) => Number(l.outstanding) > 0);
        const total = open.reduce((a, l) => a + Number(l.outstanding), 0);
        // The nearest due date is the one that matters; a list of five dealers
        // on this screen would be a ledger, which is not what it is for.
        const next = [...open]
            .filter((l) => l.dueDate)
            .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
        return { total, next, count: open.length };
    }, [credit]);

    const recent = entries.slice(0, RECENT_COUNT);

    // A farm nobody has recorded anything against has no net — not a net of
    // zero. Revenue and expenses both being absent is the signal.
    const hasFigures = !!report && (report.revenue > 0 || report.totalExpenses > 0);
    const isLoss = (report?.profit ?? 0) < 0;

    const margin =
        report && report.revenue > 0 ? Math.round((report.profit / report.revenue) * 100) : null;

    const scopeName =
        activeScope === ALL
            ? t('finance.allFarms')
            : visibleFarms.find((f) => f.id === activeScope)?.name;

    const header = (
        <ScreenHeader
            eyebrow={scopeName ?? null}
            title={t('finance.moneyTitle')}
            actionLabel={writeFarm && perms.canViewFinancials ? t('finance.addEntry') : undefined}
            onAction={() =>
                navigation.navigate('Transactions', {
                    farmId: writeFarm?.id,
                    farmName: writeFarm?.name,
                })
            }
        />
    );

    if (query.isPending && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.skeleton}>
                    <Skeleton width="100%" height={120} style={styles.mb} />
                    <Skeleton width="100%" height={90} style={styles.mb} />
                    <Skeleton width="100%" height={140} />
                </View>
            </ScreenWrapper>
        );
    }

    // "We could not read your books" is not "you have no farms". Before this,
    // a failed load fell straight through to the empty state and told an owner
    // with three farms to go and create one.
    if (query.isError && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <ErrorState title={t('finance.moneyTitle')} error={query.error} onRetry={() => query.refetch()} />
            </ScreenWrapper>
        );
    }

    if (visibleFarms.length === 0) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <EmptyState
                    icon="cash-multiple"
                    title={t('finance.noFarmTitle')}
                    subtitle={t('finance.noFarmSub')}
                />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />
            {/*
              * Scope chips. Only worth the row when there is more than one farm
              * to switch between — with one farm, "All farms" and its name are
              * the same view under two labels.
              */}
            {visibleFarms.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    <Chip
                        label={t('finance.allFarms')}
                        active={activeScope === ALL}
                        onPress={() => selectScope(ALL)}
                    />
                    {visibleFarms.map((farm) => (
                        <Chip
                            key={farm.id}
                            label={farm.name}
                            active={activeScope === farm.id}
                            onPress={() => selectScope(farm.id)}
                        />
                    ))}
                </ScrollView>
            )}

            {/*
              * Period. "Am I making money" is always "…over what stretch of
              * time"; before this the tab only ever answered "since forever",
              * which is the one period a farmer never asks about.
              */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
            >
                {PERIODS.map((p) => (
                    <Chip
                        key={p}
                        label={t(PERIOD_KEY[p])}
                        active={prefs.period === p}
                        onPress={() => updatePrefs({ period: p })}
                    />
                ))}
            </ScrollView>

            {prefs.period === 'custom' && (
                <View style={styles.customRange}>
                    {/*
                      * `startDate > endDate` is a 400 from the server, so the
                      * picker never lets one be made: "To" cannot go before
                      * "From", and moving "From" past the current "To" drags
                      * "To" with it rather than leaving an invalid pair.
                      */}
                    <View style={styles.customField}>
                        <CalendarPicker
                            label={t('finance.customFrom')}
                            value={parseISO(prefs.customStart)}
                            maxDate={new Date()}
                            onChange={(d) => {
                                const start = toLocalISODate(d);
                                updatePrefs({
                                    customStart: start,
                                    customEnd:
                                        prefs.customEnd && prefs.customEnd < start
                                            ? start
                                            : prefs.customEnd,
                                });
                            }}
                        />
                    </View>
                    <View style={styles.customField}>
                        <CalendarPicker
                            label={t('finance.customTo')}
                            value={parseISO(prefs.customEnd)}
                            minDate={parseISO(prefs.customStart)}
                            onChange={(d) => updatePrefs({ customEnd: toLocalISODate(d) })}
                        />
                    </View>
                </View>
            )}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
                }
            >
                {/*
                  * Net first, and coloured by what it IS. Three states, not two:
                  * a zero net used to paint the band green and read as "you broke
                  * even", when on a farm with nothing recorded it means nobody has
                  * told the app anything yet. Those are opposite facts.
                  *
                  * The three figures under it are what the net is made of, so a
                  * farmer can see at a glance whether a bad number is an income
                  * problem or a cost problem — and income and expense are coloured
                  * apart, because two identical grey figures make the reader do
                  * the subtraction the hero has already done.
                  */}
                {hasFigures ? (
                    <View style={[styles.hero, isLoss && styles.heroLoss]}>
                        <Text style={[styles.heroLabel, isLoss && styles.heroLabelLoss]}>
                            {t('finance.netSoFar')}
                        </Text>
                        <Text style={[styles.heroValue, isLoss && styles.heroValueLoss]}>
                            {`${report!.profit > 0 ? '+' : ''}${inr(report!.profit)}`}
                        </Text>
                        <View style={styles.heroStats}>
                            <HeroStat
                                label={t('finance.totalIncome')}
                                value={inr(report!.revenue)}
                                tone={c.successText}
                            />
                            <HeroStat
                                label={t('finance.totalExpense')}
                                value={inr(report!.totalExpenses)}
                                tone={c.dangerText}
                            />
                            <HeroStat
                                label={t('finance.marginPercent')}
                                value={margin != null ? `${margin}%` : '—'}
                            />
                        </View>
                    </View>
                ) : (
                    /* Nothing recorded. A "+₹0" in a green band would be a claim
                       about this farm; the truth is that nobody has told the app
                       anything about it yet. */
                    <TouchableOpacity
                        style={styles.heroEmpty}
                        onPress={() =>
                            navigation.navigate('Transactions', {
                                farmId: writeFarm?.id,
                                farmName: writeFarm?.name,
                            })
                        }
                        accessibilityRole="button"
                    >
                        <Text style={styles.heroEmptyLabel}>{t('finance.nothingYetTitle')}</Text>
                        <Text style={styles.heroEmptyBody}>{t('finance.nothingYetBody')}</Text>
                        {perms.canViewFinancials && (
                            <Text style={styles.heroEmptyCta}>{t('finance.addEntry')} ›</Text>
                        )}
                    </TouchableOpacity>
                )}

                {/*
                  * What the figures above COUNT. Both default on: archived
                  * ponds spent real money, and a sack of feed bought on Tuesday
                  * is money out on Tuesday. A farmer who reads their books
                  * differently flips them once and we remember.
                  */}
                <View style={styles.toggles}>
                    <ToggleRow
                        label={t('finance.includeArchived')}
                        hint={
                            archivedTotal > 0
                                ? t('finance.includeArchivedWorth', { amount: inr(archivedTotal) })
                                : t('finance.includeArchivedHint')
                        }
                        value={prefs.includeArchivedPonds}
                        onChange={(v) => updatePrefs({ includeArchivedPonds: v })}
                    />
                    <ToggleRow
                        label={t('finance.includeInventory')}
                        hint={
                            // The subtotal describes what is INSIDE the totals,
                            // so it is 0 whenever the toggle is off. Printing
                            // "₹0 of the expenses above" there would read as
                            // "you have no inventory spend", which is a
                            // different — and probably false — statement.
                            !prefs.includeInventoryPurchases
                                ? t('finance.includeInventoryOff')
                                : inventoryTotal > 0
                                  ? t('finance.includeInventoryWorth', { amount: inr(inventoryTotal) })
                                  : t('finance.includeInventoryHint')
                        }
                        value={prefs.includeInventoryPurchases}
                        onChange={(v) => updatePrefs({ includeInventoryPurchases: v })}
                    />
                </View>

                {/*
                  * Which farm the combined number came from, worst first — the
                  * farm losing money is the one worth opening. Tapping a row is
                  * the same as tapping its chip, so a farmer can drill in where
                  * they noticed the problem.
                  */}
                {hasFigures && activeScope === ALL && visibleFarms.length > 1 && (
                    <>
                        <SectionHeader label={t('finance.byFarm')} />
                        {[...visibleFarms]
                            .sort((a, b) => reports[a.id].profit - reports[b.id].profit)
                            .map((farm) => {
                                const r = reports[farm.id];
                                return (
                                    <TouchableOpacity
                                        key={farm.id}
                                        style={styles.farmRow}
                                        onPress={() => selectScope(farm.id)}
                                        accessibilityRole="button"
                                    >
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.farmName} numberOfLines={1}>
                                                {farm.name}
                                            </Text>
                                            <Text style={styles.farmMeta} numberOfLines={1}>
                                                {t('finance.farmInOut', {
                                                    income: inr(r.revenue),
                                                    expense: inr(r.totalExpenses),
                                                })}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.farmNet,
                                                { color: r.profit >= 0 ? c.successText : c.dangerText },
                                            ]}
                                        >
                                            {r.profit >= 0 ? '+' : ''}
                                            {inr(r.profit)}
                                        </Text>
                                        <Icon name="chevron_right" size={20} color={c.textTertiary} />
                                    </TouchableOpacity>
                                );
                            })}
                    </>
                )}

                {breakdown.length > 0 && (
                    <>
                        <SectionHeader label={t('finance.whereItWent')} />
                        <View style={styles.ribbon}>
                            {breakdown.map((row) => (
                                <View
                                    key={row.category}
                                    style={{ flex: Math.max(row.share, 0.02), backgroundColor: row.color }}
                                />
                            ))}
                        </View>
                        {breakdown.map((row) => (
                            <View key={row.category} style={styles.catRow}>
                                <View style={[styles.swatch, { backgroundColor: row.color }]} />
                                <Text style={styles.catName} numberOfLines={1}>
                                    {row.category}
                                </Text>
                                <Text style={styles.catAmount}>{inr(row.amount)}</Text>
                                <Text style={styles.catShare}>{Math.round(row.share * 100)}%</Text>
                            </View>
                        ))}
                    </>
                )}

                {/*
                  * Pond, then that pond's cycles. Only once a single farm is in
                  * scope — a pond list across three farms is a list of ponds
                  * with the same names on it.
                  *
                  * An archived pond is IN the list, in the slate colour and
                  * carrying the word "Archived": colour alone is not a signal a
                  * farmer in bright sun with a cheap screen can read.
                  */}
                {activeScope !== ALL && ponds.length > 0 && (
                    <>
                        <SectionHeader label={t('finance.byPond')} />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chips}
                        >
                            <Chip
                                label={t('finance.wholeFarm')}
                                active={pondId == null}
                                onPress={() => {
                                    setPondId(null);
                                    setCropId(null);
                                }}
                            />
                            {ponds.map((p) => {
                                const isArchived = p.status === 'archived';
                                return (
                                    <Chip
                                        key={p.id}
                                        label={
                                            (p.displayName || p.name) +
                                            (isArchived ? ` · ${t('finance.archivedTag')}` : '')
                                        }
                                        archived={isArchived}
                                        active={pondId === p.id}
                                        onPress={() => {
                                            setPondId(p.id);
                                            setCropId(null);
                                        }}
                                    />
                                );
                            })}
                        </ScrollView>
                    </>
                )}

                {pondId != null && cycles.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                    >
                        <Chip
                            label={t('finance.allCycles')}
                            active={cropId == null}
                            onPress={() => setCropId(null)}
                        />
                        {cycles.map((cr) => (
                            <Chip
                                key={cr.id}
                                label={cr.cropCode || cr.name}
                                active={cropId === cr.id}
                                onPress={() => setCropId(cr.id)}
                            />
                        ))}
                    </ScrollView>
                )}

                {pondId != null && (
                    <>
                        <View style={styles.scopedTotalRow}>
                            <Text style={styles.scopedTotalLabel} numberOfLines={1}>
                                {cropId
                                    ? t('finance.cycleCostTotal')
                                    : t('finance.pondCostTotal')}
                            </Text>
                            <Text style={styles.scopedTotalValue}>{inr(scopedTotal)}</Text>
                        </View>
                        {scopedQuery.isPending ? (
                            <Skeleton width="100%" height={44} />
                        ) : scopedExpenses.length === 0 ? (
                            <Text style={styles.empty}>{t('finance.noPondCosts')}</Text>
                        ) : (
                            scopedExpenses.slice(0, RECENT_COUNT).map((e) => (
                                <View
                                    key={e.id}
                                    style={[styles.entry, e.archived && styles.entryArchived]}
                                >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                            style={[
                                                styles.entryTitle,
                                                e.archived && styles.archivedText,
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {e.description || e.category}
                                        </Text>
                                        <Text style={styles.entryMeta} numberOfLines={1}>
                                            {[
                                                shortDate(e.date),
                                                e.category,
                                                e.archived ? t('finance.archivedTag') : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </Text>
                                    </View>
                                    <Text style={[styles.entryAmount, { color: c.dangerText }]}>
                                        −{inr(Math.abs(Number(e.amount)))}
                                    </Text>
                                </View>
                            ))
                        )}
                    </>
                )}

                {outstanding.total > 0 && (
                    <TouchableOpacity
                        style={styles.creditRow}
                        onPress={() =>
                            navigation.navigate('Transactions', {
                                farmId: writeFarm?.id,
                                farmName: writeFarm?.name,
                            })
                        }
                        accessibilityRole="button"
                    >
                        <Icon name="account_balance" size={22} color={c.dangerText} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.creditTitle} numberOfLines={1}>
                                {t('finance.creditOutstanding')}
                            </Text>
                            <Text style={styles.creditMeta} numberOfLines={1}>
                                {outstanding.next
                                    ? t('finance.creditDue', {
                                          dealer: outstanding.next.dealerName,
                                          date: shortDate(outstanding.next.dueDate as string),
                                      })
                                    : t('finance.creditDealers', { count: outstanding.count })}
                            </Text>
                        </View>
                        <Text style={styles.creditAmount}>{inr(outstanding.total)}</Text>
                        <Icon name="chevron_right" size={22} color={c.dangerText} />
                    </TouchableOpacity>
                )}
                {/*
                  * The credit ledger hangs off the USER and carries no farm and
                  * no date, so this figure does not move when the farm chip or
                  * the period chip does — unlike everything above it. A number
                  * that ignores the filters sitting over it reads as a bug
                  * unless it says why.
                  */}
                {outstanding.total > 0 && (
                    <Text style={styles.note}>{t('finance.creditAllFarmsNote')}</Text>
                )}

                <SectionHeader
                    label={t('finance.recentEntries')}
                    actionLabel={t('finance.seeAll')}
                    onAction={() =>
                        navigation.navigate('Transactions', {
                            // "All ›" from a combined view must not silently
                            // narrow to one farm — pass no farm and let the
                            // ledger show everything, matching the total above.
                            farmId: activeScope === ALL ? undefined : writeFarm?.id,
                            farmName: activeScope === ALL ? undefined : writeFarm?.name,
                        })
                    }
                />
                {recent.length === 0 ? (
                    <Text style={styles.empty}>{t('finance.noEntries')}</Text>
                ) : (
                    recent.map((tx) => {
                        // In the combined view a row without its farm is
                        // ambiguous — two farms both buy feed.
                        const farm =
                            activeScope === ALL
                                ? visibleFarms.find((f) => f.id === tx.farmId)?.name
                                : undefined;
                        // A harvest sale is a read-only projection of the
                        // harvest, not a transaction — there is nothing to edit
                        // or delete behind it, so it renders as a plain row and
                        // says what it is.
                        const isHarvest = tx.source === 'harvest';
                        /**
                         * A cost typed on a pond. It lives in the `expenses`
                         * table, which this list did not render — so the
                         * headline moved and there was no line to point at:
                         * "I added expense inside a pond but it didnt show
                         * inside the money screen". Merged in by the backend
                         * now, same read-time projection harvests use.
                         */
                        const isPondCost = tx.source === 'expense';
                        const detail = isHarvest
                            ? tx.buyerName
                                ? t('finance.harvestSoldTo', { buyer: tx.buyerName })
                                : t('finance.harvestSale')
                            : tx.paymentMethod;
                        // The pond, when the row knows one. Pond costs always
                        // do; a transaction does when the farmer picked one.
                        const pond = tx.pondName ?? undefined;
                        // Archived money is MARKED, not hidden (D3). Every
                        // source can answer now — pond costs and harvest sales
                        // always knew their pond, and a transaction that names
                        // one has its pond joined server-side. A farm-level
                        // transaction still cannot say, and reports `false`,
                        // which is the truth for it: it belongs to no pond.
                        const isArchived = tx.archived === true;
                        return (
                            <View key={tx.id} style={styles.entry}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                        style={[styles.entryTitle, isArchived && styles.archivedText]}
                                        numberOfLines={1}
                                    >
                                        {tx.description || (isHarvest ? t('finance.harvestSale') : tx.category)}
                                    </Text>
                                    <Text style={styles.entryMeta} numberOfLines={1}>
                                        {[
                                            shortDate(tx.transactionDate),
                                            farm,
                                            pond,
                                            isArchived ? t('finance.archivedTag') : null,
                                            detail,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.entryAmount,
                                        { color: tx.type === 'income' ? c.successText : c.dangerText },
                                    ]}
                                >
                                    {tx.type === 'income' ? '+' : '−'}
                                    {inr(Math.abs(Number(tx.amount)))}
                                </Text>
                            </View>
                        );
                    })
                )}
                {/*
                  * The list cannot add up to the hero and never could: it shows
                  * six rows, and costs recorded against a CYCLE are summarised
                  * into "Where it went" rather than itemised here. Saying so is
                  * cheaper than leaving a farmer to check the arithmetic and
                  * conclude the app is wrong.
                  */}
                {recent.length > 0 && hasFigures && (
                    <Text style={styles.note}>{t('finance.entriesNote')}</Text>
                )}
                {/* Said out loud rather than left to be inferred from the
                    absence of any archived marking in the list above. */}
                {archivedTotal > 0 && prefs.includeArchivedPonds && (
                    <Text style={styles.note}>{t('finance.entriesArchivedNote')}</Text>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const Chip: React.FC<{
    label: string;
    active: boolean;
    onPress: () => void;
    /** Slate treatment for an archived pond — the label still says the word. */
    archived?: boolean;
}> = ({ label, active, onPress, archived }) => (
    <TouchableOpacity
        style={[styles.chip, archived && styles.chipArchived, active && styles.chipActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text
            style={[
                styles.chipLabel,
                archived && styles.archivedText,
                active && styles.chipLabelActive,
            ]}
            numberOfLines={1}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

/**
 * One line, one switch, one sentence saying what flipping it does.
 *
 * The label is the switch's accessibility label too — a bare Switch announces
 * only "on", which tells a screen-reader user nothing about what is on.
 */
const ToggleRow: React.FC<{
    label: string;
    hint: string;
    value: boolean;
    onChange: (v: boolean) => void;
}> = ({ label, hint, value, onChange }) => (
    <View style={styles.toggleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Text style={styles.toggleHint}>{hint}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onChange}
            accessibilityLabel={label}
            accessibilityRole="switch"
        />
    </View>
);

const HeroStat: React.FC<{ label: string; value: string; tone?: string }> = ({
    label,
    value,
    tone,
}) => (
    <View style={styles.heroStat}>
        <Text style={[styles.heroStatValue, !!tone && { color: tone }]} numberOfLines={1}>
            {value}
        </Text>
        <Text style={styles.heroStatLabel} numberOfLines={1}>
            {label}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },
    skeleton: { padding: theme.spacing[4] },
    mb: { marginBottom: theme.spacing[3] },

    chips: {
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    chip: {
        borderWidth: 1.5,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        justifyContent: 'center',
        minHeight: 36,
    },
    chipActive: { borderColor: c.borderStrong, backgroundColor: c.surfaceVariant },
    chipLabel: { ...theme.typeScale.labelMedium, color: c.textSecondary },
    chipLabelActive: { color: c.textPrimary },
    // The app's one "this is retired but still true" treatment — same slate
    // roles the stale-data hints use, not a colour invented here.
    chipArchived: { borderColor: c.staleBorder, backgroundColor: c.staleBg },
    archivedText: { color: c.staleText },

    customRange: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    customField: { flex: 1, minWidth: 0 },

    toggles: {
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    toggleLabel: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    toggleHint: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },

    scopedTotalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        backgroundColor: c.surfaceVariant,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
    },
    scopedTotalLabel: { ...theme.typeScale.labelLarge, flex: 1, minWidth: 0, color: c.textPrimary },
    scopedTotalValue: { fontFamily: 'DMMono-Medium', fontSize: 16, color: c.dangerText },

    hero: {
        backgroundColor: c.successBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[4],
    },
    heroLoss: { backgroundColor: c.dangerBg },
    heroEmpty: {
        backgroundColor: c.surfaceVariant,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[5],
        gap: theme.spacing[1],
    },
    heroEmptyLabel: { ...theme.typeScale.h2, color: c.textPrimary },
    heroEmptyBody: { ...theme.typeScale.bodyMedium, color: c.textSecondary },
    heroEmptyCta: {
        ...theme.typeScale.labelLarge,
        color: c.textLink,
        marginTop: theme.spacing[2],
    },
    heroLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.successText,
    },
    heroLabelLoss: { color: c.dangerText },
    heroValue: {
        fontFamily: 'DMMono-Medium',
        fontSize: 34,
        lineHeight: 42,
        color: c.successText,
    },
    heroValueLoss: { color: c.dangerText },
    heroStats: {
        flexDirection: 'row',
        marginTop: theme.spacing[3],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
    },
    heroStat: { flex: 1, minWidth: 0 },
    heroStatValue: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    heroStatLabel: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textSecondary },

    farmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 56,
    },
    farmName: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    farmMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },
    farmNet: { fontFamily: 'DMMono-Medium', fontSize: 15 },

    ribbon: {
        flexDirection: 'row',
        height: 10,
        marginHorizontal: theme.spacing[5],
        marginTop: theme.spacing[1],
        marginBottom: theme.spacing[2],
        overflow: 'hidden',
        borderRadius: 2,
    },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2.5],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 40,
    },
    swatch: { width: 9, height: 9 },
    catName: { ...theme.typeScale.bodyMedium, flex: 1, minWidth: 0, color: c.textPrimary },
    catAmount: { fontFamily: 'DMMono-Regular', fontSize: 14, color: c.textSecondary },
    catShare: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: c.textTertiary,
        width: 38,
        textAlign: 'right',
    },

    creditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        backgroundColor: c.dangerBg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.borderDefault,
        marginTop: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        minHeight: 44,
    },
    creditTitle: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    creditMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.dangerText },
    creditAmount: { fontFamily: 'DMMono-Medium', fontSize: 16, color: c.dangerText },

    entry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 44,
    },
    entryArchived: { backgroundColor: c.staleBg, borderLeftWidth: 3, borderLeftColor: c.staleBorder },
    entryTitle: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    entryMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },
    entryAmount: { fontFamily: 'DMMono-Medium', fontSize: 15 },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    note: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
    },
});

export default MoneyScreen;
