import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FAB } from '../../../components/ui/FAB';
import { theme } from '../../../theme';
import { harvestsApi, HarvestRecord } from '../../../api/harvests';

export const HarvestHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, cycleId, cropId } = route.params;
    const [records, setRecords] = useState<HarvestRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchRecords = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setIsLoading(true);
        setError(null);

        try {
            /*
             * A pond, when we have one, beats a single crop: harvests run
             * across successive cycles on the same pond and the farmer is
             * asking for THAT pond's run, not one cycle of it.
             *
             * There is deliberately no `getAll()` fallback any more. With
             * neither id it returned every harvest on every farm the user can
             * reach and drew them under this pond's title — other ponds'
             * tonnage, summed into "total harvested", on a screen a farmer
             * reads as one pond's record. No scope, no list.
             */
            if (!pondId && !cropId) {
                setRecords([]);
                return;
            }
            const { data } = pondId
                ? await harvestsApi.getByPond(pondId)
                : await harvestsApi.getByCrop(cropId);
            const result: HarvestRecord[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
            result.sort((a, b) => new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime());
            setRecords(result);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId, cropId]);

    // Refetch on focus, not just mount — this screen stays mounted in the
    // stack, so logging a new reading and navigating back never showed it.
    useFocusEffect(useCallback(() => { fetchRecords(); }, [fetchRecords]));

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const totalBiomass = records.reduce((sum, r) => sum + (r.weightKg || 0), 0);

    const renderItem = ({ item }: { item: HarvestRecord }) => (
        <Card style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.dateText}>
                    {new Date(item.harvestDate).toLocaleDateString()}
                </Text>
                <View style={styles.cardActions}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.harvestType.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('HarvestLog', { pondId, pondName: '', cropId, editRecord: item })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit', 'Edit')}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.roles.light.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.metricsRow}>
                <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>{t('history.harvestMetricBiomass')}</Text>
                    <Text style={styles.metricValue}>{item.weightKg.toLocaleString()} <Text style={styles.metricUnit}>kg</Text></Text>
                </View>
                {item.averageSize != null && (
                    <View style={styles.metricBlock}>
                        <Text style={styles.metricLabel}>{t('history.harvestMetricAvgSize')}</Text>
                        <Text style={styles.metricValue}>{item.averageSize} <Text style={styles.metricUnit}>g</Text></Text>
                    </View>
                )}
            </View>

            {item.buyerName && (
                <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="account-outline" size={16} color={theme.roles.light.textSecondary} />
                    <Text style={styles.detailText}>{t('history.harvestBuyerLabel', { name: item.buyerName })}</Text>
                </View>
            )}
            {item.salePriceTotal != null && (
                <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="cash-multiple" size={16} color={theme.roles.light.textSecondary} />
                    <Text style={styles.detailText}>{t('history.harvestSaleLabel', { amount: item.salePriceTotal })}</Text>
                </View>
            )}
            {item.notes && <Text style={styles.notesText}>{item.notes}</Text>}
        </Card>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history.harvestTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.roles.light.primary} /></View>
            ) : error && records.length === 0 ? (
                <ErrorState title={t('history.couldNotLoad')} error={error} onRetry={handleRetry} />
            ) : (
                <>
                    {records.length > 0 && (
                        <View style={styles.summaryBar}>
                            <Text style={styles.summaryText}>
                                {t('history.harvestTotalLabel')}<Text style={styles.summaryValue}>{t('history.harvestTotalValue', { amount: totalBiomass.toLocaleString() })}</Text>
                            </Text>
                        </View>
                    )}
                    <FlatList
                        data={records}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.roles.light.primary]} tintColor={theme.roles.light.primary} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="basket-outline" size={64} color={theme.roles.light.borderDefault} />
                                <Text style={styles.emptyTitle}>{t('history.harvestEmptyTitle')}</Text>
                                <Text style={styles.emptyText}>{t('history.harvestEmptyText')}</Text>
                            </View>
                        }
                    />
                </>
            )}

            <FAB icon="plus" onPress={() => navigation.navigate('HarvestLog', { pondId, pondName: '', cropId })} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing[4], backgroundColor: theme.roles.light.surface, borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    summaryBar: { backgroundColor: theme.roles.light.successBg, paddingVertical: theme.spacing[3], paddingHorizontal: theme.spacing[4] },
    summaryText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary },
    summaryValue: { fontWeight: '700', color: theme.roles.light.successText },
    listContent: { padding: theme.spacing[4], paddingBottom: 100 },
    card: { padding: theme.spacing[4], marginBottom: theme.spacing[4] },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] },
    dateText: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    badge: { backgroundColor: theme.roles.light.successText + '15', paddingHorizontal: theme.spacing[3], paddingVertical: 4, borderRadius: theme.radius.full },
    badgeText: { color: theme.roles.light.successText, ...theme.typeScale.labelSmall, fontWeight: '700' },
    metricsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: theme.spacing[8], marginBottom: theme.spacing[4] },
    metricBlock: {},
    metricLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, marginBottom: 4 },
    metricValue: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    metricUnit: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textSecondary },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginTop: theme.spacing[2] },
    detailText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    notesText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginTop: theme.spacing[2] },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[2] },
    emptyText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
});
