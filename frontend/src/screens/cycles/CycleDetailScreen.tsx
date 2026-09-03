import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { isFeatureEnabled } from '../../config/features';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { theme } from '../../theme';
import { cropsApi, Crop } from '../../api/crops';
import { confirm } from '../../utils/confirm';

export const CycleDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { cycleId } = route.params;
    const [cycle, setCycle] = useState<Crop | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const fetchCycle = useCallback(async () => {
        setError(null);
        try {
            const { data } = await cropsApi.getById(cycleId);
            setCycle(data);
        } catch (err) {
            console.error('Failed to fetch cycle details:', err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [cycleId]);

    useFocusEffect(
        useCallback(() => {
            fetchCycle();
        }, [fetchCycle])
    );

    const onRetry = useCallback(() => {
        setIsLoading(true);
        fetchCycle();
    }, [fetchCycle]);

    const handleCloseCycle = async () => {
        const ok = await confirm({
            title: t('cycles.closeCycleTitle'),
            message: t('cycles.closeCycleMessage'),
            confirmLabel: t('common.confirm'),
            cancelLabel: t('common.cancel'),
            destructive: true,
        });
        if (!ok) return;
        try {
            await cropsApi.close(cycleId);
            navigation.goBack(); // returns to pond dashboard
        } catch (error: any) {
            Alert.alert(t('common.error'), t('cycles.errorCloseCycle'));
        }
    };

    if (isLoading) {
        return <ScreenWrapper><Text>{t('common.loading')}</Text></ScreenWrapper>;
    }
    // A fetch failure must show a retry action, never a permanent "Loading…" — the
    // old guard left the screen stuck on the loading text on any API error.
    if (!cycle) {
        return (
            <ScreenWrapper>
                <ErrorState title={t('cycles.errorLoadTitle', "Couldn't load this cycle")} error={error} onRetry={onRetry} />
            </ScreenWrapper>
        );
    }

    const calculateDOC = (stockingDateStr: string) => {
        // Local-calendar day, 1-based, freezes at harvest — matches the backend
        // computeDoc convention so DOC agrees across every screen.
        const [y, m, d] = stockingDateStr.split('T')[0].split('-').map(Number);
        const start = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
        const endSrc = cycle.actualHarvestDate ? new Date(cycle.actualHarvestDate) : new Date();
        const end = new Date(endSrc.getFullYear(), endSrc.getMonth(), endSrc.getDate()).getTime();
        const diff = Math.round((end - start) / 86_400_000);
        return diff >= 0 ? diff + 1 + (cycle.initialAgeDays ?? 0) : 0;
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('cycles.detailTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.statusRow}>
                    <Text style={styles.label}>{t('common.status')}:</Text>
                    <StatusBadge
                        status={cycle.status === 'active' ? 'active' : 'info'}
                        label={cycle.status}
                    />
                </View>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('cycles.sectionStockingInfo')}</Text>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.infoLabel}>{t('cycles.infoStockingDate')}</Text>
                            <Text style={styles.infoValue}>{cycle.stockingDate ? new Date(cycle.stockingDate).toLocaleDateString() : 'N/A'}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.infoLabel}>{t('cycles.infoDoc')}</Text>
                            <Text style={styles.infoValue}>{cycle.stockingDate ? calculateDOC(cycle.stockingDate) : (cycle.doc ?? 0)} {t('cycles.infoDocUnit')}</Text>
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.infoLabel}>{t('cycles.infoTotalSeed')}</Text>
                            <Text style={styles.infoValue}>{(cycle.stockingCount ?? cycle.totalSeed)?.toLocaleString() ?? 'N/A'}</Text>
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.infoLabel}>{t('cycles.infoSpecies')}</Text>
                            <Text style={styles.infoValue}>{cycle.speciesType ?? 'N/A'}</Text>
                        </View>
                    </View>
                </Card>

                <Text style={styles.sectionHeading}>{t('cycles.sectionTargets')}</Text>
                <View style={styles.metricsGrid}>
                    <MetricCard
                        label={t('cycles.targetSr')}
                        value={`${cycle.targetSrPercent ?? 0}%`}
                    />
                    <MetricCard
                        label={t('cycles.targetDays')}
                        value={`${cycle.targetCultivationDays ?? 120}`}
                    />
                    <MetricCard
                        label={t('cycles.targetSize')}
                        value={`${cycle.targetSize ?? 0} ${t('cycles.targetSizeUnit')}`}
                    />
                </View>

                {cycle.status === 'active' && (
                    <View style={styles.actionContainer}>
                        <Button
                            title={t('cycles.btnRecordHarvest')}
                            onPress={() => navigation.navigate('HarvestLog', { pondId: cycle.pondId, pondName: (cycle as any).pondName, cropId: cycle.id })}
                            style={styles.actionBtn}
                        />
                        <Button
                            title={t('cycles.btnCloseCycle')}
                            onPress={handleCloseCycle}
                            variant="outlined"
                            style={[styles.actionBtn, styles.dangerBtn]}
                            textStyle={{ color: theme.roles.light.dangerText }}
                        />
                    </View>
                )}

                <View style={styles.actionContainer}>
                    <Button
                        title={t('cycles.btnExpenses')}
                        variant="outlined"
                        onPress={() => navigation.navigate('Expenses', { cropId: cycle.id })}
                        style={styles.actionBtn}
                    />
                    <Button
                        title={t('cycles.btnHarvestPlans')}
                        variant="outlined"
                        onPress={() => navigation.navigate('HarvestPlans', { pondId: cycle.pondId, cropId: cycle.id })}
                        style={styles.actionBtn}
                    />
                    {isFeatureEnabled('cycleAnalysisReport') && (
                        <Button
                            title={t('cycles.btnAnalysis', 'Cycle analysis')}
                            variant="outlined"
                            onPress={() => navigation.navigate('CycleAnalysis', { cycleId: cycle.id, cycleName: (cycle as any).name })}
                            style={styles.actionBtn}
                        />
                    )}
                </View>
            </ScrollView>
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
        marginBottom: theme.spacing[4],
    },
    backBtn: {
        padding: theme.spacing[2],
    },
    title: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
    },
    content: {
        paddingBottom: theme.spacing[12],
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[6],
    },
    label: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    sectionCard: {
        marginBottom: theme.spacing[6],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    row: {
        flexDirection: 'row',
        marginBottom: theme.spacing[4],
    },
    col: {
        flex: 1,
    },
    infoLabel: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: 4,
    },
    infoValue: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
    },
    sectionHeading: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
    actionContainer: {
        marginTop: theme.spacing[4],
    },
    actionBtn: {
        marginBottom: theme.spacing[4],
    },
    dangerBtn: {
        borderColor: theme.roles.light.dangerText,
    },
});
