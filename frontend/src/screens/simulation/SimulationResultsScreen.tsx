/**
 * Simulation result — artboard p5.
 *
 * The old screen led with a bare "profit difference" number and then four
 * metric tiles. The design's insight is that a difference means nothing without
 * the thing it differs FROM, so this leads with the difference and then shows
 * the two profits side by side as bars: grey is what you make anyway, green is
 * what the change adds. That is the sentence the screen exists to say.
 *
 * The engine's risk warning is given its own block rather than a footnote. A
 * run that says "+₹5,300, unless FCR slips past 1.45" is a different answer
 * from "+₹5,300", and the caveat has to survive being skimmed.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { StatRow } from '../../components/ui/StatRow';
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';

const c = theme.roles.light;

const inr = (n: number): string => {
    const a = Math.abs(n);
    if (a >= 1e7) return `₹${(a / 1e7).toFixed(2)}Cr`;
    if (a >= 1e5) return `₹${(a / 1e5).toFixed(2)}L`;
    return `₹${Math.round(a).toLocaleString('en-IN')}`;
};

const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${inr(n)}`;

export const SimulationResultsScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { resultData, scenarioType, pondId } = route.params ?? {};

    if (!resultData) {
        return (
            <ScreenWrapper>
                <Text style={styles.noData}>{t('simulations.results.noData')}</Text>
            </ScreenWrapper>
        );
    }

    // A saved simulation and a fresh run have different shapes; read either.
    const r = resultData.result ?? {};
    const num = (fresh: any, saved: any): number => Number(fresh ?? saved ?? 0);

    const diff = num(r.profitDifference, resultData.resultProfitDiff);
    const baseline = num(r.baselineNetProfit, undefined);
    const simulated = num(r.simulatedNetProfit, resultData.resultNetProfit);
    const biomass = num(r.projectedBiomass, resultData.resultProjectedBiomass);
    const fcr = num(r.projectedFcr, resultData.resultProjectedFcr);
    const revenue = num(r.totalRevenue, resultData.resultTotalRevenue);
    const cost = num(r.totalCost, resultData.resultTotalCost);
    const risk: string | undefined = r.riskWarning;
    const type: string = scenarioType ?? resultData.scenarioType ?? resultData.simulation?.scenarioType;
    const gain = diff >= 0;

    // Bar widths are shares of the larger of the two, so the comparison is a
    // real one — scaling each to its own width would make them look equal.
    const largest = Math.max(Math.abs(baseline), Math.abs(simulated), 1);

    const runAt = resultData.simulation?.createdAt ?? resultData.createdAt;

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={type ? t(`simulations.q.${type}.title`, { defaultValue: type }) : null}
                title={t('simulations.results.shortTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={[styles.hero, !gain && styles.heroLoss]}>
                    <Text style={[styles.heroLabel, !gain && styles.heroLabelLoss]}>
                        {t('simulations.results.profitDifference')}
                    </Text>
                    <Text
                        style={[styles.heroValue, !gain && styles.heroValueLoss]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                    >
                        {signed(diff)}
                    </Text>
                    {!!type && (
                        <Text style={styles.heroDesc}>{t(`simulations.q.${type}.desc`, { defaultValue: '' })}</Text>
                    )}
                </View>

                <SectionHeader label={t('simulations.results.whatItPredicts')} />
                <StatRow
                    divider
                    stats={[
                        { value: Math.round(biomass).toLocaleString('en-IN'), label: t('simulations.results.labelProjectedBiomass') },
                        { value: fcr ? fcr.toFixed(2) : '—', label: t('simulations.results.labelProjectedFcr') },
                        { value: inr(revenue), label: t('simulations.results.labelTotalRevenue') },
                        { value: inr(cost), label: t('simulations.results.labelTotalCost') },
                    ]}
                />

                <SectionHeader label={t('simulations.results.againstDoingNothing')} />
                <View style={styles.compareRow}>
                    <Text style={styles.compareLabel}>{t('simulations.results.labelBaselineProfit')}</Text>
                    <Text style={styles.compareValue}>{inr(baseline)}</Text>
                </View>
                <View style={styles.compareRow}>
                    <Text style={[styles.compareLabel, styles.compareLabelStrong]}>
                        {t('simulations.results.labelSimulatedProfit')}
                    </Text>
                    <Text style={[styles.compareValue, { color: gain ? c.successText : c.dangerText }]}>
                        {inr(simulated)}
                    </Text>
                </View>

                <View style={styles.bars}>
                    <View style={[styles.bar, { width: `${(Math.abs(baseline) / largest) * 100}%`, backgroundColor: c.textDisabled }]} />
                    <View
                        style={[
                            styles.bar,
                            {
                                width: `${(Math.abs(simulated) / largest) * 100}%`,
                                backgroundColor: gain ? c.successText : c.dangerText,
                            },
                        ]}
                    />
                </View>
                <Text style={styles.barsNote}>
                    {gain ? t('simulations.results.barsNote') : t('simulations.results.barsNoteLoss')}
                </Text>

                {!!risk && (
                    <View style={styles.risk}>
                        <Text style={styles.riskLabel}>{t('simulations.results.labelRiskWarning')}</Text>
                        <Text style={styles.riskBody}>{risk}</Text>
                    </View>
                )}

                <SectionHeader
                    label={t('simulations.results.whatYouChanged')}
                    trailing={
                        runAt
                            ? t('simulations.results.runOn', {
                                  date: formatDate(runAt),
                              })
                            : undefined
                    }
                />
                <Changes data={resultData} />

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.keepBtn}
                        onPress={() => navigation.navigate('SimulationList')}
                        accessibilityRole="button"
                    >
                        <Text style={styles.keepLabel}>{t('simulations.results.keepPlan')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.againBtn}
                        onPress={() =>
                            navigation.replace('SimulationCreate', { pondId, scenarioType: type })
                        }
                        accessibilityRole="button"
                    >
                        <Text style={styles.againLabel}>{t('simulations.results.runAgain')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

/** The inputs this run actually used — only the ones that were set. */
const Changes: React.FC<{ data: any }> = ({ data }) => {
    const { t } = useTranslation();
    const sim = data.simulation ?? data;
    const rows: [string, string][] = [];
    if (sim.inputFeedPrice != null) rows.push([t('simulations.create.labelFeedPrice'), `₹${sim.inputFeedPrice}`]);
    if (sim.inputSellingPrice != null) rows.push([t('simulations.create.labelSellingPrice'), `₹${sim.inputSellingPrice}`]);
    if (sim.inputStockingDensity != null)
        rows.push([t('simulations.create.labelStockingDensity'), String(sim.inputStockingDensity)]);
    if (sim.inputGrowthRate != null)
        rows.push([t('simulations.create.labelGrowthImprovement'), `${sim.inputGrowthRate}%`]);

    if (!rows.length) return null;
    return (
        <>
            {rows.map(([label, value]) => (
                <View key={label} style={styles.compareRow}>
                    <Text style={styles.compareLabel}>{label}</Text>
                    <Text style={styles.compareValue}>{value}</Text>
                </View>
            ))}
        </>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },
    noData: { ...theme.typeScale.bodyLarge, color: c.textTertiary, textAlign: 'center' },

    hero: {
        backgroundColor: c.successBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[4],
    },
    heroLoss: { backgroundColor: c.dangerBg },
    heroLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.successText,
    },
    heroLabelLoss: { color: c.dangerText },
    heroValue: { fontFamily: 'DMMono-Medium', fontSize: 40, lineHeight: 48, color: c.successText },
    heroValueLoss: { color: c.dangerText },
    heroDesc: { ...theme.typeScale.bodyMedium, color: c.textSecondary, marginTop: theme.spacing[1] },

    compareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 44,
    },
    compareLabel: { ...theme.typeScale.bodyMedium, flex: 1, minWidth: 0, color: c.textSecondary },
    compareLabelStrong: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    compareValue: { fontFamily: 'DMMono-Medium', fontSize: 15, color: c.textPrimary },

    bars: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3], gap: 4 },
    bar: { height: 12, borderRadius: 2, minWidth: 4 },
    barsNote: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2],
    },

    risk: {
        backgroundColor: c.warningBg,
        borderLeftWidth: 3,
        borderLeftColor: c.warningBorder,
        marginTop: theme.spacing[4],
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    riskLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.warningText,
    },
    riskBody: { ...theme.typeScale.bodyMedium, color: c.warningText },

    actions: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[6],
    },
    keepBtn: {
        flex: 2,
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    keepLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
    againBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    againLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textSecondary },
});

export default SimulationResultsScreen;
