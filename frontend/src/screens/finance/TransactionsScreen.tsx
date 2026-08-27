import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
    ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { theme } from '../../theme';
import { toLocalISODate } from '../../utils/localDate';
import {
    transactionsApi,
    Transaction,
    CreateTransactionDto,
    TransactionSummary,
} from '../../api/transactions';

type FilterKey = 'all' | 'income' | 'expense';

const toISODate = (d: Date): string => toLocalISODate(d);

const formatRupees = (value: number): string => `₹${Number(value).toFixed(2)}`;

export const TransactionsScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};

    const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
        { key: 'all', label: t('finance.filterAll') },
        { key: 'income', label: t('finance.filterIncome') },
        { key: 'expense', label: t('finance.filterExpense') },
    ];

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<TransactionSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('all');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formType, setFormType] = useState<'income' | 'expense'>('income');
    const [formDate, setFormDate] = useState(toISODate(new Date()));
    const [formError, setFormError] = useState<string | null>(null);

    const fetchAll = useCallback(async (activeFilter: FilterKey = filter) => {
        try {
            const typeParam =
                activeFilter === 'all' ? undefined : (activeFilter as 'income' | 'expense');

            const [txRes, sumRes] = await Promise.all([
                transactionsApi.getAll(farmId, typeParam),
                transactionsApi.getSummary(farmId),
            ]);
            setTransactions(txRes.data);
            setSummary(sumRes.data);
        } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('finance.loadError'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [farmId, filter]);

    // Initial load
    // Refetch on FOCUS, not on mount. React Navigation keeps a screen mounted
    // once opened, so a mount-only effect never ran again — the page kept
    // showing figures from before whatever was just logged elsewhere.
    useFocusEffect(React.useCallback(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []));

    const handleFilterChange = useCallback((key: FilterKey) => {
        setFilter(key);
        setIsLoading(true);
        fetchAll(key);
    }, [fetchAll]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchAll(filter);
    }, [fetchAll, filter]);

    const resetForm = () => {
        setFormAmount('');
        setFormCategory('');
        setFormDescription('');
        setFormType('income');
        setFormDate(toISODate(new Date()));
        setFormError(null);
    };

    const handleSubmit = async () => {
        const parsedAmount = parseFloat(formAmount);
        if (!formCategory.trim()) {
            setFormError(t('finance.categoryRequired'));
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setFormError(t('finance.validPositiveAmount'));
            return;
        }
        const parsedDate = new Date(formDate);
        if (!formDate.trim() || isNaN(parsedDate.getTime())) {
            setFormError(t('finance.dateRequiredDot'));
            return;
        }

        setFormError(null);
        setIsSubmitting(true);

        const payload: CreateTransactionDto = {
            farmId,
            transactionDate: parsedDate.toISOString(),
            type: formType,
            category: formCategory.trim(),
            amount: parsedAmount,
            description: formDescription.trim() || undefined,
        };

        try {
            await transactionsApi.create(payload);
            resetForm();
            setShowForm(false);
            setIsLoading(true);
            await fetchAll(filter);
        } catch (err: any) {
            setFormError(err?.response?.data?.message ?? t('finance.saveTransactionError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderSummaryCard = () => {
        if (!summary) return null;
        const netPositive = summary.netProfit >= 0;
        return (
            <Card style={styles.summaryCard} variant="elevated">
                <Text style={styles.summaryTitle}>{t('finance.financialSummary')}</Text>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.totalIncome')}</Text>
                        <Text style={[styles.summaryValue, styles.incomeText]}>
                            {formatRupees(summary.totalIncome)}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.totalExpense')}</Text>
                        <Text style={[styles.summaryValue, styles.expenseText]}>
                            {formatRupees(summary.totalExpense)}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{t('finance.netProfit')}</Text>
                        <Text
                            style={[
                                styles.summaryValue,
                                netPositive ? styles.incomeText : styles.expenseText,
                            ]}
                        >
                            {netPositive ? '+' : ''}{formatRupees(summary.netProfit)}
                        </Text>
                    </View>
                </View>
            </Card>
        );
    };

    const renderFilterChips = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBarWrap}
            contentContainerStyle={styles.chipBar}
        >
            {FILTER_CHIPS.map((chip) => (
                <TouchableOpacity
                    key={chip.key}
                    style={[
                        styles.chip,
                        filter === chip.key && styles.chipActive,
                    ]}
                    onPress={() => handleFilterChange(chip.key)}
                    activeOpacity={0.7}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.chipLabel,
                            filter === chip.key && styles.chipLabelActive,
                        ]}
                    >
                        {chip.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderTransactionItem = ({ item }: { item: Transaction }) => {
        const isIncome = item.type === 'income';
        const dateStr = new Date(item.transactionDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });

        return (
            <Card style={styles.txCard} variant="outlined">
                <View style={styles.txRow}>
                    <View
                        style={[
                            styles.txIconBg,
                            { backgroundColor: isIncome ? theme.roles.light.successBg : theme.roles.light.dangerBg },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={isIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                            size={22}
                            color={isIncome ? theme.roles.light.successText : theme.roles.light.dangerText}
                        />
                    </View>
                    <View style={styles.txInfo}>
                        <Text style={styles.txCategory} numberOfLines={1}>{item.category}</Text>
                        {item.description ? (
                            <Text style={styles.txDescription} numberOfLines={1}>
                                {item.description}
                            </Text>
                        ) : null}
                        <Text style={styles.txDate} numberOfLines={1}>{dateStr}</Text>
                    </View>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.txAmount,
                            isIncome ? styles.incomeText : styles.expenseText,
                        ]}
                    >
                        {isIncome ? '+' : '-'}{formatRupees(item.amount)}
                    </Text>
                </View>
            </Card>
        );
    };

    const renderAddForm = () => (
        <Card style={styles.formCard} variant="elevated">
            <Text style={styles.formTitle}>{t('finance.addTransaction')}</Text>

            {/* Type Toggle */}
            <View style={styles.typeToggleRow}>
                <TouchableOpacity
                    style={[
                        styles.typeToggleBtn,
                        formType === 'income' && styles.typeToggleBtnIncomeActive,
                    ]}
                    onPress={() => setFormType('income')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name="arrow-down-circle-outline"
                        size={16}
                        color={
                            formType === 'income'
                                ? theme.roles.light.successText
                                : theme.roles.light.textSecondary
                        }
                    />
                    <Text
                        style={[
                            styles.typeToggleLabel,
                            formType === 'income' && styles.typeToggleLabelIncomeActive,
                        ]}
                    >
                        {t('finance.typeIncome')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.typeToggleBtn,
                        formType === 'expense' && styles.typeToggleBtnExpenseActive,
                    ]}
                    onPress={() => setFormType('expense')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name="arrow-up-circle-outline"
                        size={16}
                        color={
                            formType === 'expense'
                                ? theme.roles.light.dangerText
                                : theme.roles.light.textSecondary
                        }
                    />
                    <Text
                        style={[
                            styles.typeToggleLabel,
                            formType === 'expense' && styles.typeToggleLabelExpenseActive,
                        ]}
                    >
                        {t('finance.typeExpense')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('finance.fieldAmountLabel')}</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('finance.placeholderAmount')}
                        placeholderTextColor={theme.roles.light.textDisabled}
                        keyboardType="decimal-pad"
                        value={formAmount}
                        onChangeText={setFormAmount}
                    />
                </View>
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('finance.fieldCategoryLabel')}</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('finance.placeholderCategory')}
                        placeholderTextColor={theme.roles.light.textDisabled}
                        value={formCategory}
                        onChangeText={setFormCategory}
                    />
                </View>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('finance.fieldDescriptionLabel')}</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('finance.placeholderDescription')}
                        placeholderTextColor={theme.roles.light.textDisabled}
                        value={formDescription}
                        onChangeText={setFormDescription}
                    />
                </View>
            </View>

            {/* Date */}
            <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('finance.fieldDateLabel')}</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('finance.placeholderDateAlt')}
                        placeholderTextColor={theme.roles.light.textDisabled}
                        value={formDate}
                        onChangeText={setFormDate}
                    />
                </View>
            </View>

            {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
            ) : null}

            <View style={styles.formActions}>
                <Button
                    title={t('common.cancel')}
                    variant="outlined"
                    onPress={() => {
                        resetForm();
                        setShowForm(false);
                    }}
                    style={styles.cancelBtn}
                />
                <Button
                    title={t('common.save')}
                    variant="primary"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    style={styles.saveBtn}
                />
            </View>
        </Card>
    );

    const listHeader = (
        <>
            {renderSummaryCard()}
            {renderFilterChips()}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                    resetForm();
                    setShowForm(!showForm);
                }}
                activeOpacity={0.8}
            >
                <MaterialCommunityIcons
                    name={showForm ? 'close' : 'plus-circle-outline'}
                    size={20}
                    color={theme.roles.light.primary}
                />
                <Text style={styles.addButtonLabel}>
                    {showForm ? t('finance.closeForm') : t('finance.addTransaction')}
                </Text>
            </TouchableOpacity>
            {showForm ? renderAddForm() : null}
        </>
    );

    if (isLoading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={theme.roles.light.textPrimary}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {farmName
                            ? t('finance.transactionsTitleWithFarm', { farmName })
                            : t('finance.transactionsTitle')}
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                    <Text style={styles.loadingText}>{t('finance.loadingTransactions')}</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={theme.roles.light.textPrimary}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {farmName
                        ? t('finance.transactionsTitleWithFarm', { farmName })
                        : t('finance.transactionsTitle')}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderTransactionItem}
                ListHeaderComponent={listHeader}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="currency-inr"
                        title={t('finance.noTransactionsTitle')}
                        subtitle={t('finance.noTransactionsSubtitle')}
                        actionLabel={t('finance.addTransaction')}
                        onAction={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                    />
                }
                keyboardShouldPersistTaps="handled"
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[4],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    backBtn: {
        marginRight: theme.spacing[3],
        padding: theme.spacing[1],
    },
    headerTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        flex: 1,
    },
    headerSpacer: {
        width: 32,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing[3],
    },
    loadingText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    // Summary card
    summaryCard: {
        marginBottom: theme.spacing[4],
    },
    summaryTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: theme.roles.light.borderDefault,
    },
    summaryLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
        textAlign: 'center',
    },
    summaryValue: {
        ...theme.typeScale.labelLarge,
        textAlign: 'center',
    },
    incomeText: {
        color: theme.roles.light.successText,
    },
    expenseText: {
        color: theme.roles.light.dangerText,
    },
    // Filter chips
    chipBarWrap: {
        marginBottom: theme.spacing[4],
        flexGrow: 0,
    },
    chipBar: {
        flexDirection: 'row',
        gap: theme.spacing[2],
    },
    chip: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipActive: {
        backgroundColor: theme.roles.light.primary + '18',
        borderColor: theme.roles.light.primary,
    },
    chipLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    chipLabelActive: {
        color: theme.roles.light.primary,
    },
    // Add button
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[3],
        backgroundColor: theme.roles.light.infoBg,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.infoBorder,
    },
    addButtonLabel: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.primary,
        marginLeft: theme.spacing[2],
    },
    // Transaction list items
    txCard: {
        marginBottom: theme.spacing[3],
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    txIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing[3],
    },
    txInfo: {
        flex: 1,
    },
    txCategory: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '500',
    },
    txDescription: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[0.5],
    },
    txDate: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[1],
    },
    txAmount: {
        ...theme.typeScale.labelLarge,
        marginLeft: theme.spacing[3],
    },
    // Add form
    formCard: {
        marginBottom: theme.spacing[4],
    },
    formTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    typeToggleRow: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    typeToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
        borderWidth: 1.5,
        borderColor: 'transparent',
        gap: theme.spacing[2],
    },
    typeToggleBtnIncomeActive: {
        backgroundColor: theme.roles.light.successBg,
        borderColor: theme.roles.light.successBorder,
    },
    typeToggleBtnExpenseActive: {
        backgroundColor: theme.roles.light.dangerBg,
        borderColor: theme.roles.light.dangerBorder,
    },
    typeToggleLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    typeToggleLabelIncomeActive: {
        color: theme.roles.light.successText,
    },
    typeToggleLabelExpenseActive: {
        color: theme.roles.light.dangerText,
    },
    fieldGroup: {
        marginBottom: theme.spacing[4],
    },
    fieldLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1.5],
    },
    inputContainer: {
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
        minHeight: 44,
        justifyContent: 'center',
    },
    input: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    errorText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        marginBottom: theme.spacing[3],
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
