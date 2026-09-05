import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { theme } from '../../theme';
import {
    calculatorsApi,
    FcrResponse,
    AdgResponse,
    SurvivalRateResponse,
} from '../../api/calculators';
import { parseNumericInput, MAX_STOCKING_COUNT } from '../../features/parseNumericInput';
import { apiErrorMessage } from '../../api/errors';

interface PerformanceResults {
    fcr: number | null;
    adg: number | null;
    sr: number | null;
    productivity: number | null;
}

export const CultivationPerformanceScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    const [totalSeed, setTotalSeed] = useState('');
    const [totalHarvestKg, setTotalHarvestKg] = useState('');
    const [totalFeedKg, setTotalFeedKg] = useState('');
    const [daysOfCulture, setDaysOfCulture] = useState('');
    const [finalMbwG, setFinalMbwG] = useState('');
    const [finalSrPct, setFinalSrPct] = useState('');
    const [areaM2, setAreaM2] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<PerformanceResults | null>(null);

    const handleCalculate = async () => {
        const seed = parseNumericInput(totalSeed);
        const harvestKg = parseNumericInput(totalHarvestKg);
        const feedKg = parseNumericInput(totalFeedKg);
        const days = parseNumericInput(daysOfCulture);
        const mbw = parseNumericInput(finalMbwG);
        const sr = parseNumericInput(finalSrPct);
        const area = areaM2 ? parseNumericInput(areaM2) : 0;

        if (seed === null || seed <= 0 || seed > MAX_STOCKING_COUNT) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorSeed'));
            return;
        }
        if (harvestKg === null || harvestKg <= 0) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorHarvest'));
            return;
        }
        if (feedKg === null || feedKg <= 0) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorFeed'));
            return;
        }
        if (days === null || days <= 0) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorDays'));
            return;
        }
        if (mbw === null || mbw <= 0) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorMbw'));
            return;
        }
        if (sr === null || sr <= 0 || sr > 100) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorSr'));
            return;
        }
        // 'abc' used to parse to NaN, pass this guard, and then silently delete
        // the Productivity metric the farmer asked for (QA BUG-009). null is the
        // parser's "not a number", and it must be rejected explicitly — `!area`
        // would also reject a legitimate 0.
        if (areaM2 && (area === null || area <= 0)) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorArea'));
            return;
        }

        setIsLoading(true);
        try {
            const harvestedCount = Math.round(seed * sr / 100);

            const [fcrRes, adgRes, srRes] = await Promise.all([
                calculatorsApi.calculateFcr({
                    totalFeedKg: feedKg,
                    harvestWeightKg: harvestKg,
                }),
                calculatorsApi.calculateAdg({
                    initialWeightG: 0,
                    finalWeightG: mbw,
                    daysOfCulture: days,
                }),
                calculatorsApi.calculateSurvivalRate({
                    initialStock: seed,
                    harvestedCount,
                }),
            ]);

            const productivity = area !== null && area > 0 ? harvestKg / area : null;

            setResults({
                fcr: fcrRes.data.fcr,
                adg: adgRes.data.adgG,
                sr: srRes.data.survivalRatePercent,
                productivity,
            });
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('calculators.performance.errorCalc')));
        } finally {
            setIsLoading(false);
        }
    };

    const clearForm = () => {
        setTotalSeed('');
        setTotalHarvestKg('');
        setTotalFeedKg('');
        setDaysOfCulture('');
        setFinalMbwG('');
        setFinalSrPct('');
        setAreaM2('');
        setResults(null);
    };

    const fcrStatus = (v: number): 'safe' | 'warning' | 'critical' => {
        if (v <= 1.5) return 'safe';
        if (v <= 2.0) return 'warning';
        return 'critical';
    };

    const srStatus = (v: number): 'safe' | 'warning' | 'critical' => {
        if (v >= 70) return 'safe';
        if (v >= 50) return 'warning';
        return 'critical';
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('calculators.performance.title')}</Text>
                <TouchableOpacity onPress={clearForm} style={styles.backBtn}>
                    <Text style={styles.clearText}>{t('calculators.performance.clear')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('calculators.performance.sectionInput')}</Text>
                    <Input
                        label={t('calculators.performance.labelTotalSeed')}
                        value={totalSeed}
                        onChangeText={setTotalSeed}
                        keyboardType="number-pad"
                        placeholder={t('calculators.performance.phTotalSeed')}
                        required
                    />
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelTotalHarvested')}
                                value={totalHarvestKg}
                                onChangeText={setTotalHarvestKg}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.performance.phDecimal')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelTotalFeed')}
                                value={totalFeedKg}
                                onChangeText={setTotalFeedKg}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.performance.phDecimal')}
                                required
                            />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelDaysOfCulture')}
                                value={daysOfCulture}
                                onChangeText={setDaysOfCulture}
                                keyboardType="number-pad"
                                placeholder={t('calculators.performance.phDaysOfCulture')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelFinalMbw')}
                                value={finalMbwG}
                                onChangeText={setFinalMbwG}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.performance.phFinalMbw')}
                                required
                            />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelFinalSr')}
                                value={finalSrPct}
                                onChangeText={setFinalSrPct}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.performance.phFinalSr')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.performance.labelPondArea')}
                                value={areaM2}
                                onChangeText={setAreaM2}
                                keyboardType="decimal-pad"
                                placeholder={t('common.optional')}
                            />
                        </View>
                    </View>

                    <Button title={t('calculators.performance.calculate')} onPress={handleCalculate} loading={isLoading} style={styles.calcBtn} />
                </Card>

                {results && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.sectionTitle}>{t('calculators.performance.sectionResults')}</Text>
                        <View style={styles.metricsGrid}>
                            <MetricCard
                                label={t('calculators.performance.resultFcr')}
                                value={results.fcr !== null ? results.fcr.toFixed(2) : 'N/A'}
                                unit="ratio"
                                status={results.fcr !== null ? fcrStatus(results.fcr) : 'normal'}
                            />
                            <MetricCard
                                label={t('calculators.performance.resultAdg')}
                                value={results.adg !== null ? results.adg.toFixed(3) : 'N/A'}
                                unit="g/day"
                            />
                            <MetricCard
                                label={t('calculators.performance.resultSurvivalRate')}
                                value={results.sr !== null ? `${results.sr.toFixed(1)}%` : 'N/A'}
                                status={results.sr !== null ? srStatus(results.sr) : 'normal'}
                            />
                            {results.productivity !== null && (
                                <MetricCard
                                    label={t('calculators.performance.resultProductivity')}
                                    value={results.productivity.toFixed(2)}
                                    unit="kg/m²"
                                />
                            )}
                        </View>
                    </View>
                )}
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
        backgroundColor: theme.roles.light.surface,
        paddingHorizontal: theme.spacing[4],
    },
    backBtn: {
        padding: theme.spacing[4],
    },
    clearText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
    },
    title: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
    },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    card: {
        marginBottom: theme.spacing[6],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    calcBtn: {
        marginTop: theme.spacing[3],
    },
    resultsContainer: {
        marginTop: theme.spacing[4],
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[3],
    },
});
