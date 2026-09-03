import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { theme } from '../../theme';
import { todayLocalISODate } from '../../utils/localDate';
import {
    expensesApi,
    Expense,
    CycleFinancials,
    ExpenseCategory,
} from '../../api/expenses';
import { cropsApi } from '../../api/crops';
import { apiErrorMessage } from '../../api/errors';

const CATEGORY_OPTIONS = Object.values(ExpenseCategory);

const formatMoney = (value: number) => `₹${Number(value).toFixed(2)}`;

const todayISO = () => todayLocalISODate();

export const ExpensesScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { cropId, pondName } = route.params as { cropId: string; pondName?: string };

    // Data state
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [financials, setFinancials] = useState<CycleFinancials | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState<ExpenseCategory>(ExpenseCategory.FEED);
    const [formDescription, setFormDescription] = useState('');
    const [formDate, setFormDate] = useState(todayISO());
    // ponytail: a crop belongs to exactly one pond, so pondId is derived from the crop, not typed.
    const [pondId, setPondId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async (showRefreshIndicator = false) => {
        if (showRefreshIndicator) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const [expensesRes, financialsRes, cropRes] = await Promise.all([
                expensesApi.findByCycle(cropId),
                expensesApi.getCycleFinancials(cropId),
                cropsApi.getById(cropId),
            ]);
            setExpenses(expensesRes.data);
            setFinancials(financialsRes.data);
            setPondId(cropRes.data.pondId);
        } catch (err: any) {
            setError(apiErrorMessage(err, 'Failed to load expenses'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [cropId]);

    // Load on mount
    // Refetch on FOCUS, not on mount. React Navigation keeps a screen mounted
    // once opened, so a mount-only effect never ran again — the page kept
    // showing figures from before whatever was just logged elsewhere.
    useFocusEffect(React.useCallback(() => {
        void loadData();
    }, [loadData]));

    const handleRefresh = useCallback(() => {
        void loadData(true);
    }, [loadData]);

    const handleAddExpense = async () => {
        if (!formAmount.trim() || isNaN(parseFloat(formAmount))) {
            Alert.alert(t('finance.validationError'), t('finance.validAmountRequired'));
            return;
        }
        if (!formDate.trim()) {
            Alert.alert(t('finance.validationError'), t('finance.dateRequired'));
            return;
        }
        if (!pondId) {
            Alert.alert(t('finance.validationError'), t('finance.pondIdRequired'));
            return;
        }

        setIsSaving(true);
        try {
            await expensesApi.create({
                cropId,
                pondId,
                date: formDate.trim(),
                category: formCategory,
                amount: parseFloat(formAmount),
                description: formDescription.trim() || undefined,
            });
            // Reset form
            setFormAmount('');
            setFormDescription('');
            setFormDate(todayISO());
            setFormCategory(ExpenseCategory.FEED);
            setShowForm(false);
            // Refresh data
            void loadData(true);
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('finance.saveError')));
        } finally {
            setIsSaving(false);
        }
    };

    const renderFinancialsSummary = () => {
        if (!financials) return null;

        const netPositive = financials.netProfit >= 0;
        const netColor = netPositive
            ? theme.roles.light.successText
            : theme.roles.light.dangerText;

        return (
            <Card style={styles.summaryCard} variant="elevated">
                <Text style={styles.sectionTitle}>{t('finance.cycleFinancials')}</Text>

                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.totalRevenue')}</Text>
                        <Text style={styles.summaryValue}>
                            {formatMoney(financials.totalRevenue)}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.totalExpenses')}</Text>
                        <Text style={[styles.summaryValue, { color: theme.roles.light.dangerText }]}>
                            {formatMoney(financials.totalExpenses)}
                        </Text>
                    </View>
                </View>

                {/* Revenue has no "add" form because it isn't entered here — it's
                    computed from recorded harvest sales. Say so plainly (issue
                    #35: users saw a Revenue figure with no way to add to it), and
                    link straight to the harvest-recording flow when we know the
                    pond. */}
                <View style={styles.revenueNote}>
                    <MaterialCommunityIcons name="information-outline" size={15} color={theme.roles.light.textSecondary} />
                    <Text style={styles.revenueNoteText}>{t('finance.revenueFromHarvests')}</Text>
                </View>
                {pondId && (
                    <TouchableOpacity
                        style={styles.revenueCta}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('HarvestLog', { pondId, pondName, cropId })}
                        accessibilityRole="button"
                        accessibilityLabel={t('finance.recordHarvestSale')}
                    >
                        <MaterialCommunityIcons name="basket-plus-outline" size={16} color={theme.roles.light.primary} />
                        <Text style={styles.revenueCtaText}>{t('finance.recordHarvestSale')}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                )}

                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.netProfit')}</Text>
                        <Text style={[styles.summaryValue, { color: netColor }]}>
                            {formatMoney(financials.netProfit)}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.marginPercent')}</Text>
                        <Text style={[styles.summaryValue, { color: netColor }]}>
                            {Number(financials.marginPercent).toFixed(2)}%
                        </Text>
                    </View>
                </View>

                {Object.keys(financials.expensesByCategory).length > 0 && (
                    <View style={styles.categoryBreakdown}>
                        <Text style={styles.breakdownTitle}>{t('finance.expensesByCategory')}</Text>
                        {Object.entries(financials.expensesByCategory).map(([cat, amt]) => (
                            <View key={cat} style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>{cat}</Text>
                                <Text style={styles.breakdownAmount}>{formatMoney(amt)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {financials.breakEvenPricePerKg != null && (
                    <View style={styles.breakEvenBox}>
                        <Text style={styles.breakdownTitle}>{t('finance.breakEven', 'Break-even price')}</Text>
                        <Text style={styles.breakEvenValue}>{formatMoney(financials.breakEvenPricePerKg)}/kg</Text>
                        <Text style={styles.breakEvenHint}>
                            {t('finance.breakEvenHint', {
                                kg: Number(financials.totalHarvestKg ?? 0).toFixed(0),
                                defaultValue: `Sell above this to profit (on ${Number(financials.totalHarvestKg ?? 0).toFixed(0)} kg harvested)`,
                            })}
                        </Text>
                    </View>
                )}
            </Card>
        );
    };

    const renderExpenseItem = ({ item }: { item: Expense }) => (
        <Card style={styles.expenseCard} variant="outlined">
            <View style={styles.expenseHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: theme.roles.light.infoBg }]}>
                    <MaterialCommunityIcons name="cash" size={16} color={theme.roles.light.infoText} />
                </View>
                <View style={styles.expenseInfo}>
                    <Text style={styles.expenseCategory} numberOfLines={1}>{item.category}</Text>
                    {item.description ? (
                        <Text style={styles.expenseNotes} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                </View>
                <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount} numberOfLines={1}>{formatMoney(item.amount)}</Text>
                    <Text style={styles.expenseDate} numberOfLines={1}>{item.date}</Text>
                </View>
            </View>
        </Card>
    );

    const renderAddForm = () => (
        <Card style={styles.formCard} variant="elevated">
            <Text style={styles.sectionTitle}>{t('finance.addExpense')}</Text>

            <Input
                label={t('finance.fieldAmount')}
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder={t('finance.placeholderAmount')}
                keyboardType="decimal-pad"
                leftIcon="currency-inr"
                required
            />

            <Input
                label={t('common.date')}
                value={formDate}
                onChangeText={setFormDate}
                placeholder={t('finance.placeholderDate')}
                leftIcon="calendar"
                required
            />

            <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('finance.fieldCategory')}</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScroll}
                >
                    {CATEGORY_OPTIONS.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                formCategory === cat && styles.categoryChipActive,
                            ]}
                            onPress={() => setFormCategory(cat)}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.categoryChipLabel,
                                    formCategory === cat && styles.categoryChipLabelActive,
                                ]}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <Input
                label={t('common.notes')}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder={t('finance.placeholderNotes')}
                leftIcon="note-text-outline"
                multiline
                numberOfLines={2}
            />

            <View style={styles.formActions}>
                <Button
                    title={t('common.cancel')}
                    onPress={() => setShowForm(false)}
                    variant="outlined"
                    style={styles.cancelBtn}
                />
                <Button
                    title={t('finance.saveExpense')}
                    onPress={handleAddExpense}
                    loading={isSaving}
                    style={styles.saveBtn}
                />
            </View>
        </Card>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={theme.roles.light.textPrimary}
                    />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('finance.expensesTitle')}</Text>
                    {pondName ? (
                        <Text style={styles.headerSubtitle}>{pondName}</Text>
                    ) : null}
                </View>
                <TouchableOpacity
                    onPress={() => setShowForm((v) => !v)}
                    style={styles.addBtn}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name={showForm ? 'close' : 'plus'}
                        size={24}
                        color={theme.roles.light.primary}
                    />
                </TouchableOpacity>
            </View>

            {/* Loading state */}
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                    <Text style={styles.loadingText}>{t('finance.loadingExpenses')}</Text>
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={theme.roles.light.dangerText}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                    <Button
                        title={t('common.retry')}
                        onPress={() => void loadData()}
                        variant="outlined"
                        style={styles.retryBtn}
                    />
                </View>
            ) : (
                <FlatList
                    data={expenses}
                    keyExtractor={(item) => item.id}
                    renderItem={renderExpenseItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            colors={[theme.roles.light.primary]}
                            tintColor={theme.roles.light.primary}
                        />
                    }
                    ListHeaderComponent={
                        <>
                            {renderFinancialsSummary()}
                            {showForm ? renderAddForm() : null}
                            {expenses.length > 0 ? (
                                <Text style={styles.listHeading}>{t('finance.allExpenses')}</Text>
                            ) : null}
                        </>
                    }
                    ListEmptyComponent={
                        !showForm ? (
                            <EmptyState
                                icon="cash-remove"
                                title={t('finance.noExpensesTitle')}
                                subtitle={t('finance.noExpensesSubtitle')}
                                actionLabel={t('finance.addExpense')}
                                onAction={() => setShowForm(true)}
                            />
                        ) : null
                    }
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    backBtn: {
        padding: theme.spacing[4],
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
    },
    headerSubtitle: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[0.5],
    },
    addBtn: {
        padding: theme.spacing[4],
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing[8],
    },
    loadingText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[4],
    },
    errorText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.dangerText,
        textAlign: 'center',
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    retryBtn: {
        marginTop: theme.spacing[2],
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    // Financials summary card
    summaryCard: {
        marginBottom: theme.spacing[4],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    summaryRow: {
        flexDirection: 'row',
        marginBottom: theme.spacing[3],
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: theme.roles.light.borderDefault,
        marginHorizontal: theme.spacing[2],
    },
    summaryLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
        textAlign: 'center',
    },
    summaryValue: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        textAlign: 'center',
    },
    revenueNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.sm,
        backgroundColor: theme.roles.light.surfaceVariant,
        marginBottom: theme.spacing[2],
    },
    revenueNoteText: {
        flex: 1,
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    revenueCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    revenueCtaText: {
        flex: 1,
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
        fontWeight: '600',
    },
    categoryBreakdown: {
        marginTop: theme.spacing[4],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        paddingTop: theme.spacing[4],
    },
    breakEvenBox: {
        marginTop: theme.spacing[4],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        paddingTop: theme.spacing[4],
    },
    breakEvenValue: {
        ...theme.typeScale.numericMedium,
        color: theme.roles.light.primary,
    },
    breakEvenHint: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[1],
    },
    breakdownTitle: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[1.5],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    breakdownLabel: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        flex: 1,
    },
    breakdownAmount: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    // Expense list item
    listHeading: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    expenseCard: {
        marginBottom: theme.spacing[3],
    },
    expenseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing[3],
    },
    expenseInfo: {
        flex: 1,
    },
    expenseCategory: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '500',
    },
    expenseNotes: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[0.5],
    },
    expenseRight: {
        alignItems: 'flex-end',
        flexShrink: 0,
        marginLeft: theme.spacing[2],
    },
    expenseAmount: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    expenseDate: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[0.5],
    },
    // Add expense form
    formCard: {
        marginBottom: theme.spacing[4],
    },
    fieldGroup: {
        marginBottom: theme.spacing[4],
    },
    fieldLabel: {
        fontFamily: undefined,
        fontSize: theme.typeScale.labelMedium.fontSize,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    categoryScroll: {
        gap: theme.spacing[2],
        paddingBottom: theme.spacing[1],
    },
    categoryChip: {
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    categoryChipActive: {
        backgroundColor: theme.roles.light.primary + '20',
        borderColor: theme.roles.light.primary,
    },
    categoryChipLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
    },
    categoryChipLabelActive: {
        color: theme.roles.light.primary,
    },
    formActions: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    cancelBtn: {
        flex: 1,
    },
    saveBtn: {
        flex: 1,
    },
});
