/**
 * Ponds — artboard 4b. One farm, worst pond first.
 *
 * The old screen listed ponds alphabetically as cards showing geometry type and
 * area — facts that never change and never need acting on. The redesign is a
 * table sorted by how much trouble each pond is in, with the three numbers a
 * farmer actually checks (day, DO, biomass) in fixed columns so they can be
 * compared down the page.
 *
 * The four actions that used to be unlabelled icons crammed into the header are
 * now labelled tiles. They were the most-missed controls on this screen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { StatRow } from '../../components/ui/StatRow';
import { Icon, type IconName } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { SessionHint } from '../../components/ui/SessionHint';
import { theme } from '../../theme';
import { pondsApi, type Pond } from '../../api/ponds';
import { farmsApi, type Farm } from '../../api/farms';
import { alertCenterApi, type BriefingItem } from '../../api/alertCenter';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { useMembershipStore } from '../../store/membershipStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';
import {
    buildPondRows,
    mergeBriefings,
    rollUpFarm,
    sortByHealth,
    pondLabel,
    HEALTH_COLOR,
    HEALTH_TEXT,
    type PondWithHealth,
} from '../../utils/pondHealth';

/** How many ponds show before "Show N more" — a farm's trouble is at the top. */
const VISIBLE_PONDS = 5;

const kg = (n: number) => n.toLocaleString('en-IN');

const timeAgo = (iso?: string | null): string | null => {
    if (!iso) return null;
    const ms = Date.now() - Date.parse(iso);
    if (Number.isNaN(ms) || ms < 0) return null;
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
};

export const FarmDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params;
    const loadMemberships = useMembershipStore((s) => s.load);
    const roleForFarm = useMembershipStore((s) => s.roleForFarm);
    const setSelectedFarm = useActiveFarmStore((s) => s.setSelectedFarm);
    const perms = usePermissions(farmId);

    const [expanded, setExpanded] = useState(false);

    // #37: Home's summary reads the active farm, so opening a specific farm has
    // to sync it — otherwise a multi-farm owner returns to Home still seeing the
    // other farm's counts and reads them as this farm's zeroes.
    useFocusEffect(
        useCallback(() => {
            if (farmId) setSelectedFarm({ id: farmId, name: farmName ?? '' });
        }, [farmId, farmName, setSelectedFarm]),
    );

    /** One cached, disk-persisted read for the farm and every pond on it. */
    const query = useAppQuery({
        queryKey: qk.farm(farmId),
        queryFn: async () => {
            const [pondsRes, ctxRes, briefingRes, farmRes] = await Promise.all([
                pondsApi.getAll(farmId, { take: 100 }),
                // One request for every pond's snapshot — see pondContextApi.forFarm.
                pondContextApi.forFarm(farmId).catch(() => ({ data: [] as PondContext[] })),
                // LIVE, merged with the persisted stream — not persisted alone.
                // The live briefing is recomputed from each pond's latest
                // reading, so it is the only one that describes the pond NOW;
                // the persisted stream is notification history and can be
                // empty for a pond that is currently in a watch band. Reading
                // only the second is why this screen said "2/2 good" while
                // Today showed one of the two ponds amber.
                Promise.all([
                    alertCenterApi.liveBriefing().catch(() => ({ data: [] as BriefingItem[] })),
                    alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
                ]).then(([live, persisted]) => ({ data: mergeBriefings(live.data, persisted.data) })),
                farmsApi.getById(farmId).catch(() => ({ data: null as Farm | null })),
            ]);
            const result: any = pondsRes.data;
            return {
                ponds: (Array.isArray(result) ? result : (result?.data ?? [])) as Pond[],
                contexts: ctxRes.data,
                briefing: briefingRes.data,
                farm: farmRes.data,
            };
        },
        enabled: !!farmId,
    });

    const farm = query.data?.farm ?? null;
    const ponds = query.data?.ponds ?? [];
    const contexts = query.data?.contexts ?? [];
    const briefing = query.data?.briefing ?? [];
    // "Failed" and "this farm has no ponds" are different answers — never let a
    // dead network render as an empty farm.
    const hasData = query.data != null;
    const offline = query.isError && !(query.error as any)?.response;

    useRefetchOnFocus(qk.farm(farmId));
    useFocusEffect(
        useCallback(() => {
            loadMemberships();
        }, [loadMemberships]),
    );

    const rows = useMemo(
        () => sortByHealth(buildPondRows(ponds, contexts, briefing)),
        [ponds, contexts, briefing],
    );
    const roll = useMemo(() => rollUpFarm(rows), [rows]);

    const eyebrow = useMemo(() => {
        const role = roleForFarm(farmId);
        const area = Number(farm?.areaHectares) || 0;
        return [role ? t(`members.role_${role}`) : null, area > 0 ? t('farms.countHectares', { area: area.toFixed(1) }) : null]
            .filter(Boolean)
            .join(' · ');
    }, [farm, farmId, roleForFarm, t]);

    /** Water: how many ponds the engine says are out of range right now. */
    const water = useMemo(() => {
        const inRange = rows.filter((r) => r.health === 'fine').length;
        const fallow = rows.filter((r) => r.health === 'fallow').length;
        const out = roll.actNow + roll.watch;
        return { out, inRange, fallow };
    }, [rows, roll]);

    /** Feed: running FCR across stocked ponds, and how long since anyone fed. */
    const feed = useMemo(() => {
        const fcrs = rows
            .map((r) => r.context?.runningFcr)
            .filter((v): v is number => typeof v === 'number' && v > 0);
        const lastFed = rows
            .map((r) => r.context?.lastFeedAt)
            .filter(Boolean)
            .sort()
            .pop();
        return {
            fcr: fcrs.length ? (fcrs.reduce((a, b) => a + b, 0) / fcrs.length).toFixed(2) : null,
            ponds: fcrs.length,
            lastFedAgo: timeAgo(lastFed as string | undefined),
        };
    }, [rows]);

    const visible = expanded ? rows : rows.slice(0, VISIBLE_PONDS);
    const hidden = rows.length - visible.length;

    const header = (
        <ScreenHeader
            eyebrow={eyebrow || null}
            title={farmName ?? t('farms.title')}
            onBack={() => navigation.goBack()}
            accessibilityBackLabel={t('common.back')}
            // Editing a farm is WRITE_MANAGEMENT, the same capability the
            // backend guards the PATCH with — hidden, not disabled.
            actionLabel={perms.canManageOperations ? t('common.edit') : undefined}
            onAction={() => navigation.navigate('CreateFarm', { editFarmId: farmId })}
        />
    );

    if (query.isPending && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={{ padding: theme.spacing[4] }}>
                    <SkeletonList count={4} />
                </View>
            </ScreenWrapper>
        );
    }

    if (query.isError && !hasData) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                {offline ? (
                    <NetworkError onRetry={() => query.refetch()} />
                ) : (
                    <ErrorState title={t('farms.errorPondsTitle')} error={query.error} onRetry={() => query.refetch()} />
                )}
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={query.isRefetching}
                        onRefresh={() => query.refetch()}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                <StatRow
                    size="lg"
                    divider
                    stats={[
                        { value: String(roll.stocked), unit: `/${roll.total}`, label: t('farms.stocked') },
                        { value: roll.biomassKg != null ? kg(roll.biomassKg) : '—', label: t('farms.biomassKg') },
                        roll.actNow > 0
                            ? { value: String(roll.actNow), label: t('farms.actNow'), tone: 'danger' as const }
                            : { value: t('farms.allFine'), label: t('farms.status'), tone: 'success' as const, text: true },
                    ]}
                />

                <View style={styles.tiles}>
                    <Tile icon="checklist" label={t('farms.tasks')} onPress={() => navigation.navigate('TaskList', { farmId, farmName })} />
                    <Tile icon="groups" label={t('farms.members')} onPress={() => navigation.navigate('FarmMembers', { farmId, farmName })} />
                    {perms.canViewFinancials && (
                        <Tile icon="currency_rupee" label={t('farms.money')} onPress={() => navigation.navigate('Transactions', { farmId, farmName })} />
                    )}
                    {perms.canCreatePond && (
                        <Tile icon="add" label={t('farms.addPond')} onPress={() => navigation.navigate('CreatePond', { farmId, farmName, pondCount: ponds.length })} />
                    )}
                </View>

                {rows.length > 0 && (
                    <>
                        <SummaryRow
                            icon="water_drop"
                            title={
                                water.out > 0
                                    ? t('farms.pondsOutOfRange', { count: water.out })
                                    : t('farms.allPondsInRange')
                            }
                            subtitle={t('farms.rangeBreakdown', { inRange: water.inRange, fallow: water.fallow })}
                            value={water.out > 0 ? String(water.out) : null}
                            valueCaption={water.out > 0 ? t('farms.actNowLower') : null}
                            tone="danger"
                        />
                        {feed.fcr && (
                            <SummaryRow
                                icon="grain"
                                title={t('farms.fcrAcross', { fcr: feed.fcr, count: feed.ponds })}
                                subtitle={
                                    feed.lastFedAgo
                                        ? t('farms.lastFedAgo', { ago: feed.lastFedAgo })
                                        : t('farms.neverFed')
                                }
                                divider="strong"
                            />
                        )}
                    </>
                )}

                {!rows.length ? (
                    <EmptyState
                        icon="water"
                        title={t('farms.noPondsTitle')}
                        subtitle={t('farms.noPondsSubtitle')}
                        actionLabel={perms.canCreatePond ? t('farms.addPond') : undefined}
                        onAction={perms.canCreatePond ? () => navigation.navigate('CreatePond', { farmId, farmName, pondCount: ponds.length }) : undefined}
                    />
                ) : (
                    <>
                        <View style={styles.columns}>
                            <Text style={[styles.column, { flex: 1 }]}>{t('farms.colPond')}</Text>
                            <Text style={[styles.column, styles.colDay]}>{t('farms.colDay')}</Text>
                            <Text style={[styles.column, styles.colDo]}>{t('farms.colDo')}</Text>
                            <Text style={[styles.column, styles.colBiomass]}>{t('farms.colBiomass')}</Text>
                        </View>

                        {visible.map((row) => (
                            <PondRow
                                key={row.pond.id}
                                row={row}
                                canStartCycle={perms.canStartCycle}
                                onOpen={() =>
                                    navigation.navigate('PondDashboard', {
                                        pondId: row.pond.id,
                                        pondName: pondLabel(row.pond),
                                    })
                                }
                                onStartCycle={() => navigation.navigate('CreateCycle', { pondId: row.pond.id })}
                            />
                        ))}

                        {hidden > 0 && (
                            <TouchableOpacity
                                style={styles.showMore}
                                onPress={() => setExpanded(true)}
                                accessibilityRole="button"
                            >
                                <Text style={styles.showMoreLabel}>
                                    {t('farms.showMorePonds', { count: hidden })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const Tile: React.FC<{ icon: IconName; label: string; onPress: () => void }> = ({
    icon,
    label,
    onPress,
}) => (
    <TouchableOpacity style={styles.tile} onPress={onPress} accessibilityRole="button">
        <Icon name={icon} size={20} color={theme.roles.light.textSecondary} />
        <Text style={styles.tileLabel} numberOfLines={1}>
            {label}
        </Text>
    </TouchableOpacity>
);

/**
 * One pond as a table row. A critical pond takes a tinted ground as well as the
 * red edge — at a glance the farmer should see WHERE the block of trouble is,
 * not have to read four left borders to find it.
 */
const PondRow: React.FC<{
    row: PondWithHealth;
    canStartCycle: boolean;
    onOpen: () => void;
    onStartCycle: () => void;
}> = ({ row, canStartCycle, onOpen, onStartCycle }) => {
    const { t } = useTranslation();
    const { pond, health, reason, context } = row;
    const doValue = context?.waterQuality?.dissolvedOxygen;

    if (health === 'fallow') {
        return (
            <View style={[styles.pondRow, { borderLeftColor: HEALTH_COLOR.fallow }]}>
                <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={onOpen} accessibilityRole="button">
                    <Text style={styles.pondName} numberOfLines={1}>
                        {pondLabel(pond)}
                    </Text>
                    <Text style={styles.pondReason} numberOfLines={1}>
                        {t('farms.fallowReady')}
                    </Text>
                </TouchableOpacity>
                {canStartCycle && (
                    <TouchableOpacity onPress={onStartCycle} hitSlop={HIT_SLOP} accessibilityRole="button">
                        <Text style={styles.startCycle}>{t('farms.startCycle')}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpen}
            accessibilityRole="button"
            style={[
                styles.pondRow,
                { borderLeftColor: HEALTH_COLOR[health] },
                health === 'critical' && styles.pondRowCritical,
            ]}
        >
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.pondName} numberOfLines={1}>
                    {pondLabel(pond)}
                </Text>
                <Text style={[styles.pondReason, { color: HEALTH_TEXT[health] }]} numberOfLines={1}>
                    {reason ?? t('farms.pondActive')}
                </Text>
                {/* Logged / fed this session — same rule as the reminders and
                    the Today progress card (features/logProgress.ts). */}
                {!!context && (
                    <View style={styles.sessionHint}>
                        <SessionHint ctx={context} />
                    </View>
                )}
            </View>
            <Text style={[styles.cell, styles.colDay]}>{context?.doc ?? '—'}</Text>
            <Text
                style={[
                    styles.cell,
                    styles.colDo,
                    health === 'critical' && { color: theme.roles.light.dangerText },
                ]}
            >
                {doValue != null ? doValue.toFixed(1) : '—'}
            </Text>
            <Text style={[styles.cell, styles.colBiomass]}>
                {context?.biomassKg != null ? kg(Math.round(context.biomassKg)) : '—'}
            </Text>
        </TouchableOpacity>
    );
};

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: theme.roles.light.surface },
    tiles: {
        flexDirection: 'row',
        gap: theme.spacing[1.5],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    tile: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
        borderWidth: 1,
        borderColor: theme.roles.light.borderStrong,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[1],
        minHeight: 44,
        justifyContent: 'center',
    },
    tileLabel: {
        ...theme.typeScale.labelMedium,
        fontSize: 11,
        color: theme.roles.light.textPrimary,
    },
    columns: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        paddingBottom: theme.spacing[1],
    },
    column: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: theme.roles.light.textDisabled,
        textAlign: 'right',
    },
    colDay: { width: 44 },
    colDo: { width: 46 },
    colBiomass: { width: 66 },
    pondRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        borderLeftWidth: 3,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        backgroundColor: theme.roles.light.surface,
        minHeight: 44,
    },
    pondRowCritical: { backgroundColor: theme.roles.light.dangerBg },
    pondName: {
        ...theme.typeScale.labelLarge,
        fontSize: 15,
        lineHeight: 21,
        color: theme.roles.light.textPrimary,
    },
    pondReason: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        lineHeight: 16,
        color: theme.roles.light.textTertiary,
    },
    sessionHint: { marginTop: theme.spacing[1] },
    cell: {
        fontFamily: 'DMMono-Regular',
        fontSize: 15,
        color: theme.roles.light.textSecondary,
        textAlign: 'right',
    },
    startCycle: { ...theme.typeScale.labelMedium, color: theme.roles.light.textLink },
    showMore: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        paddingVertical: theme.spacing[3],
        paddingLeft: 17,
        minHeight: 44,
        justifyContent: 'center',
    },
    showMoreLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textLink },
});

export default FarmDetailScreen;
