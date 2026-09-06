/**
 * QuickLogScreen — the one-tap entry point to the daily logging loop, reached
 * from the center "+" tab button. Picks the farmer's pond (auto-selected when
 * there's only one) and routes straight to the common daily logs, so they never
 * have to drill Farms → Farm → Pond → Log to record a reading.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PondPicker } from '../../components/ui/PondPicker';
import { theme } from '../../theme';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondLabel } from '../../utils/pondHealth';
import { requiresActiveCycle } from '../../features/cycleRequirement';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';

/** Stable empty fallback — a fresh `[]` each render would break the memos. */
const EMPTY_PONDS: Pond[] = [];

type Action = {
    route: string;
    labelKey: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    tint: string;
};

const ACTIONS: Action[] = [
    { route: 'WaterQualityLog', labelKey: 'ponds.actionWaterQuality', icon: 'water-percent', tint: '#2196F3' },
    { route: 'FeedLog', labelKey: 'ponds.actionFeed', icon: 'corn', tint: '#FF9800' },
    /**
     * Mortality on the fast path (L5 / D4).
     *
     * It was reachable only by drilling into the pond dashboard, yet it is a
     * daily observation for this persona AND the input to live population →
     * biomass → running FCR → feed advice. Leaving it off the fast path
     * silently degrades the whole engine chain: the app keeps advising on a
     * population it believes is still there.
     *
     * Crop-keyed (`mortality.crop_id` is NOT NULL), so `requiresActiveCycle`
     * already locks it and routes to CreateCycle. No new logic.
     */
    { route: 'MortalityLog', labelKey: 'ponds.actionMortality', icon: 'skull-outline', tint: '#B3261E' },
    { route: 'DailyRoutine', labelKey: 'ponds.actionDailyRoutine', icon: 'clipboard-check-outline', tint: '#0B8457' },
    { route: 'SamplingLog', labelKey: 'ponds.actionSampling', icon: 'scale', tint: '#4CAF50' },
    { route: 'Measurements', labelKey: 'ponds.actionMeasurements', icon: 'chart-line', tint: theme.roles.light.primary },
    { route: 'PondDashboard', labelKey: 'home.quickLogOpenPond', icon: 'view-dashboard-outline', tint: '#7C4DFF' },
];

export const QuickLogScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    /**
     * THE READ CACHE, which this screen was the only major one not to use.
     *
     * It held ponds in `useState` and called `pondsApi.getMine()` directly, so
     * offline at the pond the centre "+" button — the primary entrance to the
     * entire daily loop — hit `error && ponds.length === 0` and rendered a
     * retry screen. The farmer never reached a form, and `saveRecord` behind it
     * would have queued the reading perfectly: an offline-first write queue
     * behind an online-only door.
     *
     * `qk.ponds()` is already in PERSISTED_ROOTS and HomeScreen already warms
     * exactly this key, so the data is on disk and hot before the farmer ever
     * taps "+". The fix is to stop doing something, not to build anything.
     *
     * The three-way render below is unchanged and stays deliberate: "failed"
     * must never look like "loading" or like "no ponds". It simply never got a
     * chance to show cached data.
     */
    const pondsQuery = useAppQuery({
        queryKey: qk.ponds(),
        queryFn: async () => (await pondsApi.getMine()).data,
    });
    useRefetchOnFocus(qk.ponds());

    const ponds = pondsQuery.data ?? EMPTY_PONDS;
    const loading = pondsQuery.isPending && ponds.length === 0;
    const error = pondsQuery.isError ? pondsQuery.error : null;

    const selected = ponds.find((p) => p.id === selectedId) ?? ponds[0] ?? null;

    /**
     * A pond with no running cycle can still take a water-quality reading, but
     * not a feed or sampling log — those rows key off `crop_id`, and saving one
     * with no crop stores a record that every cycle figure then ignores. See
     * features/cycleRequirement.ts.
     */
    const hasCycle = !!selected?.activeCycleId;
    const blocked = (route: string) => !hasCycle && requiresActiveCycle(route);

    const go = (route: string) => {
        if (!selected || blocked(route)) return;
        navigation.navigate(route, {
            pondId: selected.id,
            pondName: pondLabel(selected),
            cropId: selected.activeCycleId ?? undefined,
        });
    };

    const startCycle = () => {
        if (!selected) return;
        navigation.navigate('CreateCycle', { pondId: selected.id });
    };

    return (
        <ScreenWrapper scroll={false}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t('home.quickLogTitle')}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{t('home.quickLogSubtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
                    <MaterialCommunityIcons name="close" size={26} color={theme.roles.light.textSecondary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.roles.light.primary} /></View>
            ) : error && ponds.length === 0 ? (
                <View style={styles.center}>
                    <ErrorState error={error} onRetry={() => pondsQuery.refetch()} />
                </View>
            ) : ponds.length === 0 ? (
                <View style={styles.center}>
                    <EmptyState
                        icon="barn"
                        title={t('home.quickLogNoPonds')}
                        subtitle={t('home.quickLogNoPondsSub')}
                    />
                    <Button
                        title={t('home.quickLogCreateFarm')}
                        onPress={() => navigation.navigate('CreateFarm')}
                        style={styles.createBtn}
                    />
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/*
                      * TWO INTENTS, said out loud (L3 / D5).
                      *
                      * This screen's model is "pick a pond → pick an action".
                      * The grid is "pick an action → all ponds". Those do not
                      * compose: if the water-quality tile fanned out across
                      * every pond, the picker above it would mean nothing for
                      * that tile while remaining necessary for feed, sampling
                      * and measurements — one tile silently behaving unlike its
                      * neighbours depending on how many ponds you own.
                      *
                      * So they are two sections. It also makes the grid
                      * discoverable instead of hidden behind a tile.
                      *
                      * With ONE pond the rounds section collapses to nothing
                      * useful, so it is not rendered at all and a single-pond
                      * farmer sees exactly the screen they saw before.
                      */}
                    {ponds.length > 1 && (
                        <>
                            <Text style={styles.sectionTitle}>{t('home.quickLogRoundsSection')}</Text>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('MorningRounds')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.quickLogRoundsTitle')}
                                testID="quicklog-morning-rounds"
                            >
                                <Card style={styles.roundsCard}>
                                    <View style={[styles.iconWrap, { backgroundColor: '#2196F31A' }]}>
                                        <MaterialCommunityIcons name="table-large" size={26} color="#2196F3" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.roundsTitle}>{t('home.quickLogRoundsTitle')}</Text>
                                        <Text style={styles.roundsSub}>
                                            {t('home.quickLogRoundsSub', { count: ponds.length })}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
                                </Card>
                            </TouchableOpacity>

                            <Text style={styles.sectionTitle}>{t('home.quickLogSingleSection')}</Text>
                        </>
                    )}

                    {/*
                        Pond picker — only when there's a choice to make. The
                        shared PondPicker carries the farm grouping and the
                        search field, so a farmer with three farms and thirty
                        ponds gets the same picker here as everywhere else
                        (spec §4.8). No context fetch: this screen only routes.
                    */}
                    {ponds.length > 1 && (
                        <PondPicker
                            pondId={selected?.id ?? null}
                            onChange={(id) => setSelectedId(id)}
                            fetchContext={false}
                        />
                    )}

                    {selected && (
                        <Text style={styles.forPond} numberOfLines={1}>
                            {t('home.quickLogForPond', { pond: pondLabel(selected) })}
                        </Text>
                    )}

                    {/*
                        No cycle running. Say so once, up front, and offer the
                        way out — rather than letting the farmer tap a tile and
                        get nothing, or worse, save a record that never counts.
                    */}
                    {selected && !hasCycle && (
                        <Card style={styles.noCycleCard}>
                            <View style={styles.noCycleHead}>
                                <MaterialCommunityIcons name="information-outline" size={20} color={theme.roles.light.primary} />
                                <Text style={styles.noCycleTitle}>{t('home.quickLogNoCycle')}</Text>
                            </View>
                            <Text style={styles.noCycleSub}>{t('home.quickLogNoCycleSub')}</Text>
                            <Button title={t('home.quickLogStartCycle')} onPress={startCycle} style={styles.noCycleBtn} />
                        </Card>
                    )}

                    <View style={styles.grid}>
                        {ACTIONS.map((a) => {
                            const isBlocked = blocked(a.route);
                            return (
                                <TouchableOpacity
                                    key={a.route}
                                    style={styles.tile}
                                    activeOpacity={0.85}
                                    onPress={() => (isBlocked ? startCycle() : go(a.route))}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        isBlocked
                                            ? `${t(a.labelKey)} — ${t('home.quickLogNeedsCycle')}. ${t('home.quickLogStartCycle')}`
                                            : t(a.labelKey)
                                    }
                                    /*
                                     * Deliberately NOT accessibilityState={{ disabled }}.
                                     * A locked tile still acts — it opens CreateCycle —
                                     * and announcing it as disabled would tell a screen
                                     * reader user not to try the one control that lifts
                                     * the lock. The label carries the state instead.
                                     */
                                >
                                    <Card style={[styles.tileCard, isBlocked && styles.tileCardBlocked]}>
                                        <View style={[styles.iconWrap, { backgroundColor: a.tint + '1A' }]}>
                                            <MaterialCommunityIcons
                                                name={isBlocked ? 'lock-outline' : a.icon}
                                                size={26}
                                                color={isBlocked ? theme.roles.light.textTertiary : a.tint}
                                            />
                                        </View>
                                        <Text style={[styles.tileLabel, isBlocked && styles.tileLabelBlocked]} numberOfLines={2}>
                                            {t(a.labelKey)}
                                        </Text>
                                        {/* Not colour alone — the reason is spelled out. */}
                                        {isBlocked && (
                                            <Text style={styles.tileBlockedHint} numberOfLines={2}>
                                                {t('home.quickLogNeedsCycle')}
                                            </Text>
                                        )}
                                    </Card>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    createBtn: { alignSelf: 'stretch', marginTop: theme.spacing[4] },
    forPond: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[3] },
    sectionTitle: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: theme.spacing[2],
        marginTop: theme.spacing[2],
    },
    roundsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    roundsTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    roundsSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
    tile: { width: '47%' },
    tileCard: { padding: theme.spacing[4], alignItems: 'center', gap: theme.spacing[2] },
    tileCardBlocked: { backgroundColor: theme.roles.light.surfaceOverlay },
    tileLabelBlocked: { color: theme.roles.light.textTertiary },
    tileBlockedHint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
    },
    noCycleCard: {
        padding: theme.spacing[4],
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4],
    },
    noCycleHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    noCycleTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary, flex: 1 },
    noCycleSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
    noCycleBtn: { alignSelf: 'flex-start', marginTop: theme.spacing[1] },
    iconWrap: { width: 48, height: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.textPrimary, textAlign: 'center' },
});

export default QuickLogScreen;
