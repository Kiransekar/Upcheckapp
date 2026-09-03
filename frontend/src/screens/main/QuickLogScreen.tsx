/**
 * QuickLogScreen — the one-tap entry point to the daily logging loop, reached
 * from the center "+" tab button. Picks the farmer's pond (auto-selected when
 * there's only one) and routes straight to the common daily logs, so they never
 * have to drill Farms → Farm → Pond → Log to record a reading.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { pondsApi, type Pond } from '../../api/ponds';
import { farmsApi } from '../../api/farms';
import { pondLabel } from '../../utils/pondHealth';
import { requiresActiveCycle } from '../../features/cycleRequirement';

type Action = {
    route: string;
    labelKey: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    tint: string;
};

const ACTIONS: Action[] = [
    { route: 'WaterQualityLog', labelKey: 'ponds.actionWaterQuality', icon: 'water-percent', tint: '#2196F3' },
    { route: 'FeedLog', labelKey: 'ponds.actionFeed', icon: 'corn', tint: '#FF9800' },
    { route: 'DailyRoutine', labelKey: 'ponds.actionDailyRoutine', icon: 'clipboard-check-outline', tint: '#0B8457' },
    { route: 'SamplingLog', labelKey: 'ponds.actionSampling', icon: 'scale', tint: '#4CAF50' },
    { route: 'Measurements', labelKey: 'ponds.actionMeasurements', icon: 'chart-line', tint: theme.roles.light.primary },
    { route: 'PondDashboard', labelKey: 'home.quickLogOpenPond', icon: 'view-dashboard-outline', tint: '#7C4DFF' },
];

export const QuickLogScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [ponds, setPonds] = useState<Pond[]>([]);
    /** farmId → farm name, only fetched when the ponds span more than one farm. */
    const [farmNames, setFarmNames] = useState<Record<string, string>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    // A network failure must NOT masquerade as "no ponds — create a farm"; the
    // farmer likely already has ponds and only the request failed. Show retry.
    const [error, setError] = useState<any>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const { data } = await pondsApi.getMine();
            setPonds(data);
            setSelectedId((prev) => prev ?? data[0]?.id ?? null);
            // "Pond 1" is a fine chip label until the farmer works two farms
            // and has two of them. Name the farm under the chip, and only
            // then — a single-farm farmer does not need telling which farm.
            if (new Set(data.map((p) => p.farmId)).size > 1) {
                try {
                    const { data: farms } = await farmsApi.getAll();
                    setFarmNames(Object.fromEntries(farms.map((f) => [f.id, f.name])));
                } catch {
                    // A missing caption is not worth failing the screen over.
                }
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

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
                    <ErrorState error={error} onRetry={() => { setLoading(true); load(); }} />
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
                    {/* Pond picker — only when there's a choice to make. */}
                    {ponds.length > 1 && (
                        <>
                            <Text style={styles.pickLabel}>{t('home.quickLogPickPond')}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pondRow}>
                                {ponds.map((p) => {
                                    const active = p.id === selected?.id;
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.pondChip, active && styles.pondChipActive]}
                                            onPress={() => setSelectedId(p.id)}
                                            activeOpacity={0.8}
                                        >
                                            <MaterialCommunityIcons
                                                name="water"
                                                size={16}
                                                color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                            />
                                            <View style={{ flexShrink: 1 }}>
                                                <Text numberOfLines={1} style={[styles.pondChipText, active && { color: theme.roles.light.primary }]}>
                                                    {pondLabel(p)}
                                                </Text>
                                                {farmNames[p.farmId] ? (
                                                    <Text numberOfLines={1} style={styles.pondChipFarm}>
                                                        {farmNames[p.farmId]}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </>
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
    pickLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[2] },
    pondRow: { gap: theme.spacing[2], paddingBottom: theme.spacing[3] },
    pondChip: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1],
        paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.roles.light.borderDefault,
    },
    pondChipActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
    pondChipText: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, maxWidth: 140 },
    pondChipFarm: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary, maxWidth: 140 },
    forPond: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[3] },
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
