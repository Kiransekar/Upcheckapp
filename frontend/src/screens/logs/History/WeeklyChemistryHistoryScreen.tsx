/**
 * WeeklyChemistryHistoryScreen — the trend view for the six test-kit
 * parameters, over `GET /water-quality?pondId&chemistryOnly=true`.
 *
 * `chemistryOnly` is what makes this readable: the daily probe rows (pH, DO,
 * temperature) outnumber the weekly tests ten to one, and on the shared water
 * quality chart they flatten the chemistry into a line of gaps. Here every
 * point on every chart is an actual test.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { FAB } from '../../../components/ui/FAB';
import { LineChart } from '../../../components/charts/LineChart';
import { theme } from '../../../theme';
import { waterQualityApi, WaterQualityRecord } from '../../../api/waterQuality';
import {
    evaluateParameter,
    getStatusColor,
    toThresholdSpecies,
    ThresholdSpecies,
    ThresholdParam,
} from '../../../features/waterQualityThresholds';
import { cropsApi } from '../../../api/crops';

/** Enough points to read a trend, few enough that the x labels stay legible. */
const MAX_POINTS = 10;

const PARAMS: {
    key: string;
    labelKey: string;
    unit: string;
    get: (r: WaterQualityRecord) => number | undefined;
    /** Omitted where the shared band table has no zone for the parameter. */
    param?: ThresholdParam;
}[] = [
    { key: 'ammonia', labelKey: 'history.waterQualityMetricAmmonia', unit: 'mg/L', get: (r) => r.ammonia, param: 'ammonia' },
    { key: 'nitrite', labelKey: 'history.waterQualityMetricNitrite', unit: 'mg/L', get: (r) => r.nitrite, param: 'nitrite' },
    { key: 'nitrate', labelKey: 'history.waterQualityMetricNitrate', unit: 'mg/L', get: (r) => r.nitrate, param: 'nitrate' },
    { key: 'alkalinity', labelKey: 'history.waterQualityMetricAlkalinity', unit: 'mg/L', get: (r) => r.alkalinity, param: 'alkalinity' },
    { key: 'hardness', labelKey: 'history.waterQualityMetricHardness', unit: 'mg/L', get: (r) => r.hardness, param: 'hardness' },
    { key: 'transparency', labelKey: 'history.waterQualityMetricTransparency', unit: 'cm', get: (r) => r.transparency, param: 'transparency' },
];

const shortDate = (iso?: string): string => {
    const d = new Date(iso || '');
    return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
};

export const WeeklyChemistryHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName, cropId } = route.params ?? {};

    const [records, setRecords] = useState<WaterQualityRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [species, setSpecies] = useState<ThresholdSpecies>('vannamei');

    const fetchRecords = useCallback(async () => {
        setError(null);
        try {
            const response = await waterQualityApi.getAll(pondId, { take: 100, chemistryOnly: true });
            const result = response.data;
            const rows: WaterQualityRecord[] = Array.isArray(result) ? result : (result as any)?.data || [];
            rows.sort((a, b) => new Date(b.recordedAt || '').getTime() - new Date(a.recordedAt || '').getTime());
            setRecords(rows);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId]);

    // Refetch on focus: logging a test and coming back must show it.
    useFocusEffect(useCallback(() => { fetchRecords(); }, [fetchRecords]));

    useFocusEffect(
        useCallback(() => {
            if (!cropId) return;
            let active = true;
            cropsApi
                .getById(cropId)
                .then(({ data }) => {
                    // toThresholdSpecies answers null for anything it doesn't
                    // recognise; falling back to vannamei is decided here, visibly.
                    if (active) setSpecies(toThresholdSpecies(data?.speciesType) ?? 'vannamei');
                })
                .catch(() => { /* keep the default species */ });
            return () => { active = false; };
        }, [cropId]),
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchRecords();
    }, [fetchRecords]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchRecords();
    }, [fetchRecords]);

    const chronological = [...records].reverse();
    const chartWidth = Dimensions.get('window').width - theme.spacing[4] * 2 - theme.spacing[8];

    const body = () => {
        if (isLoading) return <SkeletonList count={3} style={styles.padded} />;
        if (error && records.length === 0) {
            return <ErrorState title={t('history.couldNotLoad')} error={error} onRetry={handleRetry} />;
        }
        if (records.length === 0) {
            return (
                <EmptyState
                    icon="flask-outline"
                    title={t('history.weeklyChemistryEmptyTitle')}
                    subtitle={t('history.weeklyChemistryEmptyText')}
                    actionLabel={t('history.weeklyChemistryLogAction')}
                    onAction={() => navigation.navigate('WeeklyChemistry', { pondId, pondName })}
                />
            );
        }

        return (
            <>
                {PARAMS.map((p) => {
                    const points = chronological
                        .filter((r) => p.get(r) != null)
                        .slice(-MAX_POINTS);
                    const latest = points[points.length - 1];
                    const latestValue = latest ? (p.get(latest) as number) : null;
                    const status =
                        p.param && latestValue != null
                            ? evaluateParameter(species, p.param, latestValue).status
                            : null;
                    return (
                        <Card key={p.key} style={styles.card}>
                            <View style={styles.cardHead}>
                                <Text style={styles.cardTitle}>{t(p.labelKey)}</Text>
                                {latestValue != null && (
                                    <View style={styles.latest}>
                                        <Text style={styles.latestValue}>{latestValue} {p.unit}</Text>
                                        {status && <View style={[styles.dot, { backgroundColor: getStatusColor(status) }]} />}
                                    </View>
                                )}
                            </View>
                            {points.length >= 2 ? (
                                <LineChart
                                    width={chartWidth}
                                    height={180}
                                    yAxisSuffix=""
                                    data={{
                                        labels: points.map((r) => shortDate(r.recordedAt)),
                                        datasets: [{ data: points.map((r) => p.get(r) as number) }],
                                    }}
                                />
                            ) : (
                                <Text style={styles.notEnough}>{t('history.weeklyChemistryNeedsMore')}</Text>
                            )}
                        </Card>
                    );
                })}

                <Text style={styles.listTitle}>{t('history.weeklyChemistryEntries')}</Text>
                {records.map((r) => {
                    const present = PARAMS.filter((p) => p.get(r) != null);
                    return (
                        <Card key={r.id} style={styles.card}>
                            <Text style={styles.dateText}>
                                {new Date(r.recordedAt || '').toLocaleDateString()}
                            </Text>
                            <View style={styles.metricsGrid}>
                                {present.map((p) => (
                                    <View key={p.key} style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>{t(p.labelKey)}</Text>
                                        <Text style={styles.metricVal}>{p.get(r)} {p.unit}</Text>
                                    </View>
                                ))}
                            </View>
                        </Card>
                    );
                })}
            </>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back', 'Back')}
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('history.weeklyChemistryTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                {body()}
            </ScrollView>

            <FAB icon="plus" onPress={() => navigation.navigate('WeeklyChemistry', { pondId, pondName })} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing[4], backgroundColor: theme.roles.light.surface, borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    content: { padding: theme.spacing[4], paddingBottom: 100, flexGrow: 1 },
    padded: { padding: theme.spacing[4] },
    card: { marginBottom: theme.spacing[3], padding: theme.spacing[4] },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing[2] },
    cardTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, flexShrink: 1 },
    latest: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    latestValue: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    notEnough: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, paddingVertical: theme.spacing[4] },
    listTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[3] },
    dateText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary, marginBottom: theme.spacing[2] },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    metricItem: { width: '48%', marginBottom: theme.spacing[2] },
    metricLabel: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    metricVal: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
});

export default WeeklyChemistryHistoryScreen;
