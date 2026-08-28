import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FAB } from '../../../components/ui/FAB';
import { theme } from '../../../theme';
import { logResourcesApi, PlanktonRecord } from '../../../api/logResources';

const MetricPill = ({ label, value }: { label: string; value: number }) => (
    <View style={pillStyles.container}>
        <Text style={pillStyles.label}>{label}</Text>
        <Text style={pillStyles.value}>{value.toLocaleString()}</Text>
    </View>
);

const pillStyles = StyleSheet.create({
    container: { backgroundColor: theme.roles.light.surfaceVariant, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2], marginRight: theme.spacing[2], marginBottom: theme.spacing[2] },
    label: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
    value: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
});

export const PlanktonHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, cropId } = route.params;
    const [records, setRecords] = useState<PlanktonRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchRecords = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setIsLoading(true);
        setError(null);

        try {
            if (cropId) {
                const { data } = await logResourcesApi.getPlanktonByCrop(cropId);
                const sorted = [...data].sort((a, b) => new Date(b.measurementDate).getTime() - new Date(a.measurementDate).getTime());
                setRecords(sorted);
            } else {
                setRecords([]);
            }
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [cropId]);

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

    const handleDelete = useCallback((item: PlanktonRecord) => {
        Alert.alert(
            t('common.delete') + ' ' + t('common.date'),
            t('history.planktonDeleteMsg', { date: new Date(item.measurementDate).toLocaleDateString() }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        setRecords((prev) => prev.filter((r) => r.id !== item.id));
                        try {
                            await logResourcesApi.removePlankton(item.id);
                        } catch {
                            fetchRecords(true);
                        }
                    },
                },
            ],
        );
    }, [fetchRecords]);

    const getTotalCount = (item: PlanktonRecord): number => {
        const fields: (number | undefined)[] = [
            item.greenAlgaeGaCellMl, item.blueGreenAlgaeBgaCellMl, item.dinoflagellataCellMl,
            item.diatomCellMl, item.protozoaCellMl, item.flocCellMl, item.goldenBrownAlgaeCellMl,
            item.euglenophytaCellMl, item.zooCellMl, item.haptoyphytaCellMl,
            item.goldenGreenAlgaeCellMl, item.yellowGreenAlgaeCellMl, item.otherPlanktonCellMl,
        ];
        return fields.reduce<number>((sum, val) => sum + (val || 0), 0);
    };

    const renderItem = ({ item }: { item: PlanktonRecord }) => {
        const total = getTotalCount(item);
        return (
            <Card style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.dateText}>
                        {new Date(item.measurementDate).toLocaleDateString()}
                    </Text>
                    <View style={styles.rowRight}>
                        <Text style={styles.timeText}>{item.measurementTime}</Text>
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('PlanktonLog', { pondId, cropId, editRecord: item })}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel={t('common.edit', 'Edit')}
                            >
                                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.roles.light.textTertiary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                                <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.roles.light.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <Text style={styles.totalText}>{t('history.planktonTotalLabel', { total: total.toLocaleString() })}</Text>
                <View style={styles.grid}>
                    {item.greenAlgaeGaCellMl != null && <MetricPill label={t('history.planktonGreenAlgae')} value={item.greenAlgaeGaCellMl} />}
                    {item.blueGreenAlgaeBgaCellMl != null && <MetricPill label="BGA" value={item.blueGreenAlgaeBgaCellMl} />}
                    {item.diatomCellMl != null && <MetricPill label="Diatom" value={item.diatomCellMl} />}
                    {item.dinoflagellataCellMl != null && <MetricPill label="Dino" value={item.dinoflagellataCellMl} />}
                    {item.protozoaCellMl != null && <MetricPill label={t('history.planktonProtozoa')} value={item.protozoaCellMl} />}
                    {item.zooCellMl != null && <MetricPill label={t('history.planktonZoo')} value={item.zooCellMl} />}
                    {item.euglenophytaCellMl != null && <MetricPill label="Eugleno" value={item.euglenophytaCellMl} />}
                    {item.flocCellMl != null && <MetricPill label="Floc" value={item.flocCellMl} />}
                    {item.goldenBrownAlgaeCellMl != null && <MetricPill label={t('history.planktonGoldBrown')} value={item.goldenBrownAlgaeCellMl} />}
                    {item.goldenGreenAlgaeCellMl != null && <MetricPill label={t('history.planktonGoldGreen')} value={item.goldenGreenAlgaeCellMl} />}
                    {item.yellowGreenAlgaeCellMl != null && <MetricPill label={t('history.planktonYellowGreen')} value={item.yellowGreenAlgaeCellMl} />}
                    {item.haptoyphytaCellMl != null && <MetricPill label="Hapto" value={item.haptoyphytaCellMl} />}
                    {item.otherPlanktonCellMl != null && <MetricPill label={t('history.planktonOther')} value={item.otherPlanktonCellMl} />}
                </View>
            </Card>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history.planktonTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.roles.light.primary} /></View>
            ) : error && records.length === 0 ? (
                <ErrorState title={t('history.couldNotLoad')} error={error} onRetry={handleRetry} />
            ) : (
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
                            <MaterialCommunityIcons name="leaf" size={64} color={theme.roles.light.borderDefault} />
                            <Text style={styles.emptyTitle}>{t('history.planktonEmptyTitle')}</Text>
                            <Text style={styles.emptyText}>{t('history.planktonEmptyText')}</Text>
                        </View>
                    }
                />
            )}

            <FAB icon="plus" onPress={() => navigation.navigate('PlanktonLog', { pondId, cropId })} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing[4], backgroundColor: theme.roles.light.surface, borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: theme.spacing[4], paddingBottom: 100 },
    card: { padding: theme.spacing[4], marginBottom: theme.spacing[3] },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[2] },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    dateText: { ...theme.typeScale.labelLarge, color: theme.roles.light.textSecondary },
    timeText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    deleteBtn: { padding: 2 },
    totalText: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginBottom: theme.spacing[3] },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[2] },
    emptyText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
});
