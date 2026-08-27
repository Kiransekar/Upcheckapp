/**
 * Pond — artboard p1.
 *
 * Two things changed, and both are about what a farmer opens this screen FOR.
 *
 * 1. If the pond has a problem, it is now the first thing on the page, in words
 *    ("Oxygen 2.8 mg/L — start aerators") with a way to act. It used to be a
 *    generic "log your water quality" banner that said nothing about this pond.
 *
 * 2. The numbers come from pond-context — the same snapshot the decision engines
 *    read — instead of being recomputed here from samplings, harvests and feed
 *    totals. That removed a five-call chain AND a second definition of biomass
 *    and FCR that could disagree with the engines' own.
 *
 * The fourteen log types stay. Six sit on the surface (the daily loop) and the
 * rest collapse to one line, which is the design's compromise between "the app
 * can log anything" and "I have to feed the shrimp".
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { StatRow, type Stat } from '../../components/ui/StatRow';
import { Icon, type IconName } from '../../components/ui/Icon';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { pondsApi, type Pond } from '../../api/ponds';
import { cropsApi, type Crop } from '../../api/crops';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { alertCenterApi, type BriefingItem } from '../../api/alertCenter';
import { pnlApi, type CropPnl } from '../../api/pnl';
import { useMembershipStore } from '../../store/membershipStore';
import { usePermissions } from '../../hooks/usePermissions';

/** The create form already names these; the detail view must not re-word them. */
const SHAPE_KEY: Record<string, string> = {
    rectangular: 'ponds.shapeRect',
    circular: 'ponds.shapeCircular',
    raceway: 'ponds.shapeRaceway',
    irregular: 'ponds.shapeIrregular',
};
const CONSTRUCTION_KEY: Record<string, string> = {
    earthen: 'ponds.constructionEarthen',
    lined: 'ponds.constructionLined',
    cage: 'ponds.constructionCage',
    biofloc_ras: 'ponds.constructionBioflocRas',
};

type LogMode = 'log' | 'history';

interface LogAction {
    key: string;
    icon: IconName;
    logRoute: string;
    historyRoute: string;
    /** The daily loop — shown without expanding. */
    core?: boolean;
}

/**
 * Ordered most-used first. The six core actions are what a farmer touches every
 * day or week; the remaining eight are occasional clinical and lab logs.
 */
const LOG_ACTIONS: LogAction[] = [
    { key: 'actionWaterQuality', icon: 'water_drop', logRoute: 'WaterQualityLog', historyRoute: 'WaterQualityHistory', core: true },
    { key: 'actionFeed', icon: 'grain', logRoute: 'FeedLog', historyRoute: 'FeedHistory', core: true },
    { key: 'actionDailyRoutine', icon: 'checklist', logRoute: 'DailyRoutine', historyRoute: 'DailyRoutine', core: true },
    { key: 'actionSampling', icon: 'scale', logRoute: 'SamplingLog', historyRoute: 'SamplingHistory', core: true },
    { key: 'actionMeasurements', icon: 'show_chart', logRoute: 'Measurements', historyRoute: 'Measurements', core: true },
    { key: 'actionAdvisor', icon: 'lightbulb', logRoute: 'EnginesHub', historyRoute: 'EnginesHub', core: true },
    { key: 'actionTreatment', icon: 'science', logRoute: 'TreatmentLog', historyRoute: 'TreatmentHistory' },
    { key: 'actionMortality', icon: 'warning', logRoute: 'MortalityLog', historyRoute: 'MortalityHistory' },
    { key: 'actionDisease', icon: 'science', logRoute: 'DiseaseLog', historyRoute: 'DiseaseHistory' },
    { key: 'actionChemical', icon: 'science', logRoute: 'ChemicalLog', historyRoute: 'ChemicalHistory' },
    { key: 'actionPlankton', icon: 'grass', logRoute: 'PlanktonLog', historyRoute: 'PlanktonHistory' },
    { key: 'actionMicrobiology', icon: 'science', logRoute: 'MicrobiologyLog', historyRoute: 'MicrobiologyHistory' },
    { key: 'actionHarvest', icon: 'set_meal', logRoute: 'HarvestLog', historyRoute: 'HarvestHistory' },
    { key: 'actionWeeklyChem', icon: 'science', logRoute: 'WeeklyChemistry', historyRoute: 'WeeklyChemistry' },
];

const CORE_COUNT = LOG_ACTIONS.filter((a) => a.core).length;

const num = (v: number | null | undefined, digits = 1): string =>
    v == null ? '—' : v.toFixed(digits);

const inr = (n: number): string => {
    const a = Math.abs(n);
    if (a >= 1e7) return `₹${(a / 1e7).toFixed(2)}Cr`;
    if (a >= 1e5) return `₹${(a / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `₹${(a / 1e3).toFixed(1)}k`;
    return `₹${Math.round(a)}`;
};

const timeAgo = (iso?: string | null): string | null => {
    if (!iso) return null;
    const ms = Date.now() - Date.parse(iso);
    if (Number.isNaN(ms) || ms < 0) return null;
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
};

export const PondDashboardScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName } = route.params;
    const loadMemberships = useMembershipStore((s) => s.load);

    const [pond, setPond] = useState<Pond | null>(null);
    const [cycle, setCycle] = useState<Crop | null>(null);
    const [context, setContext] = useState<PondContext | null>(null);
    const [alert, setAlert] = useState<BriefingItem | null>(null);
    const [pnl, setPnl] = useState<CropPnl | null>(null);
    const [mode, setMode] = useState<LogMode>('log');
    const [showAll, setShowAll] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [offline, setOffline] = useState(false);

    const perms = usePermissions(pond?.farmId);

    const load = useCallback(async () => {
        setError(null);
        setOffline(false);
        try {
            const { data: pondData } = await pondsApi.getById(pondId);
            setPond(pondData);

            // Everything below needs only the pond (and its cycle id), so it all
            // goes out at once rather than in a chain.
            const [ctxRes, cycleRes, briefRes] = await Promise.all([
                pondContextApi.get(pondId).catch(() => ({ data: null as PondContext | null })),
                pondData.activeCycleId
                    ? cropsApi.getById(pondData.activeCycleId).catch(() => ({ data: null as Crop | null }))
                    : Promise.resolve({ data: null as Crop | null }),
                alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
            ]);
            setContext(ctxRes.data);
            setCycle(cycleRes.data);
            setAlert(briefRes.data.find((b) => b.pondId === pondId && b.topSeverity !== 'info') ?? null);
        } catch (err: any) {
            if (!err?.response) setOffline(true);
            setError(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [pondId]);

    useFocusEffect(
        useCallback(() => {
            loadMemberships();
            load();
        }, [load, loadMemberships]),
    );

    // Costs are a separate, permissioned call — a worker never triggers it.
    useFocusEffect(
        useCallback(() => {
            if (!perms.canViewFinancials || !pond?.activeCycleId) {
                setPnl(null);
                return;
            }
            pnlApi
                .cropPnl(pond.activeCycleId)
                .then(({ data }) => setPnl(data))
                .catch(() => setPnl(null));
        }, [perms.canViewFinancials, pond?.activeCycleId]),
    );

    /** Survival = live population over what was stocked. */
    const survival = useMemo(() => {
        const stocked = context?.crop?.stockingCount;
        const live = context?.livePopulation;
        if (!stocked || live == null) return null;
        return Math.round((live / stocked) * 100);
    }, [context]);

    /** Days between today and the cycle's target length. */
    const daysToTarget = useMemo(() => {
        const target = context?.crop?.targetCultivationDays;
        if (target == null || context?.doc == null) return null;
        return target - context.doc;
    }, [context]);

    const openAction = (action: LogAction) => {
        const params: Record<string, any> = { pondId, pondName };
        if (cycle) params.cropId = cycle.id;
        if (pond?.farmId) params.farmId = pond.farmId;
        navigation.navigate(mode === 'log' ? action.logRoute : action.historyRoute, params);
    };

    const wq = context?.waterQuality;
    const readingAgo = timeAgo(wq?.recordedAt);

    // A surveyed area is a measurement of the real pond; the calculated one
    // is a rectangle worth of arithmetic. Where both exist the survey wins,
    // exactly as the create form decides it.
    const areaM2 = Number(pond?.overrideAreaM2) || Number(pond?.calculatedAreaM2) || 0;

    /** "80 × 45 × 1.4 m" or "⌀ 20 × 1.4 m" — only the parts that exist. */
    const dimensionLine = (() => {
        if (!pond) return '—';
        const n = (v: unknown) => (v == null || v === '' ? null : String(v));
        const parts = pond.geometryType === 'circular'
            ? [n(pond.diameterM) ? `⌀ ${n(pond.diameterM)}` : null]
            : [n(pond.lengthM), n(pond.widthM)];
        const all = [...parts, n(pond.depthM)].filter(Boolean);
        return all.length ? `${all.join(' × ')} m` : '—';
    })();

    /** "4 units · 8 HP · 22 HP/ha" — the last is what a pond is judged by. */
    const aeratorLine = (() => {
        const count = Number(pond?.aeratorCount) || 0;
        const hp = Number(pond?.installedAeratorHp) || 0;
        if (!count && !hp) return '—';
        const hectares = areaM2 / 10000;
        return [
            count ? t('ponds.aeratorCountValue', { count }) : null,
            hp ? `${hp} HP` : null,
            hp > 0 && hectares > 0 ? `${Math.round(hp / hectares)} HP/ha` : null,
        ].filter(Boolean).join(' · ');
    })();

    const header = (
        <ScreenHeader
            eyebrow={pond ? t(`ponds.status_${pond.status}`, { defaultValue: pond.status }) : null}
            title={pondName ?? t('ponds.title')}
            onBack={() => navigation.goBack()}
            accessibilityBackLabel={t('common.back')}
            actionLabel={perms.canManageOperations ? t('common.edit') : undefined}
            onAction={() =>
                navigation.navigate('CreatePond', {
                    farmId: pond?.farmId,
                    farmName: undefined,
                    editPondId: pondId,
                })
            }
        />
    );

    if (loading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.skeleton}>
                    <Skeleton width="100%" height={72} style={styles.mb} />
                    <Skeleton width="100%" height={56} style={styles.mb} />
                    <Skeleton width="100%" height={140} />
                </View>
            </ScreenWrapper>
        );
    }

    if (offline) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <NetworkError onRetry={() => { setLoading(true); load(); }} />
            </ScreenWrapper>
        );
    }

    if (error && !pond) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <ErrorState title={t('ponds.errorPondTitle')} error={error} onRetry={() => { setLoading(true); load(); }} />
            </ScreenWrapper>
        );
    }

    const visibleActions = showAll ? LOG_ACTIONS : LOG_ACTIONS.filter((a) => a.core);
    const hiddenCount = LOG_ACTIONS.length - CORE_COUNT;

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                {/*
                  * The pond's problem, in the engine's own words, above everything
                  * else. "Done" sends them to the log rather than clearing the
                  * alert here — recording the new reading is what actually
                  * resolves it, and marking it done without one would just hide a
                  * pond that still has 2.8 mg/L of oxygen in it.
                  */}
                {alert && (
                    <View style={styles.alert}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.alertTitle}>{alert.topTitle}</Text>
                            {!!readingAgo && (
                                <Text style={styles.alertMeta}>
                                    {t('ponds.readAgo', { ago: readingAgo })}
                                </Text>
                            )}
                        </View>
                        {perms.canRecordData && (
                            <TouchableOpacity
                                style={styles.alertBtn}
                                onPress={() => navigation.navigate('WaterQualityLog', { pondId, pondName, cropId: cycle?.id })}
                                accessibilityRole="button"
                            >
                                <Text style={styles.alertBtnLabel}>{t('ponds.markDone')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {cycle ? (
                    <>
                        <View style={styles.cycleRow}>
                            <View style={styles.docBox}>
                                <Text style={styles.docValue}>{context?.doc ?? '—'}</Text>
                                <Text style={styles.docLabel}>{t('ponds.doc')}</Text>
                            </View>
                            <View style={styles.cycleDivider} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.cycleName} numberOfLines={1}>
                                    {cycle.name}
                                </Text>
                                <Text style={styles.cycleMeta} numberOfLines={1}>
                                    {[
                                        cycle.stockingDate
                                            ? t('ponds.stocked', {
                                                  date: new Date(cycle.stockingDate).toLocaleDateString('en-IN', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  }),
                                              })
                                            : null,
                                        context?.crop?.stockingCount
                                            ? t('ponds.plCount', {
                                                  pl: context.crop.stockingCount.toLocaleString('en-IN'),
                                              })
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>
                            {perms.canRecordData && (
                                <TouchableOpacity
                                    style={styles.harvestBtn}
                                    onPress={() => navigation.navigate('HarvestLog', { pondId, pondName, cropId: cycle.id })}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.harvestLabel}>{t('ponds.harvest')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <StatRow
                            divider
                            stats={[
                                { value: num(context?.abwG), label: t('ponds.metricMbwG') },
                                { value: survival != null ? String(survival) : '—', label: t('ponds.metricSurvivalPct') },
                                {
                                    value: context?.biomassKg != null ? Math.round(context.biomassKg).toLocaleString('en-IN') : '—',
                                    label: t('ponds.metricBiomassKg'),
                                },
                                { value: num(context?.runningFcr, 2), label: t('ponds.metricFcr') },
                            ]}
                        />

                        <View style={styles.modeRow}>
                            <ModeButton
                                label={t('ponds.tabLogData')}
                                active={mode === 'log'}
                                onPress={() => setMode('log')}
                            />
                            <ModeButton
                                label={t('ponds.tabViewHistory')}
                                active={mode === 'history'}
                                onPress={() => setMode('history')}
                            />
                        </View>

                        <View style={styles.grid}>
                            {visibleActions.map((action) => (
                                <TouchableOpacity
                                    key={action.key}
                                    style={styles.gridTile}
                                    onPress={() => openAction(action)}
                                    accessibilityRole="button"
                                >
                                    <Icon name={action.icon} size={20} color={theme.roles.light.textSecondary} />
                                    <Text style={styles.gridLabel} numberOfLines={1}>
                                        {t(`ponds.${action.key}`)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {hiddenCount > 0 && (
                            <TouchableOpacity
                                style={styles.moreRow}
                                onPress={() => setShowAll((v) => !v)}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: showAll }}
                            >
                                <Text style={styles.moreLabel}>
                                    {showAll ? t('ponds.showLess') : t('ponds.moreLogTypes', { count: hiddenCount })}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {wq && (
                            <>
                                <SectionHeader
                                    label={t('ponds.latestReading')}
                                    actionLabel={readingAgo ? t('ponds.agoShort', { ago: readingAgo }) : undefined}
                                    onAction={() => navigation.navigate('WaterQualityHistory', { pondId, pondName })}
                                />
                                <StatRow
                                    stats={
                                        [
                                            {
                                                value: num(wq.dissolvedOxygen),
                                                label: t('ponds.wqDo'),
                                                tone: alert?.topSeverity === 'critical' ? 'danger' : 'default',
                                            },
                                            { value: num(wq.ph), label: t('ponds.wqPh') },
                                            { value: num(wq.temperature), label: t('ponds.wqTemp') },
                                            { value: num(wq.salinity, 0), label: t('ponds.wqSalt') },
                                        ] as Stat[]
                                    }
                                />
                            </>
                        )}

                        {perms.canViewFinancials && (
                            <>
                                <SectionHeader label={t('ponds.moneyForPond')} />
                                <SummaryRow
                                    icon="receipt_long"
                                    title={t('ponds.viewExpenses')}
                                    subtitle={
                                        pnl ? t('ponds.spentThisCycle', { amount: inr(pnl.totalCost) }) : undefined
                                    }
                                    onPress={() => navigation.navigate('Expenses', { cropId: cycle.id, pondName })}
                                />
                                <SummaryRow
                                    icon="event_available"
                                    title={t('ponds.harvestPlan')}
                                    subtitle={
                                        daysToTarget != null
                                            ? daysToTarget > 0
                                                ? t('ponds.windowOpensIn', { count: daysToTarget })
                                                : t('ponds.windowOpen')
                                            : undefined
                                    }
                                    onPress={() =>
                                        navigation.navigate('HarvestPlans', {
                                            pondId,
                                            pondName,
                                            cropId: cycle.id,
                                            farmId: pond?.farmId,
                                        })
                                    }
                                    divider="strong"
                                />
                            </>
                        )}
                    </>
                ) : (
                    <View style={styles.idle}>
                        <Icon name="waves" size={40} color={theme.roles.light.textDisabled} />
                        <Text style={styles.idleTitle}>{t('ponds.idleTitle')}</Text>
                        <Text style={styles.idleSub}>{t('ponds.idleSubtitle')}</Text>
                        {perms.canStartCycle && (
                            <TouchableOpacity
                                style={styles.startBtn}
                                onPress={() => navigation.navigate('CreateCycle', { pondId })}
                                accessibilityRole="button"
                            >
                                <Text style={styles.startLabel}>{t('ponds.startNewCycle')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/*
                  * The pond itself. Every one of these figures is asked for when
                  * the pond is created and then went nowhere — the shape, the
                  * bottom, the measurements, the aerators. A farmer who typed
                  * them had no way to check them, correct them, or even see
                  * that the app had kept them. Area and volume are shown
                  * alongside because they are what the numbers above are FOR:
                  * every stocking, dosing and feed figure divides by them.
                  */}
                {!!pond && (
                    <>
                        <SectionHeader
                            label={t('ponds.aboutThisPond')}
                            actionLabel={perms.canManageOperations ? t('common.edit') : undefined}
                            onAction={() =>
                                navigation.navigate('CreatePond', { farmId: pond.farmId, editPondId: pondId })
                            }
                        />
                        <SummaryRow
                            icon="waves"
                            title={t('ponds.labelPondShape')}
                            subtitle={[
                                pond.geometryType ? t(SHAPE_KEY[pond.geometryType] ?? '', { defaultValue: pond.geometryType }) : null,
                                pond.constructionType ? t(CONSTRUCTION_KEY[pond.constructionType] ?? '', { defaultValue: pond.constructionType }) : null,
                            ].filter(Boolean).join(' · ') || '—'}
                        />
                        <SummaryRow
                            icon="scale"
                            title={t('ponds.labelMeasurements')}
                            subtitle={dimensionLine}
                        />
                        {areaM2 > 0 && (
                            <StatRow
                                stats={[
                                    { value: Math.round(areaM2).toLocaleString('en-IN'), label: t('ponds.metricArea') },
                                    { value: Math.round(areaM2 * (Number(pond.depthM) || 0)).toLocaleString('en-IN'), label: t('ponds.metricVolume') },
                                    { value: (areaM2 / 10000).toFixed(2), label: t('ponds.metricHectares') },
                                ]}
                                divider
                            />
                        )}
                        <SummaryRow
                            icon="grain"
                            title={t('ponds.labelAerators')}
                            subtitle={aeratorLine}
                            divider="strong"
                        />
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

/** "Log data" / "History" — a filled pair, not a tab strip. */
const ModeButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({
    label,
    active,
    onPress,
}) => (
    <TouchableOpacity
        style={[styles.modeBtn, active ? styles.modeBtnActive : styles.modeBtnIdle]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.modeLabel, active ? styles.modeLabelActive : styles.modeLabelIdle]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: theme.roles.light.surface },
    skeleton: { padding: theme.spacing[4] },
    mb: { marginBottom: theme.spacing[3] },

    alert: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        backgroundColor: theme.roles.light.dangerBg,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerBorder,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.dangerBorder,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    alertTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.dangerText },
    alertMeta: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: theme.roles.light.dangerText,
        opacity: 0.85,
    },
    alertBtn: {
        backgroundColor: theme.roles.light.dangerText,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[4],
        minHeight: 44,
        justifyContent: 'center',
    },
    alertBtnLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textInverse },

    cycleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    docBox: { alignItems: 'flex-start' },
    docValue: { fontFamily: 'DMMono-Medium', fontSize: 24, lineHeight: 28, color: theme.roles.light.textPrimary },
    docLabel: {
        ...theme.typeScale.labelSmall,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: theme.roles.light.textDisabled,
    },
    cycleDivider: { width: 1, alignSelf: 'stretch', backgroundColor: theme.roles.light.borderDefault },
    cycleName: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    cycleMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: theme.roles.light.textTertiary },
    harvestBtn: {
        borderWidth: 1.5,
        borderColor: theme.roles.light.successText,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
        justifyContent: 'center',
    },
    harvestLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.successText },

    modeRow: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
    },
    modeBtn: {
        flex: 1,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[3],
        alignItems: 'center',
        minHeight: 44,
        justifyContent: 'center',
    },
    modeBtnActive: { backgroundColor: theme.roles.light.textPrimary },
    modeBtnIdle: { borderWidth: 1, borderColor: theme.roles.light.textSecondary },
    modeLabel: { ...theme.typeScale.labelLarge },
    modeLabelActive: { color: theme.roles.light.textInverse },
    modeLabelIdle: { color: theme.roles.light.textSecondary },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[1.5],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2.5],
    },
    gridTile: {
        // Three across, whatever the phone: each takes a third of the row minus
        // the two gaps between them.
        width: '31.8%',
        alignItems: 'center',
        gap: 3,
        borderWidth: 1,
        borderColor: theme.roles.light.borderStrong,
        borderRadius: theme.radius.xs,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[1],
        minHeight: 60,
        justifyContent: 'center',
    },
    gridLabel: { ...theme.typeScale.labelMedium, fontSize: 11, color: theme.roles.light.textPrimary },
    moreRow: {
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        minHeight: 44,
        justifyContent: 'center',
    },
    moreLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textLink },

    idle: { alignItems: 'center', gap: theme.spacing[2], padding: theme.spacing[8] },
    idleTitle: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    idleSub: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textTertiary },
    startBtn: {
        marginTop: theme.spacing[3],
        backgroundColor: theme.roles.light.primaryHover,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[6],
        minHeight: 44,
        justifyContent: 'center',
    },
    startLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textInverse },
});

export default PondDashboardScreen;
