/**
 * Simulations — artboard p4.
 *
 * The old screen was a list of saved runs plus a "+" that opened a form asking
 * for a scenario enum and a pond UUID. The design's argument is that a farmer
 * does not arrive thinking "feed_change"; they arrive thinking "is cheaper feed
 * worth it?". So the questions come first, grouped by whether the cycle is
 * running, and the pond is chosen once at the top.
 *
 * DISCREPANCY, deliberate: the artboard lists seven questions. The simulation
 * engine supports three scenario types (feed_change, price_change,
 * stocking_density). The other four — harvest now vs wait, feed more vs less,
 * survival shock, power costs — have no engine behind them, so they are not
 * here. The design's shape is kept; the questions are worded to match what the
 * engine actually computes rather than promising four runs that cannot happen.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PondPicker } from '../../components/ui/PondPicker';
import { Icon } from '../../components/ui/Icon';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';
import { simulationsApi, type SavedSimulation, type SimulationScenarioType } from '../../api/simulations';

const c = theme.roles.light;

interface Question {
    scenario: SimulationScenarioType;
    /** Colour of the leading bar — matches the design's grouping. */
    accent: string;
    /** Before stocking, or during the cycle. */
    group: 'running' | 'planning';
}

const QUESTIONS: Question[] = [
    { scenario: 'feed_change', accent: c.primaryHover, group: 'running' },
    { scenario: 'price_change', accent: c.primaryHover, group: 'running' },
    { scenario: 'stocking_density', accent: c.successBorder, group: 'planning' },
];

const inr = (n: number): string => {
    const a = Math.abs(n);
    const sign = n < 0 ? '−' : '+';
    if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
    return `${sign}₹${Math.round(a)}`;
};

export const SimulationListScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const [pondId, setPondId] = useState<string | null>(route?.params?.pondId ?? null);
    const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    // A load failure must render error+retry, not the "create your first
    // simulation" empty state — the two are indistinguishable to the farmer.
    const [error, setError] = useState<any>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const { data } = await simulationsApi.getAll();
            setSimulations(data);
        } catch (err) {
            setError(err);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handlePond = useCallback((id: string) => setPondId(id), []);

    const ask = (question: Question) => {
        if (!pondId) {
            Alert.alert(t('simulations.list.pickPondTitle'), t('simulations.list.pickPondBody'));
            return;
        }
        navigation.navigate('SimulationCreate', { pondId, scenarioType: question.scenario });
    };

    const remove = (item: SavedSimulation) => {
        Alert.alert(t('simulations.list.deleteTitle'), t('simulations.list.deleteMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await simulationsApi.delete(item.id);
                        setSimulations((prev) => prev.filter((s) => s.id !== item.id));
                    } catch {
                        Alert.alert(t('common.error'), t('simulations.list.errorDelete'));
                    }
                },
            },
        ]);
    };

    const questionRows = (group: Question['group']) =>
        QUESTIONS.filter((q) => q.group === group).map((q) => (
            <TouchableOpacity
                key={q.scenario}
                style={styles.question}
                onPress={() => ask(q)}
                accessibilityRole="button"
            >
                <View style={[styles.accent, { backgroundColor: q.accent }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.questionTitle}>{t(`simulations.q.${q.scenario}.title`)}</Text>
                    <Text style={styles.questionDesc}>{t(`simulations.q.${q.scenario}.desc`)}</Text>
                </View>
                <Icon name="chevron_right" size={22} color={c.textDisabled} />
            </TouchableOpacity>
        ));

    const header = (
        <ScreenHeader
            eyebrow={t('simulations.list.eyebrow')}
            title={t('simulations.list.title')}
            onBack={() => navigation.goBack()}
            accessibilityBackLabel={t('common.back')}
        />
    );

    if (error && simulations.length === 0) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <ErrorState title={t('simulations.list.title')} error={error} onRetry={load} />
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
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                <Text style={styles.intro}>{t('simulations.list.intro')}</Text>

                <PondPicker pondId={pondId} onChange={handlePond} stockedOnly />

                <SectionHeader label={t('simulations.list.whileRunning')} />
                {questionRows('running')}

                <SectionHeader label={t('simulations.list.beforeStocking')} />
                {questionRows('planning')}

                <SectionHeader label={t('simulations.list.saved')} />
                {simulations.length === 0 ? (
                    <Text style={styles.empty}>{t('simulations.list.emptyDesc')}</Text>
                ) : (
                    simulations.map((sim) => {
                        const diff = sim.resultProfitDiff ?? 0;
                        return (
                            <TouchableOpacity
                                key={sim.id}
                                style={styles.saved}
                                onPress={() => navigation.navigate('SimulationResults', { resultData: sim })}
                                onLongPress={() => remove(sim)}
                                accessibilityRole="button"
                            >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.savedTitle} numberOfLines={1}>
                                        {t(`simulations.q.${sim.scenarioType}.title`, {
                                            defaultValue: sim.scenarioType.replace(/_/g, ' '),
                                        })}
                                    </Text>
                                    <Text style={styles.savedMeta} numberOfLines={1}>
                                        {formatDate(sim.createdAt)}
                                        {sim.resultProjectedBiomass != null
                                            ? ` · ${t('simulations.list.statBiomass', {
                                                  value: sim.resultProjectedBiomass.toFixed(0),
                                              })}`
                                            : ''}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text
                                        style={[
                                            styles.savedDiff,
                                            { color: diff >= 0 ? c.successText : c.dangerText },
                                        ]}
                                    >
                                        {inr(diff)}
                                    </Text>
                                    <Text style={styles.savedVs}>{t('simulations.results.vsBaseline')}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },
    intro: {
        ...theme.typeScale.bodyMedium,
        color: c.textSecondary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    question: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 56,
    },
    accent: { width: 4, alignSelf: 'stretch' },
    questionTitle: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    questionDesc: { ...theme.typeScale.bodySmall, color: c.textTertiary },

    saved: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    savedTitle: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    savedMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },
    savedDiff: { fontFamily: 'DMMono-Medium', fontSize: 15 },
    savedVs: { ...theme.typeScale.bodySmall, fontSize: 10, color: c.textDisabled },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
});

export default SimulationListScreen;
