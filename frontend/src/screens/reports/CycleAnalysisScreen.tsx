import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { LineChart } from '../../components/charts/LineChart';
import { EmptyState } from '../../components/ui/EmptyState';
import { theme } from '../../theme';
import { reportsApi, type CycleAnalysis } from '../../api/reports';

const c = theme.roles.light;

export const CycleAnalysisScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { cycleId, cycleName } = route.params ?? {};
    const [data, setData] = useState<CycleAnalysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        reportsApi
            .getCycleAnalysis(cycleId)
            .then(({ data }) => setData(data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [cycleId]);

    const metrics = data
        ? [
              { label: t('reports.fcr', 'FCR'), value: data.fcr ? data.fcr.toFixed(2) : '—' },
              { label: t('reports.survival', 'Survival %'), value: data.survivalRate ? `${Number(data.survivalRate).toFixed(0)}%` : '—' },
              { label: t('reports.totalFeed', 'Feed (kg)'), value: Number(data.totalFeedKg || 0).toFixed(0) },
              { label: t('reports.totalHarvest', 'Harvest (kg)'), value: Number(data.totalHarvestKg || 0).toFixed(0) },
          ]
        : [];

    const growth = data?.growthChart ?? [];

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={c.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>
                    {cycleName ? t('reports.cycleAnalysisFor', { name: cycleName, defaultValue: `Analysis · ${cycleName}` }) : t('reports.cycleAnalysis', 'Cycle analysis')}
                </Text>
                {/* The report a farmer is looking at is the one they want to
                    send, so the export starts pre-filled with this cycle. */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('Export', { dataset: 'cycle', cropId: cycleId })}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('export.title')}
                >
                    <MaterialCommunityIcons name="share-variant" size={22} color={c.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
            ) : !data ? (
                <EmptyState icon="chart-line" title={t('reports.noAnalysisTitle', 'No analysis yet')} subtitle={t('reports.noAnalysisSub', 'Record sampling and harvest data to see cycle metrics.')} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.grid}>
                        {metrics.map((m) => (
                            <Card key={m.label} style={styles.metricCard}>
                                <Text style={styles.metricValue}>{m.value}</Text>
                                <Text style={styles.metricLabel}>{m.label}</Text>
                            </Card>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>{t('reports.growthCurve', 'Growth curve (avg body weight)')}</Text>
                    {growth.length >= 2 ? (
                        <Card style={styles.chartCard}>
                            <LineChart
                                data={{
                                    labels: growth.map((g) => g.date.slice(5)), // MM-DD
                                    datasets: [{ data: growth.map((g) => g.mbw) }],
                                }}
                            />
                        </Card>
                    ) : (
                        <Card style={styles.chartCard}>
                            <Text style={styles.hint}>{t('reports.growthNeedsData', 'Two or more samplings are needed to chart growth.')}</Text>
                        </Card>
                    )}
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: theme.spacing[4], borderBottomWidth: 1, borderBottomColor: c.borderDefault, backgroundColor: c.surface,
    },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: c.textPrimary, flex: 1, textAlign: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: theme.spacing[4], paddingBottom: theme.spacing[12] },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[4], marginBottom: theme.spacing[6] },
    metricCard: { width: '47%', padding: theme.spacing[4], alignItems: 'center' },
    metricValue: { ...theme.typeScale.numericMedium, color: c.textPrimary },
    metricLabel: { ...theme.typeScale.labelSmall, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
    sectionTitle: { ...theme.typeScale.h4, color: c.textPrimary, marginBottom: theme.spacing[3] },
    chartCard: { padding: theme.spacing[3] },
    hint: { ...theme.typeScale.bodyMedium, color: c.textSecondary, textAlign: 'center', padding: theme.spacing[4] },
});

export default CycleAnalysisScreen;
