/**
 * Farms — artboard 4a.
 *
 * The old screen was a list of names: farm, address, pond count. That answers
 * "which farms do I have", which a farmer already knows. The redesign answers
 * "which farm needs me" — every card opens on stocked / biomass / act-now and a
 * strip of one bar per pond, so the worst farm is visible before any tap.
 *
 * Cost of that: three list-wide calls plus one batched pond-context call per
 * farm, instead of the twenty-odd per-pond calls the same data used to imply.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { StatRow } from '../../components/ui/StatRow';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { farmsApi, type Farm } from '../../api/farms';
import { pondsApi, type Pond } from '../../api/ponds';
import { alertCenterApi, type BriefingItem } from '../../api/alertCenter';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { useMembershipStore } from '../../store/membershipStore';
import {
    buildPondRows,
    rollUpFarm,
    HEALTH_COLOR,
    type FarmRollup,
    type PondHealth,
} from '../../utils/pondHealth';
import type { FarmRole } from '../../api/farmMembers';

interface FarmCardData {
    farm: Farm;
    role: FarmRole | null;
    roll: FarmRollup;
}

/** 1,234 — thousands separators, because biomass is read at a glance. */
const kg = (n: number) => n.toLocaleString('en-IN');

export const FarmsListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const roleForFarm = useMembershipStore((s) => s.roleForFarm);
    const loadMemberships = useMembershipStore((s) => s.load);

    const [farms, setFarms] = useState<Farm[]>([]);
    const [ponds, setPonds] = useState<Pond[]>([]);
    const [briefing, setBriefing] = useState<BriefingItem[]>([]);
    const [contexts, setContexts] = useState<PondContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [offline, setOffline] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        setOffline(false);
        try {
            // The farm list is the only fatal call. Everything after it is
            // enrichment — a farmer on a flaky connection should still see their
            // farms, with the numbers missing, rather than an error page.
            const farmsRes = await farmsApi.getAll();
            setFarms(farmsRes.data);
            // Paint the farms now. The figures arrive a moment later and fill
            // in — waiting for all of them before showing anything is what made
            // this screen feel slow.
            setLoading(false);

            const [pondsRes, briefingRes, ctxs] = await Promise.all([
                pondsApi.getMine().catch(() => ({ data: [] as Pond[] })),
                alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
                // One batched call per farm for the standing biomass. Each is a
                // whole farm's ponds server-side, so this is farms-many
                // requests, not ponds-many.
                Promise.all(
                    farmsRes.data.map((f) =>
                        pondContextApi
                            .forFarm(f.id)
                            .then((r) => r.data)
                            .catch(() => [] as PondContext[]),
                    ),
                ),
            ]);
            setPonds(pondsRes.data);
            setBriefing(briefingRes.data);
            setContexts(ctxs.flat());
        } catch (err: any) {
            if (!err?.response) setOffline(true);
            setError(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadMemberships();
            load();
        }, [load, loadMemberships]),
    );

    const cards: FarmCardData[] = useMemo(() => {
        const rows = buildPondRows(ponds, contexts, briefing);
        return farms.map((farm) => ({
            farm,
            role: roleForFarm(farm.id),
            roll: rollUpFarm(rows.filter((r) => r.pond.farmId === farm.id)),
        }));
    }, [farms, ponds, contexts, briefing, roleForFarm]);

    /** "3 farms · 24 ponds · 31.6 ha" — the eyebrow above the title. */
    const eyebrow = useMemo(() => {
        if (!farms.length) return null;
        const area = farms.reduce((a, f) => a + (Number(f.areaHectares) || 0), 0);
        const parts = [
            t('farms.countFarms', { count: farms.length }),
            t('farms.countPonds', { count: ponds.length }),
        ];
        if (area > 0) parts.push(t('farms.countHectares', { area: area.toFixed(1) }));
        return parts.join(' · ');
    }, [farms, ponds.length, t]);

    const totals = useMemo(() => {
        const actNow = cards.reduce((a, c) => a + c.roll.actNow, 0);
        const farmsAffected = cards.filter((c) => c.roll.actNow > 0).length;
        const biomassCards = cards.filter((c) => c.roll.biomassKg != null);
        const biomass = biomassCards.reduce((a, c) => a + (c.roll.biomassKg ?? 0), 0);
        return {
            actNow,
            farmsAffected,
            biomassKg: biomassCards.length ? biomass : null,
        };
    }, [cards]);

    const openFarm = (farm: Farm) =>
        navigation.navigate('FarmDetail', { farmId: farm.id, farmName: farm.name });

    const header = (
        <ScreenHeader
            eyebrow={eyebrow}
            title={t('farms.yourFarms')}
            actionLabel={t('farms.addFarm')}
            onAction={() => navigation.navigate('CreateFarm')}
        />
    );

    if (loading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.skeleton}>
                    <SkeletonList count={3} />
                </View>
            </ScreenWrapper>
        );
    }

    if (offline) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <NetworkError
                    onRetry={() => {
                        setLoading(true);
                        load();
                    }}
                />
            </ScreenWrapper>
        );
    }

    if (error && !farms.length) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <ErrorState
                    title={t('farms.errorTitle')}
                    error={error}
                    onRetry={() => {
                        setLoading(true);
                        load();
                    }}
                />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            load();
                        }}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                {!farms.length ? (
                    <EmptyState
                        icon="barn"
                        title={t('farms.emptyTitle')}
                        subtitle={t('farms.emptySubtitleEither')}
                        actionLabel={t('farms.addFarm')}
                        onAction={() => navigation.navigate('CreateFarm')}
                    />
                ) : (
                    <>
                        {/*
                          * The two facts worth putting above every farm card.
                          * The design has a third — daily log completion — which
                          * no endpoint reports yet; a plausible-looking number
                          * there would be worse than its absence.
                          */}
                        {totals.actNow > 0 && (
                            <SummaryRow
                                icon="warning"
                                title={t('farms.pondsNeedYou', { count: totals.actNow })}
                                subtitle={t('farms.acrossFarms', {
                                    count: totals.farmsAffected,
                                    total: farms.length,
                                })}
                                value={String(totals.actNow)}
                                tone="danger"
                            />
                        )}
                        {totals.biomassKg != null && (
                            <SummaryRow
                                icon="scale"
                                title={t('farms.standingBiomass', { kg: kg(totals.biomassKg) })}
                                subtitle={t('farms.standingBiomassSub')}
                                divider="strong"
                            />
                        )}

                        {cards.map((card) => (
                            <FarmCard key={card.farm.id} data={card} onPress={() => openFarm(card.farm)} />
                        ))}

                        <Legend />

                        <TouchableOpacity
                            style={styles.joinBtn}
                            onPress={() => navigation.navigate('JoinFarm')}
                            accessibilityRole="button"
                        >
                            <Text style={styles.joinLabel}>{t('farms.joinWithCode')}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

/**
 * One farm. The left border is the farm's worst pond — a red edge down the side
 * of the card is readable from further away than any number on it.
 */
const FarmCard: React.FC<{ data: FarmCardData; onPress: () => void }> = ({ data, onPress }) => {
    const { t } = useTranslation();
    const { farm, role, roll } = data;
    const worst: PondHealth = roll.actNow > 0 ? 'critical' : roll.watch > 0 ? 'watch' : 'fine';

    const subtitle = [farm.address, role ? t(`members.role_${role}`) : null]
        .filter(Boolean)
        .join(' · ');

    // Third column: the problem if there is one, otherwise the all-clear. The
    // design swaps the figure for words here precisely because "0 act now" is a
    // worse way to say "all fine".
    const third =
        roll.actNow > 0
            ? { value: String(roll.actNow), label: t('farms.actNow'), tone: 'danger' as const }
            : roll.watch > 0
              ? { value: String(roll.watch), label: t('farms.watch'), tone: 'warning' as const }
              : {
                    value: t('farms.allFine'),
                    label: t('farms.status'),
                    tone: 'success' as const,
                    text: true,
                };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            accessibilityRole="button"
            style={[styles.card, { borderLeftColor: HEALTH_COLOR[worst] }]}
        >
            <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.farmName} numberOfLines={1}>
                        {farm.name}
                    </Text>
                    {!!subtitle && (
                        <Text style={styles.farmMeta} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                <Icon name="chevron_right" size={22} color={theme.roles.light.textDisabled} />
            </View>

            <StatRow
                stats={[
                    {
                        value: String(roll.stocked),
                        unit: `/${roll.total}`,
                        label: t('farms.stocked'),
                    },
                    {
                        value: roll.biomassKg != null ? kg(roll.biomassKg) : '—',
                        label: t('farms.biomassKg'),
                    },
                    third,
                ]}
            />

            <PondStrip strip={roll.strip} />
        </TouchableOpacity>
    );
};

/** One bar per pond, worst first. A farm's shape in a single glance. */
const PondStrip: React.FC<{ strip: PondHealth[] }> = ({ strip }) => {
    if (!strip.length) return null;
    return (
        <View style={styles.strip}>
            {strip.map((health, i) => (
                <View
                    key={i}
                    style={[styles.stripBar, { backgroundColor: HEALTH_COLOR[health] }]}
                />
            ))}
        </View>
    );
};

const Legend: React.FC = () => {
    const { t } = useTranslation();
    const entries: [PondHealth, string][] = [
        ['critical', t('farms.actNow')],
        ['watch', t('farms.watch')],
        ['fine', t('farms.fine')],
        ['fallow', t('farms.fallow')],
    ];
    return (
        <View style={styles.legend}>
            {entries.map(([health, label]) => (
                <View key={health} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: HEALTH_COLOR[health] }]} />
                    <Text style={styles.legendLabel}>{label}</Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[24], backgroundColor: theme.roles.light.surface },
    skeleton: { padding: theme.spacing[4] },
    card: {
        borderLeftWidth: 3,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
        paddingTop: theme.spacing[3],
        paddingBottom: 14,
    },
    cardHead: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2.5],
        paddingHorizontal: theme.spacing[5],
        paddingLeft: 17,
    },
    farmName: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    farmMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    strip: {
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: theme.spacing[5],
        paddingLeft: 17,
        marginTop: theme.spacing[1],
    },
    stripBar: { flex: 1, height: 7 },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        paddingBottom: theme.spacing[1.5],
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1.5] },
    legendSwatch: { width: 9, height: 9 },
    legendLabel: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: theme.roles.light.textTertiary,
        marginRight: theme.spacing[1.5],
    },
    joinBtn: {
        marginHorizontal: theme.spacing[5],
        marginTop: theme.spacing[1.5],
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderStrong,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[3],
        alignItems: 'center',
        minHeight: 44,
        justifyContent: 'center',
    },
    joinLabel: {
        ...theme.typeScale.labelLarge,
        fontSize: 15,
        color: theme.roles.light.textPrimary,
    },
});

export default FarmsListScreen;
