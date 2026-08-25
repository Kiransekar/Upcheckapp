import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Animated,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { pondsApi, Pond } from '../../api/ponds';
import { cropsApi, Crop } from '../../api/crops';
import { computeDOC } from '../../store/activeFarmStore';
import { samplingApi } from '../../api/sampling';
import { feedApi } from '../../api/feedRecords';
import { harvestsApi } from '../../api/harvests';
import { waterQualityApi } from '../../api/waterQuality';
import { useMembershipStore } from '../../store/membershipStore';
import { usePermissions } from '../../hooks/usePermissions';
import { isFeatureEnabled } from '../../config/features';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ActionConfig = {
    label: string;
    icon: string;
    color: string;
    bg: string;
    logRoute: string;
    historyRoute: string;
    core?: boolean; // shown by default; non-core actions collapse under "More"
};

type ChipMode = 'log' | 'history';

const ActionChip = ({ item, mode, onPress }: { item: ActionConfig; mode: ChipMode; onPress: () => void }) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const handlePressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start();
    const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

    return (
        <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
            <Animated.View style={[chipStyles.chip, { transform: [{ scale }] }]}>
                <View style={[chipStyles.iconWrap, { backgroundColor: item.bg }]}>
                    <MaterialCommunityIcons name={mode === 'history' ? 'history' : (item.icon as any)} size={20} color={item.color} />
                </View>
                <Text style={chipStyles.label} numberOfLines={1}>{item.label}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

const chipStyles = StyleSheet.create({
    chip: { alignItems: 'center', width: (SCREEN_WIDTH - theme.spacing[4] * 2 - theme.spacing[3] * 2) / 3, paddingVertical: theme.spacing[3] },
    iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
    label: { fontSize: 11, fontWeight: '500', color: theme.roles.light.textSecondary, textAlign: 'center' },
});

const SectionTab = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[tabStyles.tab, active && tabStyles.tabActive]} activeOpacity={0.7}>
        <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{label}</Text>
    </TouchableOpacity>
);

const tabStyles = StyleSheet.create({
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
    label: { fontSize: 13, fontWeight: '500', color: theme.roles.light.textTertiary },
    labelActive: { color: theme.roles.light.textPrimary, fontWeight: '700' },
});

const DOC_MAX = 120;

const DocBadge = ({ doc }: { doc: number }) => {
    const progress = Math.min(doc / DOC_MAX, 1);
    const color = progress < 0.4 ? theme.roles.light.successBorder : progress < 0.75 ? theme.roles.light.warningBorder : theme.roles.light.dangerBorder;

    return (
        <View style={docStyles.container}>
            <View style={[docStyles.ring, { borderColor: color + '30' }]}>
                <View style={[docStyles.innerRing, { borderColor: color }]} />
                <View style={docStyles.center}>
                    <Text style={[docStyles.number, { color }]}>{doc}</Text>
                    <Text style={docStyles.suffix}>DOC</Text>
                </View>
            </View>
        </View>
    );
};

const docStyles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
    innerRing: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderStyle: 'dashed' },
    center: { alignItems: 'center' },
    number: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
    suffix: { fontSize: 9, fontWeight: '600', color: theme.roles.light.textTertiary, letterSpacing: 1 },
});

const MetricTile = ({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: string }) => (
    <View style={tileStyles.container}>
        <MaterialCommunityIcons name={icon as any} size={14} color={theme.roles.light.textTertiary} style={{ marginBottom: 4 }} />
        <Text style={tileStyles.value}>
            {value}
            {value !== '--' && unit ? <Text style={tileStyles.unit}> {unit}</Text> : null}
        </Text>
        <Text style={tileStyles.label}>{label}</Text>
    </View>
);

const tileStyles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    value: { fontSize: 18, fontWeight: '700', color: theme.roles.light.textPrimary },
    unit: { fontSize: 11, fontWeight: '500', color: theme.roles.light.textSecondary },
    label: { fontSize: 10, fontWeight: '500', color: theme.roles.light.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export const PondDashboardScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId, pondName } = route.params;

    // Ordered most-used first. The six `core` actions are a farmer's daily/weekly
    // loop and show by default; the rest (occasional clinical/lab logs) collapse
    // under "More" to keep the daily surface uncluttered.
    const ACTION_CONFIG: ActionConfig[] = [
        { label: t('ponds.actionWaterQuality'), icon: 'water-percent', color: theme.roles.light.primary, bg: theme.roles.light.infoBg, logRoute: 'WaterQualityLog', historyRoute: 'WaterQualityHistory', core: true },
        { label: t('ponds.actionFeed'), icon: 'corn', color: theme.roles.light.warningBorder, bg: theme.roles.light.warningBg, logRoute: 'FeedLog', historyRoute: 'FeedHistory', core: true },
        { label: t('ponds.actionDailyRoutine'), icon: 'clipboard-check-outline', color: theme.roles.light.successText, bg: theme.roles.light.successBg, logRoute: 'DailyRoutine', historyRoute: 'DailyRoutine', core: true },
        { label: t('ponds.actionSampling'), icon: 'scale', color: theme.roles.light.successBorder, bg: theme.roles.light.successBg, logRoute: 'SamplingLog', historyRoute: 'SamplingHistory', core: true },
        { label: t('ponds.actionMeasurements'), icon: 'chart-line', color: theme.roles.light.primary, bg: theme.roles.light.infoBg, logRoute: 'Measurements', historyRoute: 'Measurements', core: true },
        { label: t('ponds.actionAdvisor'), icon: 'lightbulb-on-outline', color: theme.roles.light.primary, bg: theme.roles.light.infoBg, logRoute: 'EnginesHub', historyRoute: 'EnginesHub', core: true },
        { label: t('ponds.actionTreatment'), icon: 'pill', color: theme.roles.light.dangerBorder, bg: theme.roles.light.dangerBg, logRoute: 'TreatmentLog', historyRoute: 'TreatmentHistory' },
        { label: t('ponds.actionMortality'), icon: 'alert-circle', color: theme.roles.light.dangerBorder, bg: theme.roles.light.dangerBg, logRoute: 'MortalityLog', historyRoute: 'MortalityHistory' },
        { label: t('ponds.actionDisease'), icon: 'virus', color: theme.roles.light.primary, bg: theme.roles.light.infoBg, logRoute: 'DiseaseLog', historyRoute: 'DiseaseHistory' },
        { label: t('ponds.actionChemical'), icon: 'flask', color: theme.roles.light.warningBorder, bg: theme.roles.light.warningBg, logRoute: 'ChemicalLog', historyRoute: 'ChemicalHistory' },
        { label: t('ponds.actionPlankton'), icon: 'leaf', color: theme.roles.light.successText, bg: theme.roles.light.successBg, logRoute: 'PlanktonLog', historyRoute: 'PlanktonHistory' },
        { label: t('ponds.actionMicrobiology'), icon: 'microscope', color: theme.roles.light.textSecondary, bg: theme.roles.light.surfaceVariant, logRoute: 'MicrobiologyLog', historyRoute: 'MicrobiologyHistory' },
        { label: t('ponds.actionHarvest'), icon: 'basket', color: theme.roles.light.successBorder, bg: theme.roles.light.successBg, logRoute: 'HarvestLog', historyRoute: 'HarvestHistory' },
        { label: t('ponds.actionWeeklyChem'), icon: 'flask-outline', color: theme.roles.light.warningBorder, bg: theme.roles.light.warningBg, logRoute: 'WeeklyChemistry', historyRoute: 'WeeklyChemistry' },
    ];
    const coreActions = ACTION_CONFIG.filter((a) => a.core);
    const moreCount = ACTION_CONFIG.length - coreActions.length;
    const [pond, setPond] = useState<Pond | null>(null);
    const [activeCycle, setActiveCycle] = useState<Crop | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [activeTab, setActiveTab] = useState<ChipMode>('log');
    const [showAllActions, setShowAllActions] = useState(false);

    // Economics (expenses, harvest planning) are owner-only; workers see only the
    // operational logging surface. Backend enforces the real gate regardless.
    const loadMemberships = useMembershipStore((s) => s.load);
    const perms = usePermissions(pond?.farmId);
    useEffect(() => { loadMemberships(); }, [loadMemberships]);

    const [mbw, setMbw] = useState<string>('--');
    const [survival, setSurvival] = useState<string>('--');
    const [biomass, setBiomass] = useState<string>('--');
    const [fcr, setFcr] = useState<string>('--');
    const [wqAlert, setWqAlert] = useState<boolean>(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Cache ref
    const cacheRef = useRef<{ pond: Pond; cycle: Crop | null; metrics: any; timestamp: number } | null>(null);
    const CACHE_TTL = 30000;

    const fadeIn = useCallback(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, [fadeAnim]);

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && cacheRef.current) {
            const cached = cacheRef.current;
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                setPond(cached.pond);
                setActiveCycle(cached.cycle);
                setMbw(cached.metrics.mbw);
                setSurvival(cached.metrics.survival);
                setBiomass(cached.metrics.biomass);
                setFcr(cached.metrics.fcr);
                setWqAlert(cached.metrics.wqAlert);
                setIsLoading(false);
                fadeIn();
                return;
            }
        }

        setError(null);
        setIsOffline(false);

        try {
            const { data: pondData } = await pondsApi.getById(pondId);
            setPond(pondData);

            if (pondData.activeCycleId) {
                // All four calls only need pondId/activeCycleId (both already known),
                // so they run in one batch instead of a 4-deep sequential chain — this
                // was the main contributor to the dashboard's 10s+ load time.
                const [cycleRes, samplingRes, feedTotalRes, harvestRes, wqLatestRes] = await Promise.all([
                    cropsApi.getById(pondData.activeCycleId),
                    samplingApi.getAll(pondData.activeCycleId),
                    // ponytail: sums feed across every cycle ever run on this pond, not
                    // just the active one — it's the only total (unpaginated) endpoint
                    // the feed API exposes. Add a cycle-scoped total if that skews FCR.
                    feedApi.getTotalByPond(pondId),
                    // Scoped to this cycle — passing no cropId makes the backend scan
                    // every harvest across every farm the user can access (up to 500
                    // rows), unrelated to this one pond.
                    harvestsApi.getAll(pondData.activeCycleId),
                    waterQualityApi.getLatest(pondId).catch(() => ({ data: null }) as any),
                ]);
                const cycleData = cycleRes.data;
                setActiveCycle(cycleData);

                const samplings = samplingRes.data || [];
                const sortedSamplings = [...samplings].sort((a, b) => new Date(b.samplingDate).getTime() - new Date(a.samplingDate).getTime());
                let currentBiomass = 0;

                // Computed locally (not read back from state) so the values below and
                // the cache write always agree with what was just fetched.
                let newMbw = '--';
                let newSurvival = '--';

                if (sortedSamplings.length > 0) {
                    const latest = sortedSamplings[0];
                    newMbw = latest.mbwG ? latest.mbwG.toString() : '--';
                    newSurvival = latest.srEstimationPercent ? latest.srEstimationPercent.toString() : '--';
                    currentBiomass += Number(latest.biomassEstimationKg || 0);
                }

                // Already scoped to this cycle by the harvestsApi.getAll(cropId) call above.
                const cycleHarvests = harvestRes.data || [];
                const harvestedBiomass = cycleHarvests.reduce((sum: number, h: any) => sum + Number(h.weightKg || 0), 0);
                const totalBiomass = currentBiomass + harvestedBiomass;
                const newBiomass = totalBiomass > 0 ? (totalBiomass / 1000).toFixed(2) : '--';

                const totalFeedKg = Number(feedTotalRes.data) || 0;
                const newFcr = totalBiomass > 0 && totalFeedKg > 0 ? (totalFeedKg / totalBiomass).toFixed(2) : '--';

                const newWqAlert = !wqLatestRes.data?.recordedAt
                    || (Date.now() - new Date(wqLatestRes.data.recordedAt).getTime()) / 3_600_000 > 24;

                setMbw(newMbw);
                setSurvival(newSurvival);
                setBiomass(newBiomass);
                setFcr(newFcr);
                setWqAlert(newWqAlert);

                // Cache the freshly computed values, not the (still-stale) closure state.
                cacheRef.current = {
                    pond: pondData,
                    cycle: cycleData,
                    metrics: { mbw: newMbw, survival: newSurvival, biomass: newBiomass, fcr: newFcr, wqAlert: newWqAlert },
                    timestamp: Date.now(),
                };
            } else {
                setActiveCycle(null);
                setMbw('--');
                setSurvival('--');
                setBiomass('--');
                setFcr('--');
                setWqAlert(false);
            }
            fadeIn();
        } catch (err: any) {
            const statusCode = err?.response?.status;
            if (statusCode === 0 || err?.code === 'NETWORK_ERROR' || !err?.response) {
                setIsOffline(true);
            }
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [pondId, fadeIn]);

    useFocusEffect(
        useCallback(() => {
            fadeAnim.setValue(0);
            fetchData();
        }, [fetchData])
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchData(true);
    }, [fetchData]);

    const navigateAction = (item: ActionConfig) => {
        const route = activeTab === 'log' ? item.logRoute : item.historyRoute;
        const params: Record<string, any> = { pondId, pondName };
        if (activeCycle) params.cropId = activeCycle.id;
        if (pond?.farmId) params.farmId = pond.farmId;
        navigation.navigate(route, params);
    };

    const doc = activeCycle?.stockingDate
        ? computeDOC(activeCycle.stockingDate, activeCycle.initialAgeDays ?? 0)
        : (activeCycle?.doc ?? 0);
    const pondStatusColor = pond?.status === 'active' ? theme.roles.light.successBorder : pond?.status === 'fallow' ? theme.roles.light.warningBorder : theme.roles.light.textDisabled;

    const renderSkeleton = () => (
        <View style={styles.scrollContent}>
            <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                    <Skeleton width={72} height={72} borderRadius={36} />
                    <View style={styles.heroInfo}>
                        <Skeleton width={80} height={12} style={styles.mb2} />
                        <Skeleton width={120} height={20} />
                    </View>
                </View>
                <View style={styles.metricsRow}>
                    <View style={tileStyles.container}><Skeleton width={40} height={18} /></View>
                    <View style={styles.metricDivider} />
                    <View style={tileStyles.container}><Skeleton width={40} height={18} /></View>
                    <View style={styles.metricDivider} />
                    <View style={tileStyles.container}><Skeleton width={40} height={18} /></View>
                    <View style={styles.metricDivider} />
                    <View style={tileStyles.container}><Skeleton width={40} height={18} /></View>
                </View>
            </View>
            <View style={styles.actionsSection}>
                <View style={styles.tabBar}>
                    <Skeleton width="45%" height={36} borderRadius={10} />
                    <Skeleton width="45%" height={36} borderRadius={10} />
                </View>
                <View style={styles.actionGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} width={52} height={52} borderRadius={16} style={styles.mb2} />
                    ))}
                </View>
            </View>
        </View>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={[styles.statusDot, { backgroundColor: pondStatusColor }]} />
                    <Text style={styles.headerTitle} numberOfLines={1}>{pondName}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="cog-outline" size={22} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                renderSkeleton()
            ) : isOffline ? (
                <NetworkError onRetry={handleRetry} />
            ) : error && !pond ? (
                <ErrorState title={t('ponds.errorPondTitle')} error={error} onRetry={handleRetry} />
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.roles.light.primary]} tintColor={theme.roles.light.primary} />}>
                        {activeCycle && wqAlert && (
                            <AlertBanner title={t('ponds.wqAlertTitle')} message={t('ponds.wqAlertMessage')} type="warning" />
                        )}

                        {activeCycle ? (
                            <View style={styles.heroCard}>
                                <View style={styles.heroTop}>
                                    <DocBadge doc={doc} />
                                    <View style={styles.heroInfo}>
                                        <Text style={styles.heroLabel}>{t('ponds.activeCycleLabel')}</Text>
                                        <Text style={styles.heroName} numberOfLines={1}>{activeCycle.name}</Text>
                                        {activeCycle.stockingDate && (
                                            <Text style={styles.heroDate}>
                                                {t('ponds.stocked', { date: new Date(activeCycle.stockingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) })}
                                            </Text>
                                        )}
                                    </View>
                                    <TouchableOpacity style={styles.harvestBtn} onPress={() => navigation.navigate('HarvestLog', { pondId, pondName, cropId: activeCycle.id })} activeOpacity={0.8}>
                                        <MaterialCommunityIcons name="basket-outline" size={16} color="#fff" />
                                        <Text style={styles.harvestBtnText}>{t('ponds.harvest')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.metricsRow}>
                                    <MetricTile label={t('ponds.metricMbw')} value={mbw} unit="g" icon="scale" />
                                    <View style={styles.metricDivider} />
                                    <MetricTile label={t('ponds.metricSurvival')} value={survival} unit="%" icon="heart-pulse" />
                                    <View style={styles.metricDivider} />
                                    <MetricTile label={t('ponds.metricBiomass')} value={biomass} unit="T" icon="weight-kilogram" />
                                    <View style={styles.metricDivider} />
                                    <MetricTile label={t('ponds.metricFcr')} value={fcr} unit="" icon="swap-horizontal" />
                                </View>
                            </View>
                        ) : (
                            <View style={styles.idleCard}>
                                <View style={styles.idleIconWrap}>
                                    <MaterialCommunityIcons name="water-outline" size={40} color={theme.roles.light.textTertiary} />
                                </View>
                                <Text style={styles.idleTitle}>{t('ponds.idleTitle')}</Text>
                                <Text style={styles.idleSubtitle}>{t('ponds.idleSubtitle')}</Text>
                                <TouchableOpacity style={styles.startBtn} onPress={() => navigation.navigate('CreateCycle', { pondId })} activeOpacity={0.8}>
                                    <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                                    <Text style={styles.startBtnText}>{t('ponds.startNewCycle')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {activeCycle && (
                            <View style={styles.actionsSection}>
                                <View style={styles.tabBar}>
                                    <SectionTab label={t('ponds.tabLogData')} active={activeTab === 'log'} onPress={() => setActiveTab('log')} />
                                    <SectionTab label={t('ponds.tabViewHistory')} active={activeTab === 'history'} onPress={() => setActiveTab('history')} />
                                </View>
                                <View style={styles.actionGrid}>
                                    {(showAllActions ? ACTION_CONFIG : coreActions).map((item) => (
                                        <ActionChip key={item.label} item={item} mode={activeTab} onPress={() => navigateAction(item)} />
                                    ))}
                                </View>
                                {moreCount > 0 && (
                                    <TouchableOpacity
                                        style={styles.moreToggle}
                                        onPress={() => setShowAllActions((v) => !v)}
                                        activeOpacity={0.7}
                                        accessibilityRole="button"
                                        accessibilityState={{ expanded: showAllActions }}
                                    >
                                        <Text style={styles.moreToggleText}>
                                            {showAllActions ? t('ponds.showLess') : t('ponds.showMore', { count: moreCount })}
                                        </Text>
                                        <MaterialCommunityIcons name={showAllActions ? 'chevron-up' : 'chevron-down'} size={18} color={theme.roles.light.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {activeCycle && perms.canViewFinancials && (
                            <View style={styles.econSection}>
                                <Text style={styles.econTitle}>{t('ponds.economicsTitle')}</Text>
                                <TouchableOpacity
                                    style={styles.econRow}
                                    onPress={() => navigation.navigate('Expenses', { cropId: activeCycle.id, pondName })}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons name="cash-multiple" size={20} color={theme.roles.light.successText} />
                                    <Text style={styles.econRowText}>{t('ponds.viewExpenses')}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.econRow, styles.econRowLast]}
                                    onPress={() => navigation.navigate('HarvestPlans', { pondId, pondName, cropId: activeCycle.id, farmId: pond?.farmId })}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons name="calendar-check" size={20} color={theme.roles.light.primary} />
                                    <Text style={styles.econRowText}>{t('ponds.harvestPlans')}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {isFeatureEnabled('pondDimensionHistory') && pond && (
                            <TouchableOpacity
                                style={styles.dimHistoryRow}
                                onPress={() => navigation.navigate('PondDimensionHistory', { pondId: pond.id, pondName })}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="history" size={20} color={theme.roles.light.textSecondary} />
                                <Text style={styles.dimHistoryText}>{t('ponds.dimHistory', 'Dimension history')}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />
                            </TouchableOpacity>
                        )}

                        {isFeatureEnabled('feedingTrayChecks') && activeCycle && (
                            <TouchableOpacity
                                style={styles.dimHistoryRow}
                                onPress={() => navigation.navigate('FeedingTrayChecks', { cropId: activeCycle.id, pondName })}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="basket-outline" size={20} color={theme.roles.light.textSecondary} />
                                <Text style={styles.dimHistoryText}>{t('logs.feedingTray_title', 'Feeding tray check')}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} />
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 32 }} />
                    </ScrollView>
                </Animated.View>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.roles.light.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.roles.light.borderDefault },
    iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.roles.light.textPrimary },
    scrollContent: { padding: 16, backgroundColor: theme.roles.light.background },
    heroCard: { backgroundColor: theme.roles.light.surface, borderRadius: 20, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
    heroTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.roles.light.surfaceVariant },
    heroInfo: { flex: 1 },
    heroLabel: { fontSize: 9, fontWeight: '700', color: theme.roles.light.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    heroName: { fontSize: 17, fontWeight: '700', color: theme.roles.light.textPrimary },
    heroDate: { fontSize: 12, color: theme.roles.light.textSecondary, marginTop: 2 },
    harvestBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.roles.light.successBorder, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    harvestBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    metricsRow: { flexDirection: 'row', alignItems: 'center' },
    metricDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: theme.roles.light.borderDefault },
    idleCard: { backgroundColor: theme.roles.light.surface, borderRadius: 20, marginBottom: 16, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    idleIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    idleTitle: { fontSize: 18, fontWeight: '700', color: theme.roles.light.textSecondary, marginBottom: 6 },
    idleSubtitle: { fontSize: 14, color: theme.roles.light.textTertiary, marginBottom: 24, textAlign: 'center' },
    startBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.roles.light.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
    startBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    actionsSection: { backgroundColor: theme.roles.light.surface, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, padding: 16 },
    tabBar: { flexDirection: 'row', backgroundColor: theme.roles.light.surfaceVariant, borderRadius: 12, padding: 4, marginBottom: 20 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: theme.spacing[2], paddingVertical: theme.spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.roles.light.surfaceVariant },
    moreToggleText: { fontSize: 13, fontWeight: '600', color: theme.roles.light.primary },
    econSection: { backgroundColor: theme.roles.light.surface, borderRadius: 20, overflow: 'hidden', marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, padding: 16 },
    econTitle: { fontSize: 13, fontWeight: '700', color: theme.roles.light.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
    econRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.roles.light.surfaceVariant },
    econRowLast: { borderBottomWidth: 0 },
    econRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.roles.light.textPrimary },
    dimHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: theme.roles.light.surface, borderRadius: 14, marginBottom: 12 },
    dimHistoryText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.roles.light.textPrimary },
    mb2: { marginBottom: theme.spacing[2] },
});