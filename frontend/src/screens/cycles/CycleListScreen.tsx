import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { cropsApi, Crop } from '../../api/crops';
import { harvestsApi, Harvest } from '../../api/harvests';
import { pondsApi, Pond } from '../../api/ponds';
import { pondLabel } from '../../utils/pondHealth';
import { usePermissions } from '../../hooks/usePermissions';
import { summariseCycles, CycleRow } from './cycleHistory';

const list = <T,>(data: any): T[] => (Array.isArray(data) ? data : (data?.data ?? []));

const BADGE: Record<string, 'active' | 'completed' | 'idle'> = {
    active: 'active',
    completed: 'completed',
    cancelled: 'idle',
};

export const CycleListScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName, farmId, farmName } = route.params ?? {};
    const { canViewFinancials } = usePermissions(farmId);

    const [rows, setRows] = useState<CycleRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchRows = useCallback(async () => {
        setError(null);
        try {
            if (pondId) {
                const [cropsRes, harvestsRes] = await Promise.all([
                    cropsApi.getAll(pondId),
                    harvestsApi.getByPond(pondId).catch(() => ({ data: [] as Harvest[] })),
                ]);
                setRows(summariseCycles(
                    list<Crop>(cropsRes.data).map((crop) => ({ crop })),
                    list<Harvest>(harvestsRes.data),
                ));
                return;
            }
            if (!farmId) {
                setRows([]);
                return;
            }
            // Farm scope fans out over the farm's ponds: `GET /crops` is
            // pond-scoped, there is no farm-wide crop list. Ponds are capped at
            // 100 by the same read FarmDetail uses, so this stays bounded.
            const pondsRes = await pondsApi.getAll(farmId, { take: 100 });
            const ponds = list<Pond>(pondsRes.data);
            const per = await Promise.all(ponds.map(async (p) => {
                const [c, h] = await Promise.all([
                    cropsApi.getAll(p.id).catch(() => ({ data: [] as Crop[] })),
                    harvestsApi.getByPond(p.id).catch(() => ({ data: [] as Harvest[] })),
                ]);
                return {
                    entries: list<Crop>(c.data).map((crop) => ({ crop, pondName: pondLabel(p) })),
                    harvests: list<Harvest>(h.data),
                };
            }));
            setRows(summariseCycles(
                per.flatMap((x) => x.entries),
                per.flatMap((x) => x.harvests),
            ));
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId, farmId]);

    useFocusEffect(useCallback(() => { fetchRows(); }, [fetchRows]));

    const onRefresh = useCallback(() => { setIsRefreshing(true); fetchRows(); }, [fetchRows]);
    const onRetry = useCallback(() => { setIsLoading(true); fetchRows(); }, [fetchRows]);

    const renderItem = ({ item }: { item: CycleRow }) => {
        const { crop } = item;
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CycleDetail', { cycleId: crop.id })}
                accessibilityRole="button"
                accessibilityLabel={crop.name}
            >
                <Card style={styles.card}>
                    <View style={styles.cardTop}>
                        <View style={styles.cardTitleCol}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{crop.name}</Text>
                            {!!item.pondName && (
                                <Text style={styles.cardSub} numberOfLines={1}>{item.pondName}</Text>
                            )}
                        </View>
                        <StatusBadge
                            status={BADGE[crop.status] ?? 'info'}
                            label={t(`cycles.status_${crop.status}`, crop.status)}
                        />
                    </View>

                    <View style={styles.stats}>
                        <Stat label={t('cycles.infoDoc')} value={`${item.doc} ${t('cycles.infoDocUnit')}`} />
                        <Stat
                            label={t('cycles.listStocked')}
                            value={crop.stockingDate ? new Date(crop.stockingDate).toLocaleDateString() : '—'}
                            caption={(crop.stockingCount ?? crop.totalSeed)?.toLocaleString()}
                        />
                        <Stat
                            label={t('cycles.listHarvested')}
                            value={item.harvestKg != null ? t('cycles.listKg', { amount: item.harvestKg.toLocaleString() }) : '—'}
                        />
                        {canViewFinancials && (
                            <Stat
                                label={t('cycles.listRevenue')}
                                value={item.revenue != null ? t('cycles.currency', { amount: item.revenue.toLocaleString() }) : '—'}
                            />
                        )}
                    </View>

                    <View style={styles.chevronRow}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.headerWrap}>
                <ScreenHeader
                    eyebrow={pondName ?? farmName ?? null}
                    title={t('cycles.listTitle')}
                    onBack={() => navigation.goBack()}
                    trailing={rows.length ? String(rows.length) : undefined}
                />
            </View>

            {isLoading ? (
                <View style={styles.listContent}><SkeletonList count={4} /></View>
            ) : error && rows.length === 0 ? (
                <ErrorState title={t('cycles.listErrorTitle')} error={error} onRetry={onRetry} />
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.crop.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={[theme.roles.light.primary]}
                            tintColor={theme.roles.light.primary}
                        />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="history"
                            title={t('cycles.listEmptyTitle')}
                            subtitle={t('cycles.listEmptyText')}
                        />
                    }
                />
            )}
        </ScreenWrapper>
    );
};

const Stat = ({ label, value, caption }: { label: string; value: string; caption?: string }) => (
    <View style={styles.stat}>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        {!!caption && <Text style={styles.statCaption} numberOfLines={1}>{caption}</Text>}
    </View>
);

const styles = StyleSheet.create({
    headerWrap: {
        paddingHorizontal: theme.spacing[4],
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
        flexGrow: 1,
    },
    card: {
        marginBottom: theme.spacing[3],
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
    },
    cardTitleCol: {
        flex: 1,
    },
    cardTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
    },
    cardSub: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: theme.spacing[3],
        marginTop: theme.spacing[3],
    },
    // Two per row at 360dp; a third and fourth wrap instead of squeezing.
    stat: {
        minWidth: '50%',
        flexGrow: 1,
        flexShrink: 1,
        paddingRight: theme.spacing[2],
    },
    statLabel: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
    },
    statValue: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    statCaption: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
    },
    chevronRow: {
        alignItems: 'flex-end',
    },
});
