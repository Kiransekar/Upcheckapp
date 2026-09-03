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
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
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
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';
import { reportsApi, type FinancialReport } from '../../api/reports';
import { transactionsApi, type Transaction } from '../../api/transactions';
import { creditApi, type CreditLedger } from '../../api/credit';
import { farmsApi, type Farm } from '../../api/farms';
import { fetchMoneyOverview, type MoneyEntry } from '../../api/moneyOverview';
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

/** Recent entries shown before "All ›" takes over. */
const RECENT_COUNT = 6;

/** Scope value meaning "every farm I can see financials for". */
const ALL = 'all';

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
    for (const r of reports) {
        revenue += Number(r.revenue || 0);
        totalExpenses += Number(r.totalExpenses || 0);
        profit += Number(r.profit || 0);
        for (const row of r.expensesByCategory ?? []) {
            byCategory[row.category] = (byCategory[row.category] || 0) + Number(row.amount || 0);
        }
    }
    return {
        revenue,
        totalExpenses,
        profit,
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
        queryKey: qk.money(),
        queryFn: () => fetchMoneyOverview(),
    });

    useRefetchOnFocus(qk.money());

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
                        onPress={() => setScope(ALL)}
                    />
                    {visibleFarms.map((farm) => (
                        <Chip
                            key={farm.id}
                            label={farm.name}
                            active={activeScope === farm.id}
                            onPress={() => setScope(farm.id)}
                        />
                    ))}
                </ScrollView>
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
                                        onPress={() => setScope(farm.id)}
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
                        const detail = isHarvest
                            ? tx.buyerName
                                ? t('finance.harvestSoldTo', { buyer: tx.buyerName })
                                : t('finance.harvestSale')
                            : tx.paymentMethod;
                        return (
                            <View key={tx.id} style={styles.entry}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.entryTitle} numberOfLines={1}>
                                        {tx.description || (isHarvest ? t('finance.harvestSale') : tx.category)}
                                    </Text>
                                    <Text style={styles.entryMeta} numberOfLines={1}>
                                        {[shortDate(tx.transactionDate), farm, detail]
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
