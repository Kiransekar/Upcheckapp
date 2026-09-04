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
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { cropsApi, Crop, computeDoc } from '../../api/crops';
import { pnlApi, CropPnl } from '../../api/pnl';
import { confirm } from '../../utils/confirm';
import { usePermissions } from '../../hooks/usePermissions';
import { EditCycleForm } from './EditCycleForm';

export const CycleDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { cycleId } = route.params;
    const [cycle, setCycle] = useState<Crop | null>(null);
    const [pnl, setPnl] = useState<CropPnl | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    // The crop carries its own farmId, so the gate follows the cycle rather
    // than whichever farm happens to be active in the picker.
    const { canRecordHarvest, canManageOperations, canViewFinancials } = usePermissions(cycle?.farmId);

    const fetchCycle = useCallback(async () => {
        setError(null);
        try {
            const { data } = await cropsApi.getById(cycleId);
            setCycle(data);
            // P&L is a separate, gated read — a 403 for a member without
            // VIEW_FINANCIALS must not blank the whole screen.
            pnlApi.cropPnl(cycleId).then(({ data: p }) => setPnl(p)).catch(() => setPnl(null));
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
        return <ScreenWrapper><SkeletonList count={4} /></ScreenWrapper>;
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

    if (isEditing) {
        // scroll={false}: EditCycleForm brings its own ScrollView, and nesting
        // two makes the inner one unscrollable on Android.
        return (
            <ScreenWrapper scroll={false}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('cycles.editTitle')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <EditCycleForm
                    cycle={cycle}
                    onCancel={() => setIsEditing(false)}
                    onSaved={() => { setIsEditing(false); onRetry(); }}
                />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('cycles.detailTitle')}</Text>
                {canManageOperations ? (
                    <TouchableOpacity
                        onPress={() => setIsEditing(true)}
                        style={styles.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={22} color={theme.roles.light.textPrimary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
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
                            <Text style={styles.infoValue}>{cycle.stockingDate ? computeDoc(cycle) : (cycle.computedDOC ?? cycle.doc ?? 0)} {t('cycles.infoDocUnit')}</Text>
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

                {/* P&L is the farm's economics — hidden, not merely disabled,
                    for a member without VIEW_FINANCIALS. `pnl` stays null when
                    that read 403s, so this block never renders half-blank. */}
                {canViewFinancials && pnl && (
                    <Card style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{t('cycles.sectionPnl')}</Text>
                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.infoLabel}>{t('cycles.pnlRevenue')}</Text>
                                <Text style={styles.infoValue}>{t('cycles.currency', { amount: pnl.revenue.toLocaleString() })}</Text>
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.infoLabel}>{t('cycles.pnlCost')}</Text>
                                <Text style={styles.infoValue}>{t('cycles.currency', { amount: pnl.totalCost.toLocaleString() })}</Text>
                            </View>
                        </View>
                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.infoLabel}>{t('cycles.pnlProfit')}</Text>
                                <Text style={[styles.infoValue, { color: pnl.profit < 0 ? theme.roles.light.dangerText : theme.roles.light.successText }]}>
                                    {t('cycles.currency', { amount: pnl.profit.toLocaleString() })}
                                </Text>
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.infoLabel}>{t('cycles.pnlBiomass')}</Text>
                                <Text style={styles.infoValue}>{t('cycles.listKg', { amount: pnl.harvestBiomassKg.toLocaleString() })}</Text>
                            </View>
                        </View>
                        {!pnl.harvestComplete && <Text style={styles.infoLabel}>{t('cycles.pnlProvisional')}</Text>}
                    </Card>
                )}

                {/* A harvest books revenue and closes the cycle: RECORD_HARVEST,
                    which is what the API enforces. This used to be ungated, so a
                    viewer tapped through to a 403 after the fact. */}
                {cycle.status === 'active' && canRecordHarvest && (
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
                    {canViewFinancials && (
                        <Button
                            title={t('cycles.btnExpenses')}
                            variant="outlined"
                            onPress={() => navigation.navigate('Expenses', { cropId: cycle.id })}
                            style={styles.actionBtn}
                        />
                    )}
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
