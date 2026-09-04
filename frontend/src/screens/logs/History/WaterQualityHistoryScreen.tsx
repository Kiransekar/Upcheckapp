import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FAB } from '../../../components/ui/FAB';
import { MultiParameterChart } from '../../../components/charts/MultiParameterChart';
import { theme } from '../../../theme';
import { waterQualityApi, WaterQualityRecord } from '../../../api/waterQuality';
import { cropsApi } from '../../../api/crops';
import { apiErrorMessage } from '../../../api/errors';
import {
    evaluateParameter,
    getStatusColor,
    toThresholdSpecies,
    ThresholdSpecies,
    ThresholdParam,
} from '../../../features/waterQualityThresholds';

const MAX_OVERLAY_POINTS = 14;

/**
 * Every column a water-quality record can carry, in reading order.
 *
 * The card used to render exactly four of them, so a WEEKLY CHEMISTRY entry —
 * which fills ammonia, nitrite, nitrate, alkalinity, hardness, transparency and
 * none of the daily four — displayed as `-- -- -- --`. The farmer's own reading
 * was on screen as four dashes.
 *
 * Only what the record actually holds is rendered, so a daily reading is still
 * four tiles and a chemistry entry is its six.
 */
const METRICS: {
    key: string;
    labelKey: string;
    get: (r: WaterQualityRecord) => number | undefined;
    param?: ThresholdParam;
}[] = [
    { key: 'ph', labelKey: 'history.waterQualityMetricPh', get: (r) => r.ph, param: 'ph' },
    { key: 'do', labelKey: 'history.waterQualityMetricDo', get: (r) => r.dissolvedOxygen, param: 'do' },
    { key: 'temperature', labelKey: 'history.waterQualityMetricTemp', get: (r) => r.temperature, param: 'temperature' },
    { key: 'salinity', labelKey: 'history.waterQualityMetricSalinity', get: (r) => r.salinity, param: 'salinity' },
    { key: 'ammonia', labelKey: 'history.waterQualityMetricAmmonia', get: (r) => r.ammonia, param: 'ammonia' },
    { key: 'nitrite', labelKey: 'history.waterQualityMetricNitrite', get: (r) => r.nitrite, param: 'nitrite' },
    { key: 'nitrate', labelKey: 'history.waterQualityMetricNitrate', get: (r) => r.nitrate, param: 'nitrate' },
    { key: 'alkalinity', labelKey: 'history.waterQualityMetricAlkalinity', get: (r) => r.alkalinity, param: 'alkalinity' },
    { key: 'hardness', labelKey: 'history.waterQualityMetricHardness', get: (r) => r.hardness, param: 'hardness' },
    { key: 'transparency', labelKey: 'history.waterQualityMetricTransparency', get: (r) => r.transparency, param: 'transparency' },
];

/** The four a farmer takes daily; the rest are the weekly chemistry panel. */
const DAILY_KEYS = new Set(['ph', 'do', 'temperature', 'salinity']);

const shortDate = (iso?: string): string => {
    const d = new Date(iso || '');
    return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
};

export const WaterQualityHistoryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName, cropId } = route.params;

    // Parameters available for the multi-parameter overlay, with distinct colors.
    const PARAM_DEFS: {
        key: string;
        label: string;
        color: string;
        get: (r: WaterQualityRecord) => number | undefined;
    }[] = [
        { key: 'ph', label: t('history.waterQualityMetricPh'), color: theme.roles.light.primary, get: (r) => r.ph },
        { key: 'do', label: t('history.waterQualityMetricDo'), color: theme.roles.light.successBorder, get: (r) => r.dissolvedOxygen },
        { key: 'temperature', label: t('history.waterQualityMetricTemp'), color: theme.roles.light.warningBorder, get: (r) => r.temperature },
        { key: 'salinity', label: t('history.waterQualityMetricSalinity'), color: '#9C27B0', get: (r) => r.salinity },
        { key: 'ammonia', label: t('history.waterQualityMetricAmmonia'), color: theme.roles.light.dangerBorder, get: (r) => r.ammonia },
        { key: 'nitrite', label: t('history.waterQualityMetricNitrite'), color: theme.roles.light.borderBrand, get: (r) => r.nitrite },
        { key: 'alkalinity', label: t('history.waterQualityMetricAlkalinity'), color: '#607D8B', get: (r) => r.alkalinity },
    ];
    const [records, setRecords] = useState<WaterQualityRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [selectedParams, setSelectedParams] = useState<string[]>(['ph', 'do']);
    // Active-crop species drives the per-species five-zone thresholds; defaults to
    // vannamei and falls back gracefully if the crop can't be fetched.
    const [species, setSpecies] = useState<ThresholdSpecies>('vannamei');

    const toggleParam = useCallback((key: string) => {
        setSelectedParams((prev) =>
            prev.includes(key)
                ? prev.length > 1
                    ? prev.filter((k) => k !== key)
                    : prev // keep at least one parameter selected
                : [...prev, key],
        );
    }, []);

    const fetchRecords = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) setIsLoading(true);
        setError(null);

        try {
            const response = await waterQualityApi.getAll(pondId, { take: 100 });
            const result = response.data;
            const pondRecords: WaterQualityRecord[] = Array.isArray(result) ? result : (result as any).data || [];
            pondRecords.sort((a, b) => new Date(b.recordedAt || '').getTime() - new Date(a.recordedAt || '').getTime());
            setRecords(pondRecords);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId]);

    // Refetch on focus, not just mount — this screen stays mounted in the
    // stack, so logging a new reading and navigating back never showed it.
    useFocusEffect(useCallback(() => { fetchRecords(); }, [fetchRecords]));

    useEffect(() => {
        if (!cropId) return;
        let active = true;
        cropsApi
            .getById(cropId)
            .then(({ data }) => {
                // Explicit fallback: toThresholdSpecies answers null for a
                // species it does not recognise rather than pretending it is
                // vannamei, so the choice to evaluate against vannamei bands
                // anyway is made here, visibly.
                if (active) setSpecies(toThresholdSpecies(data?.speciesType) ?? 'vannamei');
            })
            .catch(() => {
                /* keep default species on failure */
            });
        return () => {
            active = false;
        };
    }, [cropId]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchRecords(true);
    }, [fetchRecords]);

    const handleDelete = useCallback((id: string) => {
        Alert.alert(
            t('common.delete') + ' ' + t('common.date'),
            t('history.waterQualityDeleteMsg'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await waterQualityApi.remove(id);
                            fetchRecords(true);
                        } catch (err: any) {
                            Alert.alert(t('common.error'), apiErrorMessage(err, t('history.waterQualityDeleteError')));
                        }
                    },
                },
            ],
        );
    }, [fetchRecords]);

    // Build the overlay from records that have every selected parameter present
    // (so all series share the same x positions), oldest→newest, capped for legibility.
    const selectedDefs = PARAM_DEFS.filter((d) => selectedParams.includes(d.key));
    const chronological = [...records].reverse();
    const usableRecords = chronological
        .filter((r) => selectedDefs.every((d) => d.get(r) != null))
        .slice(-MAX_OVERLAY_POINTS);
    const overlaySeries = selectedDefs.map((d) => ({
        key: d.key,
        label: d.label,
        color: d.color,
        points: usableRecords.map((r) => ({
            label: shortDate(r.recordedAt),
            value: d.get(r) as number,
        })),
    }));

    const listHeader =
        records.length > 0 ? (
            <View style={styles.compareSection}>
                <Text style={styles.compareTitle}>{t('history.waterQualityCompareTitle')}</Text>
                <View style={styles.chipRow}>
                    {PARAM_DEFS.map((d) => {
                        const active = selectedParams.includes(d.key);
                        return (
                            <TouchableOpacity
                                key={d.key}
                                onPress={() => toggleParam(d.key)}
                                activeOpacity={0.7}
                                style={[
                                    styles.chip,
                                    active && { backgroundColor: d.color + '22', borderColor: d.color },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.chipDot,
                                        { backgroundColor: active ? d.color : theme.roles.light.borderStrong },
                                    ]}
                                />
                                <Text style={[styles.chipText, active && { color: d.color }]}>
                                    {d.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <MultiParameterChart series={overlaySeries} />
            </View>
        ) : null;

    const renderItem = ({ item }: { item: WaterQualityRecord }) => {
        const present = METRICS.filter((m) => m.get(item) != null);
        const chemistryOnly = present.length > 0 && !present.some((m) => DAILY_KEYS.has(m.key));
        return (
        <Card style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.dateText}>
                    {new Date(item.recordedAt || '').toLocaleDateString()} at {new Date(item.recordedAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={styles.cardActions}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('WaterQualityLog', { pondId, pondName, editRecord: item })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit', 'Edit')}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.roles.light.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.roles.light.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>
            {chemistryOnly && (
                <Text style={styles.chemistryTag}>{t('history.weeklyChemistryTag')}</Text>
            )}
            <View style={styles.metricsGrid}>
                {present.map((m) => {
                    const value = m.get(item) as number;
                    const status = m.param ? evaluateParameter(species, m.param, value).status : null;
                    return (
                        <View key={m.key} style={styles.metricItem}>
                            <Text style={styles.metricLabel}>{t(m.labelKey)}</Text>
                            <View style={styles.valRow}>
                                <Text style={styles.metricVal}>{value}</Text>
                                {status && (
                                    <View style={[styles.dot, { backgroundColor: getStatusColor(status) }]} />
                                )}
                            </View>
                        </View>
                    );
                })}
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
                <Text style={styles.title}>{t('history.waterQualityTitle')}</Text>
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
                    ListHeaderComponent={listHeader}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.roles.light.primary]} tintColor={theme.roles.light.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="water-outline" size={64} color={theme.roles.light.borderDefault} />
                            <Text style={styles.emptyTitle}>{t('history.waterQualityEmptyTitle')}</Text>
                            <Text style={styles.emptyText}>{t('history.waterQualityEmptyText')}</Text>
                        </View>
                    }
                />
            )}

            <FAB icon="plus" onPress={() => navigation.navigate('WaterQualityLog', { pondId, pondName, cropId })} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing[4], backgroundColor: theme.roles.light.surface, borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: theme.spacing[4], paddingBottom: 100 },
    compareSection: { marginBottom: theme.spacing[5] },
    compareTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginBottom: theme.spacing[3] },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[1], borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.roles.light.borderDefault, backgroundColor: theme.roles.light.surface },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
    card: { marginBottom: theme.spacing[3], padding: theme.spacing[4] },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault, paddingBottom: theme.spacing[2] },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
    dateText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary },
    chemistryTag: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[2] },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    metricItem: { width: '48%', marginBottom: theme.spacing[3] },
    metricLabel: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    valRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    metricVal: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...theme.typeScale.h4, color: theme.roles.light.textPrimary, marginTop: theme.spacing[4], marginBottom: theme.spacing[2] },
    emptyText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
});
