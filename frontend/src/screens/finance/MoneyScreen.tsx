/**
 * Money — artboard 3d. The tab, not the ledger.
 *
 * The Money tab used to open straight into the transaction list: hundreds of
 * rows, newest first, which answers "what did I write down" and not "am I
 * making money". This screen answers the second question in its first
 * screenful — net, then where the money went, then what is owed — and hands
 * the list off behind "All ›".
 *
 * Every figure here is farm-scoped and gated on VIEW_FINANCIALS, the same
 * capability that decides whether this tab exists at all.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';
import { reportsApi, type FinancialReport } from '../../api/reports';
import { transactionsApi, type Transaction } from '../../api/transactions';
import { creditApi, type CreditLedger } from '../../api/credit';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { usePermissions } from '../../hooks/usePermissions';

const c = theme.roles.light;

/** Recent entries shown before "All ›" takes over. */
const RECENT_COUNT = 6;

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

const shortDate = (iso: string) =>
    formatDate(iso);

export const MoneyScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);
    const farmId = route?.params?.farmId ?? selectedFarm?.id;
    const farmName = route?.params?.farmName ?? selectedFarm?.name;
    const perms = usePermissions(farmId);

    const [report, setReport] = useState<FinancialReport | null>(null);
    const [entries, setEntries] = useState<Transaction[]>([]);
    const [credit, setCredit] = useState<CreditLedger[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!farmId) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        const [reportRes, txRes, creditRes] = await Promise.all([
            reportsApi.getFinancialReport(farmId).catch(() => ({ data: null as FinancialReport | null })),
            transactionsApi.getAll(farmId).catch(() => ({ data: [] as Transaction[] })),
            // Credit is a separate ledger and may simply not exist for a farmer
            // who buys nothing on account.
            creditApi.list().catch(() => ({ data: [] as CreditLedger[] })),
        ]);
        setReport(reportRes.data);
        setEntries(txRes.data);
        setCredit(creditRes.data);
        setLoading(false);
        setRefreshing(false);
    }, [farmId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

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

    const margin =
        report && report.revenue > 0 ? Math.round((report.profit / report.revenue) * 100) : null;

    const header = (
        <ScreenHeader
            eyebrow={farmName ?? null}
            title={t('finance.moneyTitle')}
            actionLabel={perms.canViewFinancials ? t('finance.addEntry') : undefined}
            onAction={() => navigation.navigate('Transactions', { farmId, farmName })}
        />
    );

    if (!farmId) {
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

    if (loading) {
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

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                {/*
                  * Net first, and coloured by whether it IS a profit. The three
                  * figures under it are what the net is made of, so a farmer can
                  * see immediately whether a bad number is an income problem or
                  * a cost problem.
                  */}
                <View style={[styles.hero, (report?.profit ?? 0) < 0 && styles.heroLoss]}>
                    <Text style={[styles.heroLabel, (report?.profit ?? 0) < 0 && styles.heroLabelLoss]}>
                        {t('finance.netSoFar')}
                    </Text>
                    <Text style={[styles.heroValue, (report?.profit ?? 0) < 0 && styles.heroValueLoss]}>
                        {report ? `${report.profit >= 0 ? '+' : ''}${inr(report.profit)}` : '—'}
                    </Text>
                    <View style={styles.heroStats}>
                        <HeroStat label={t('finance.totalIncome')} value={report ? inr(report.revenue) : '—'} />
                        <HeroStat label={t('finance.totalExpense')} value={report ? inr(report.totalExpenses) : '—'} />
                        <HeroStat
                            label={t('finance.marginPercent')}
                            value={margin != null ? `${margin}%` : '—'}
                        />
                    </View>
                </View>

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
                        onPress={() => navigation.navigate('Transactions', { farmId, farmName })}
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
                    onAction={() => navigation.navigate('Transactions', { farmId, farmName })}
                />
                {recent.length === 0 ? (
                    <Text style={styles.empty}>{t('finance.noEntries')}</Text>
                ) : (
                    recent.map((tx) => (
                        <View key={tx.id} style={styles.entry}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.entryTitle} numberOfLines={1}>
                                    {tx.description || tx.category}
                                </Text>
                                <Text style={styles.entryMeta} numberOfLines={1}>
                                    {[shortDate(tx.transactionDate), tx.paymentMethod]
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
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const HeroStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.heroStat}>
        <Text style={styles.heroStatValue} numberOfLines={1}>
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

    hero: {
        backgroundColor: c.successBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[4],
    },
    heroLoss: { backgroundColor: c.dangerBg },
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
});

export default MoneyScreen;
