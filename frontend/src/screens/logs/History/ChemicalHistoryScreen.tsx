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
import { logResourcesApi, ChemicalRecord } from '../../../api/logResources';

const MetricPill = ({ label, value }: { label: string; value: string }) => (
    <View style={pillStyles.container}>
        <Text style={pillStyles.label}>{label}</Text>
        <Text style={pillStyles.value}>{value}</Text>
    </View>
);

const pillStyles = StyleSheet.create({
    container: { backgroundColor: theme.roles.light.surfaceVariant, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2], marginRight: theme.spacing[2], marginBottom: theme.spacing[2] },
    label: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
    value: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
});

export const ChemicalHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, cropId } = route.params;
    const [records, setRecords] = useState<ChemicalRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchRecords = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setIsLoading(true);
        setError(null);

        try {
            if (cropId) {
                const { data } = await logResourcesApi.getChemicalByCrop(cropId);
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

    const handleDelete = useCallback((item: ChemicalRecord) => {
        Alert.alert(
            t('common.delete') + ' ' + t('common.date'),
            t('history.chemicalDeleteMsg', { date: new Date(item.measurementDate).toLocaleDateString() }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        setRecords((prev) => prev.filter((r) => r.id !== item.id));
                        try {
                            await logResourcesApi.removeChemical(item.id);
                        } catch {
                            fetchRecords(true);
                        }
                    },
                },
            ],
        );
    }, [fetchRecords]);

    const renderItem = ({ item }: { item: ChemicalRecord }) => (
        <Card style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.dateText}>
                    {new Date(item.measurementDate).toLocaleDateString()}
                </Text>
                <View style={styles.rowRight}>
                    <Text style={styles.timeText}>{item.measurementTime}</Text>
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('ChemicalLog', { pondId, cropId, editRecord: item })}
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
            <View style={styles.grid}>
                {item.ammoniaNh3Ppm != null && <MetricPill label="NH₃" value={`${item.ammoniaNh3Ppm} ppm`} />}
                {item.nitriteNo2Ppm != null && <MetricPill label="NO₂" value={`${item.nitriteNo2Ppm} ppm`} />}
                {item.nitrateNo3Ppm != null && <MetricPill label="NO₃" value={`${item.nitrateNo3Ppm} ppm`} />}
                {item.alkalinityPpm != null && <MetricPill label={t('history.chemAlkalinity')} value={`${item.alkalinityPpm} ppm`} />}
                {item.hardnessPpm != null && <MetricPill label={t('history.chemHardness')} value={`${item.hardnessPpm} ppm`} />}
                {item.calciumCaPpm != null && <MetricPill label="Ca" value={`${item.calciumCaPpm} ppm`} />}
                {item.magnesiumMgPpm != null && <MetricPill label="Mg" value={`${item.magnesiumMgPpm} ppm`} />}
                {item.phosphatePo4Ppm != null && <MetricPill label="PO₄" value={`${item.phosphatePo4Ppm} ppm`} />}
            </View>
        </Card>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history.chemicalTitle')}</Text>
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
                            <MaterialCommunityIcons name="flask-empty-outline" size={64} color={theme.roles.light.borderDefault} />
                            <Text style={styles.emptyTitle}>{t('history.chemicalEmptyTitle')}</Text>
                            <Text style={styles.emptyText}>{t('history.chemicalEmptyText')}</Text>
                        </View>
                    }
                />
            )}

            <FAB icon="plus" onPress={() => navigation.navigate('ChemicalLog', { pondId, cropId })} />
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
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[3] },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    dateText: { ...theme.typeScale.labelLarge, color: theme.roles.light.textSecondary },
    timeText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    deleteBtn: { padding: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[2] },
    emptyText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
});
