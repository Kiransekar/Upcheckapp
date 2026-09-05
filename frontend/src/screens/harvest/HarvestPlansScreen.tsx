import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { theme } from '../../theme';
import { harvestPlansApi, HarvestPlan } from '../../api/harvestPlans';
import { apiErrorMessage } from '../../api/errors';
import { todayLocalISODate, toLocalISODate } from '../../utils/localDate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
    planned: {
        labelKey: 'harvestPlans.statusPlanned',
        color: theme.roles.light.infoText,
        bg: theme.roles.light.infoBg,
    },
    completed: {
        labelKey: 'harvestPlans.statusCompleted',
        color: theme.roles.light.successText,
        bg: theme.roles.light.successBg,
    },
    cancelled: {
        labelKey: 'harvestPlans.statusCancelled',
        color: theme.roles.light.textDisabled,
        bg: theme.roles.light.surfaceVariant,
    },
};

function getStatusConfig(status: string) {
    return STATUS_CONFIG[status] ?? STATUS_CONFIG.planned;
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    // Bucket by the farm's local (IST) calendar day, not UTC — a harvest stamped
    // late-evening IST must not display under the next UTC day (DATE-1).
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr.split('T')[0] : toLocalISODate(d);
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

interface PlanCardProps {
    plan: HarvestPlan;
    farmId?: string;
    onComplete: (plan: HarvestPlan) => void;
    onDelete: (plan: HarvestPlan) => void;
    isActioning: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onComplete, onDelete, isActioning }) => {
    const { t } = useTranslation();
    const sc = getStatusConfig(plan.status);
    const isPlanned = plan.status === 'planned';

    return (
        <Card style={styles.planCard}>
            {/* Header row: date + status badge */}
            <View style={styles.planHeader}>
                <View style={styles.planDateRow}>
                    <MaterialCommunityIcons
                        name="calendar-outline"
                        size={16}
                        color={theme.roles.light.textSecondary}
                    />
                    <Text style={styles.planDate}>{formatDate(plan.plannedHarvestDate)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.color }]}>{t(sc.labelKey)}</Text>
                </View>
            </View>

            {/* Metrics row */}
            <View style={styles.metricsRow}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{t('harvestPlans.targetWeight', 'Target Weight')}</Text>
                    <Text style={styles.metricValue}>
                        {plan.targetWeightKg != null ? `${plan.targetWeightKg} kg` : '—'}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{t('harvestPlans.pricePerKg', 'Price / kg')}</Text>
                    <Text style={styles.metricValue}>
                        {plan.expectedPricePerKg != null ? `₹${plan.expectedPricePerKg}` : '—'}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>{t('harvestPlans.expRevenue', 'Exp. Revenue')}</Text>
                    <Text style={styles.metricValue}>
                        {plan.expectedRevenue != null ? `₹${plan.expectedRevenue}` : '—'}
                    </Text>
                </View>
            </View>

            {/* Actual values (for completed plans) */}
            {plan.status === 'completed' && (
                <View style={[styles.metricsRow, styles.actualRow]}>
                    <View style={styles.metric}>
                        <Text style={styles.metricLabelActual}>{t('harvestPlans.actualWeight', 'Actual Weight')}</Text>
                        <Text style={styles.metricValueActual}>
                            {plan.actualWeightKg != null ? `${plan.actualWeightKg} kg` : '—'}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricLabelActual}>{t('harvestPlans.actualPrice', 'Actual Price')}</Text>
                        <Text style={styles.metricValueActual}>
                            {plan.actualPricePerKg != null ? `₹${plan.actualPricePerKg}` : '—'}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricLabelActual}>{t('harvestPlans.actRevenue', 'Act. Revenue')}</Text>
                        <Text style={styles.metricValueActual}>
                            {plan.actualRevenue != null ? `₹${plan.actualRevenue}` : '—'}
                        </Text>
                    </View>
                </View>
            )}

            {plan.notes ? (
                <Text style={styles.planNotes} numberOfLines={2}>{plan.notes}</Text>
            ) : null}

            {/* Action buttons — only for 'planned' status */}
            {isPlanned && (
                <View style={styles.actionRow}>
                    <Button
                        title={t('harvestPlans.markComplete', 'Mark Complete')}
                        variant="outlined"
                        onPress={() => onComplete(plan)}
                        disabled={isActioning}
                        style={styles.actionBtn}
                    />
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => onDelete(plan)}
                        disabled={isActioning}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={20}
                            color={theme.roles.light.dangerText}
                        />
                    </TouchableOpacity>
                </View>
            )}
        </Card>
    );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export const HarvestPlansScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName, cropId, farmId } = route.params ?? {};

    // List state
    const [plans, setPlans] = useState<HarvestPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actioningId, setActioningId] = useState<string | null>(null);

    // Mark-complete modal state
    const [completingPlan, setCompletingPlan] = useState<HarvestPlan | null>(null);
    const [completeWeight, setCompleteWeight] = useState('');
    const [completePrice, setCompletePrice] = useState('');

    // Add-plan form state
    const [showForm, setShowForm] = useState(false);
    const [formPlannedDate, setFormPlannedDate] = useState(
        todayLocalISODate(),
    );
    const [formTargetWeight, setFormTargetWeight] = useState('');
    const [formPricePerKg, setFormPricePerKg] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ------------------------------------------------------------------
    // Fetch
    // ------------------------------------------------------------------

    const fetchPlans = useCallback(async (refreshing = false) => {
        if (!refreshing) setIsLoading(true);
        try {
            const { data } = await harvestPlansApi.getAll(pondId);
            setPlans(data);
        } catch (err: any) {
            Alert.alert(
                t('common.error', 'Error'),
                apiErrorMessage(err, t('harvestPlans.loadFailed', 'Failed to load harvest plans')),
            );
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId, t]);

    useFocusEffect(
        useCallback(() => {
            void fetchPlans();
        }, [fetchPlans]),
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        void fetchPlans(true);
    }, [fetchPlans]);

    // ------------------------------------------------------------------
    // Complete
    // ------------------------------------------------------------------

    // Open the mark-complete modal (which collects the two required numbers).
    const handleComplete = useCallback((plan: HarvestPlan) => {
        setCompletingPlan(plan);
        setCompleteWeight('');
        setCompletePrice('');
    }, []);

    const submitComplete = useCallback(() => {
        if (!completingPlan) return;
        const weight = Number(completeWeight);
        const price = Number(completePrice);
        if (!(weight > 0) || !(price > 0)) {
            Alert.alert(
                t('harvestPlans.validationTitle', 'Validation Error'),
                t('harvestPlans.completeValuesRequired', 'Enter a valid harvest weight and price per kg.'),
            );
            return;
        }
        const plan = completingPlan;
        setActioningId(plan.id);
        setCompletingPlan(null);
        harvestPlansApi
            .complete(plan.id, {
                actualHarvestDate: new Date(),
                actualWeightKg: weight,
                actualPricePerKg: price,
                farmId: farmId ?? '',
                cropId: plan.cropId ?? cropId,
            })
            .then(() => fetchPlans())
            .catch((err: any) =>
                Alert.alert(
                    t('common.error', 'Error'),
                    apiErrorMessage(err, t('harvestPlans.completeFailed', 'Failed to complete harvest plan')),
                ),
            )
            .finally(() => setActioningId(null));
    }, [completingPlan, completeWeight, completePrice, farmId, cropId, fetchPlans, t]);

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    const handleDelete = useCallback((plan: HarvestPlan) => {
        Alert.alert(
            t('harvestPlans.deletePlan', 'Delete Plan'),
            t('harvestPlans.deleteConfirm', {
                date: formatDate(plan.plannedHarvestDate),
                defaultValue: `Delete the harvest plan for ${formatDate(plan.plannedHarvestDate)}?`,
            }),
            [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('common.delete', 'Delete'),
                    style: 'destructive',
                    onPress: () => {
                        setActioningId(plan.id);
                        harvestPlansApi
                            .delete(plan.id)
                            .then(() => fetchPlans())
                            .catch((err: any) =>
                                Alert.alert(
                                    t('common.error', 'Error'),
                                    apiErrorMessage(err, t('harvestPlans.deleteFailed', 'Failed to delete harvest plan')),
                                ),
                            )
                            .finally(() => setActioningId(null));
                    },
                },
            ],
        );
    }, [fetchPlans, t]);

    // ------------------------------------------------------------------
    // Create
    // ------------------------------------------------------------------

    const handleCreate = useCallback(async () => {
        if (!formPlannedDate.trim()) {
            Alert.alert(
                t('harvestPlans.validationTitle', 'Validation Error'),
                t('harvestPlans.dateRequired', 'Planned harvest date is required'),
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await harvestPlansApi.create({
                pondId,
                cropId: cropId ?? undefined,
                plannedHarvestDate: formPlannedDate.trim(),
                targetWeightKg: formTargetWeight ? Number(formTargetWeight) : undefined,
                expectedPricePerKg: formPricePerKg ? Number(formPricePerKg) : undefined,
                notes: formNotes.trim() || undefined,
            });
            // Reset form
            setFormPlannedDate(todayLocalISODate());
            setFormTargetWeight('');
            setFormPricePerKg('');
            setFormNotes('');
            setShowForm(false);
            await fetchPlans();
        } catch (err: any) {
            Alert.alert(
                t('common.error', 'Error'),
                apiErrorMessage(err, t('harvestPlans.createFailed', 'Failed to create harvest plan')),
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [pondId, cropId, formPlannedDate, formTargetWeight, formPricePerKg, formNotes, fetchPlans, t]);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    const renderPlan = useCallback(
        ({ item }: { item: HarvestPlan }) => (
            <PlanCard
                key={item.id}
                plan={item}
                farmId={farmId}
                onComplete={handleComplete}
                onDelete={handleDelete}
                isActioning={actioningId === item.id}
            />
        ),
        [farmId, handleComplete, handleDelete, actioningId],
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
                    <Text style={styles.headerTitle}>{t('harvestPlans.title', 'Harvest Plans')}</Text>
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

            {/* Full-page loading spinner */}
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                    <Text style={styles.loadingText}>{t('harvestPlans.loading', 'Loading harvest plans…')}</Text>
                </View>
            ) : (
                <FlatList
                    data={plans}
                    keyboardShouldPersistTaps="handled"
                    keyExtractor={(item) => item.id}
                    renderItem={renderPlan}
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
                        showForm ? (
                            <Card style={styles.formCard}>
                                <Text style={styles.formTitle}>{t('harvestPlans.addTitle', 'Add Harvest Plan')}</Text>

                                <Input
                                    label={t('harvestPlans.plannedDate', 'Planned Harvest Date')}
                                    value={formPlannedDate}
                                    onChangeText={setFormPlannedDate}
                                    placeholder={t('logs.datePlaceholder')}
                                    required
                                    leftIcon="calendar-outline"
                                />
                                <Input
                                    label={t('harvestPlans.targetWeightKg', 'Target Weight (kg)')}
                                    value={formTargetWeight}
                                    onChangeText={setFormTargetWeight}
                                    placeholder="e.g. 500"
                                    keyboardType="decimal-pad"
                                    leftIcon="weight-kilogram"
                                />
                                <Input
                                    label={t('harvestPlans.expectedPrice', 'Expected Price per kg (₹)')}
                                    value={formPricePerKg}
                                    onChangeText={setFormPricePerKg}
                                    placeholder="e.g. 280"
                                    keyboardType="decimal-pad"
                                    leftIcon="currency-inr"
                                />
                                <Input
                                    label={t('harvestPlans.notes', 'Notes')}
                                    value={formNotes}
                                    onChangeText={setFormNotes}
                                    placeholder={t('harvestPlans.notesPlaceholder', 'Optional notes about this harvest plan')}
                                    multiline
                                    numberOfLines={3}
                                    style={styles.textArea}
                                />

                                <View style={styles.formActions}>
                                    <Button
                                        title={t('common.cancel', 'Cancel')}
                                        variant="outlined"
                                        onPress={() => setShowForm(false)}
                                        style={styles.cancelBtn}
                                        disabled={isSubmitting}
                                    />
                                    <Button
                                        title={t('harvestPlans.addPlan', 'Add Plan')}
                                        onPress={() => void handleCreate()}
                                        loading={isSubmitting}
                                        style={styles.submitBtn}
                                    />
                                </View>
                            </Card>
                        ) : null
                    }
                    ListEmptyComponent={
                        !showForm ? (
                            <EmptyState
                                icon="calendar-check-outline"
                                title={t('harvestPlans.emptyTitle', 'No Harvest Plans')}
                                subtitle={t('harvestPlans.emptySubtitle', 'Tap + to add your first harvest plan for this pond.')}
                                actionLabel={t('harvestPlans.addPlan', 'Add Plan')}
                                onAction={() => setShowForm(true)}
                            />
                        ) : null
                    }
                />
            )}

            {/* Mark-complete modal — collects the two required numbers so the
                completed plan books real weight/price (never the old 0/0). */}
            <Modal
                visible={completingPlan !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setCompletingPlan(null)}
            >
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <Text style={styles.formTitle}>{t('harvestPlans.markComplete', 'Mark Complete')}</Text>
                        <Input
                            label={t('harvestPlans.actualWeightKg', 'Actual Weight (kg)')}
                            value={completeWeight}
                            onChangeText={setCompleteWeight}
                            placeholder="e.g. 480"
                            keyboardType="decimal-pad"
                            leftIcon="weight-kilogram"
                        />
                        <Input
                            label={t('harvestPlans.actualPricePerKg', 'Actual Price per kg (₹)')}
                            value={completePrice}
                            onChangeText={setCompletePrice}
                            placeholder="e.g. 290"
                            keyboardType="decimal-pad"
                            leftIcon="currency-inr"
                        />
                        <View style={styles.formActions}>
                            <Button
                                title={t('common.cancel', 'Cancel')}
                                variant="outlined"
                                onPress={() => setCompletingPlan(null)}
                                style={styles.cancelBtn}
                            />
                            <Button
                                title={t('harvestPlans.confirmComplete', 'Complete')}
                                onPress={submitComplete}
                                style={styles.submitBtn}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    // Header
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

    // Loading
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[3],
    },
    loadingText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },

    // List
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
        flexGrow: 1,
    },

    // Complete modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: theme.spacing[4],
    },
    modalCard: {
        width: '100%',
    },

    // Add-plan form card
    formCard: {
        marginBottom: theme.spacing[6],
    },
    formTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    textArea: {
        minHeight: 72,
        textAlignVertical: 'top',
    },
    formActions: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    cancelBtn: {
        flex: 1,
    },
    submitBtn: {
        flex: 1,
    },

    // Plan card
    planCard: {
        marginBottom: theme.spacing[4],
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[3],
    },
    planDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
    },
    planDate: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.sm,
    },
    statusText: {
        ...theme.typeScale.labelSmall,
    },
    metricsRow: {
        flexDirection: 'row',
        marginBottom: theme.spacing[3],
        gap: theme.spacing[2],
    },
    metric: {
        flex: 1,
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.sm,
        padding: theme.spacing[3],
        alignItems: 'center',
    },
    metricLabel: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
        textAlign: 'center',
    },
    metricValue: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
    },
    actualRow: {
        marginTop: -theme.spacing[1],
    },
    metricLabelActual: {
        ...theme.typeScale.caption,
        color: theme.roles.light.successText,
        marginBottom: theme.spacing[1],
        textAlign: 'center',
    },
    metricValueActual: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.successText,
        fontWeight: '600',
        textAlign: 'center',
    },
    planNotes: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
        fontStyle: 'italic',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    actionBtn: {
        flex: 1,
    },
    deleteBtn: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.dangerBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
