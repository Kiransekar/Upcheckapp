import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FAB } from '../../../components/ui/FAB';
import { theme } from '../../../theme';
import { logResourcesApi, MicrobiologyRecord } from '../../../api/logResources';

const MetricPill = ({ label, value }: { label: string; value: string }) => (
    <View style={pillStyles.container}>
        <Text style={pillStyles.label}>{label}</Text>
        <Text style={pillStyles.value}>{value}</Text>
    </View>
);

const pillStyles = StyleSheet.create({
    container: { backgroundColor: theme.roles.light.surfaceVariant, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2], marginRight: theme.spacing[2], marginBottom: theme.spacing[2], minWidth: 100 },
    label: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
    value: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
});

export const MicrobiologyHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, cropId } = route.params;

    const getVibrioLevel = (tvc?: number): { label: string; color: string } => {
        if (!tvc) return { label: t('history.microbiologyLevelNa'), color: theme.roles.light.textSecondary };
        if (tvc > 1000) return { label: t('history.microbiologyLevelCritical'), color: theme.roles.light.dangerText };
        if (tvc > 100) return { label: t('history.microbiologyLevelWarning'), color: theme.roles.light.warningText };
        return { label: t('history.microbiologyLevelSafe'), color: theme.roles.light.successText };
    };
    const [records, setRecords] = useState<MicrobiologyRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchRecords = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setIsLoading(true);
        setError(null);

        try {
            if (cropId) {
                const { data } = await logResourcesApi.getMicrobiologyByCrop(cropId);
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

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const handleDelete = useCallback((item: MicrobiologyRecord) => {
        Alert.alert(
            t('common.delete') + ' ' + t('common.date'),
            t('history.microbiologyDeleteMsg', { date: new Date(item.measurementDate).toLocaleDateString() }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        setRecords((prev) => prev.filter((r) => r.id !== item.id));
                        try {
                            await logResourcesApi.removeMicrobiology(item.id);
                        } catch {
                            fetchRecords(true);
                        }
                    },
                },
            ],
        );
    }, [fetchRecords]);

    const renderItem = ({ item }: { item: MicrobiologyRecord }) => {
        const vibrioLevel = getVibrioLevel(item.totalVibrioCountTvcCfuMl);
        return (
            <Card style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.dateText}>
                        {new Date(item.measurementDate).toLocaleDateString()}
                    </Text>
                    <View style={styles.rowRight}>
                        <View style={[styles.statusChip, { backgroundColor: vibrioLevel.color + '20' }]}>
                            <Text style={[styles.statusText, { color: vibrioLevel.color }]}>{vibrioLevel.label}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('MicrobiologyLog', { pondId, cropId, editRecord: item })}
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
                    {item.totalVibrioCountTvcCfuMl != null && (
                        <MetricPill label={t('history.microTotalVibrio')} value={`${item.totalVibrioCountTvcCfuMl} CFU/mL`} />
                    )}
                    {item.totalBacillusCfuMl != null && (
                        <MetricPill label="Bacillus" value={`${item.totalBacillusCfuMl} CFU/mL`} />
                    )}
                    {item.yellowVibrioCountTvcCfuMl != null && (
                        <MetricPill label={t('history.microYellowVibrio')} value={`${item.yellowVibrioCountTvcCfuMl} CFU/mL`} />
                    )}
                    {item.greenVibrioCountTvcCfuMl != null && (
                        <MetricPill label={t('history.microGreenVibrio')} value={`${item.greenVibrioCountTvcCfuMl} CFU/mL`} />
                    )}
                    {item.luminescentBacteriaLbCfuMl != null && (
                        <MetricPill label={t('history.microLuminescent')} value={`${item.luminescentBacteriaLbCfuMl} CFU/mL`} />
                    )}
                </View>
                {item.note && <Text style={styles.notesText}>{item.note}</Text>}
            </Card>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history.microbiologyTitle')}</Text>
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
                            <MaterialCommunityIcons name="bacteria-outline" size={64} color={theme.roles.light.borderDefault} />
                            <Text style={styles.emptyTitle}>{t('history.microbiologyEmptyTitle')}</Text>
                            <Text style={styles.emptyText}>{t('history.microbiologyEmptyText')}</Text>
                        </View>
                    }
                />
            )}

            <FAB icon="plus" onPress={() => navigation.navigate('MicrobiologyLog', { pondId, cropId })} />
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
    deleteBtn: { padding: 2 },
    statusChip: { paddingHorizontal: theme.spacing[3], paddingVertical: 4, borderRadius: theme.radius.full },
    statusText: { ...theme.typeScale.labelSmall, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    notesText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginTop: theme.spacing[3] },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[2] },
    emptyText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
});
