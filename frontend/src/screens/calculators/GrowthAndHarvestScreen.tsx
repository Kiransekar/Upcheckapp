import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import {
    calculatorsApi,
    ExpectedHarvestResponse,
    GrowthProjectionResponse,
    BiomassResponse,
    RecommendedFeedingRateResponse,
} from '../../api/calculators';
import { parseNumericInput, MAX_STOCKING_COUNT } from '../../features/parseNumericInput';
import { apiErrorMessage } from '../../api/errors';

export const GrowthAndHarvestScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    // ── Expected Harvest ────────────────────────────────────
    const [ehStockingCount, setEhStockingCount] = useState('');
    const [ehSurvivalRate, setEhSurvivalRate] = useState('');
    const [ehTargetWeight, setEhTargetWeight] = useState('');
    const [ehLoading, setEhLoading] = useState(false);
    const [ehResult, setEhResult] = useState<ExpectedHarvestResponse | null>(null);

    // ── Growth Projection ───────────────────────────────────
    const [gpCurrentWeight, setGpCurrentWeight] = useState('');
    const [gpAdg, setGpAdg] = useState('');
    const [gpDays, setGpDays] = useState('');
    const [gpLoading, setGpLoading] = useState(false);
    const [gpResult, setGpResult] = useState<GrowthProjectionResponse | null>(null);

    // ── Biomass ─────────────────────────────────────────────
    const [bmStockCount, setBmStockCount] = useState('');
    const [bmAvgWeight, setBmAvgWeight] = useState('');
    const [bmLoading, setBmLoading] = useState(false);
    const [bmResult, setBmResult] = useState<BiomassResponse | null>(null);

    // ── Recommended Feeding Rate ─────────────────────────────
    const [rfrAvgWeight, setRfrAvgWeight] = useState('');
    const [rfrLoading, setRfrLoading] = useState(false);
    const [rfrResult, setRfrResult] = useState<RecommendedFeedingRateResponse | null>(null);

    // ── Handlers ────────────────────────────────────────────
    const handleExpectedHarvest = async () => {
        const stockingCount = parseNumericInput(ehStockingCount);
        const survivalRatePercent = parseNumericInput(ehSurvivalRate);
        const targetWeightG = parseNumericInput(ehTargetWeight);

        if (stockingCount === null || stockingCount <= 0 || stockingCount > MAX_STOCKING_COUNT) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorStockingCount'));
            return;
        }
        if (survivalRatePercent === null || survivalRatePercent <= 0 || survivalRatePercent > 100) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorSurvivalRate'));
            return;
        }
        if (targetWeightG === null || targetWeightG <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorTargetWeight'));
            return;
        }

        setEhLoading(true);
        try {
            const { data } = await calculatorsApi.calculateExpectedHarvest({
                stockingCount,
                survivalRatePercent,
                targetWeightG,
            });
            setEhResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('calculators.growthHarvest.errorCalc')));
        } finally {
            setEhLoading(false);
        }
    };

    const handleGrowthProjection = async () => {
        const currentWeightG = parseNumericInput(gpCurrentWeight);
        const adgG = parseNumericInput(gpAdg);
        const daysToProject = parseNumericInput(gpDays);

        if (currentWeightG === null || currentWeightG <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorCurrentWeight'));
            return;
        }
        if (adgG === null || adgG <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorAdg'));
            return;
        }
        if (daysToProject === null || daysToProject <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorDaysToProject'));
            return;
        }

        setGpLoading(true);
        try {
            const { data } = await calculatorsApi.calculateGrowthProjection({
                currentWeightG,
                adgG,
                daysToProject,
            });
            setGpResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('calculators.growthHarvest.errorCalc')));
        } finally {
            setGpLoading(false);
        }
    };

    const handleBiomass = async () => {
        const stockCount = parseNumericInput(bmStockCount);
        const averageWeightG = parseNumericInput(bmAvgWeight);

        if (stockCount === null || stockCount <= 0 || stockCount > MAX_STOCKING_COUNT) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorStockCount'));
            return;
        }
        if (averageWeightG === null || averageWeightG <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorAverageWeight'));
            return;
        }

        setBmLoading(true);
        try {
            const { data } = await calculatorsApi.calculateBiomass({ stockCount, averageWeightG });
            setBmResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('calculators.growthHarvest.errorCalc')));
        } finally {
            setBmLoading(false);
        }
    };

    const handleRecommendedFeedingRate = async () => {
        const averageWeightG = parseNumericInput(rfrAvgWeight);

        if (averageWeightG === null || averageWeightG <= 0) {
            Alert.alert(t('calculators.growthHarvest.validationTitle'), t('calculators.growthHarvest.errorAverageWeight'));
            return;
        }

        setRfrLoading(true);
        try {
            const { data } = await calculatorsApi.getRecommendedFeedingRate({ averageWeightG });
            setRfrResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('calculators.growthHarvest.errorCalc')));
        } finally {
            setRfrLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('calculators.growthHarvest.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* ── Expected Harvest ── */}
                <Card style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="basket-outline" size={20} color={theme.roles.light.primary} />
                        <Text style={styles.sectionTitle}>{t('calculators.growthHarvest.sectionExpectedHarvest')}</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelStockingCount')}
                                value={ehStockingCount}
                                onChangeText={setEhStockingCount}
                                keyboardType="number-pad"
                                placeholder={t('calculators.growthHarvest.phStockingCount')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelSurvivalRate')}
                                value={ehSurvivalRate}
                                onChangeText={setEhSurvivalRate}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.growthHarvest.phSurvivalRate')}
                                required
                            />
                        </View>
                    </View>
                    <Input
                        label={t('calculators.growthHarvest.labelTargetWeight')}
                        value={ehTargetWeight}
                        onChangeText={setEhTargetWeight}
                        keyboardType="decimal-pad"
                        placeholder={t('calculators.growthHarvest.phTargetWeight')}
                        required
                    />
                    <Button title={t('calculators.growthHarvest.calculate')} onPress={handleExpectedHarvest} loading={ehLoading} style={styles.calcBtn} />

                    {ehResult && (
                        <View style={styles.resultBox}>
                            <View style={styles.resultRow}>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultLabel}>{t('calculators.growthHarvest.resultExpectedCount')}</Text>
                                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{ehResult.expectedCount.toLocaleString()}</Text>
                                    <Text style={styles.resultUnit}>{t('calculators.growthHarvest.unitShrimp')}</Text>
                                </View>
                                <View style={styles.resultDivider} />
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultLabel}>{t('calculators.growthHarvest.resultExpectedWeight')}</Text>
                                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{ehResult.expectedWeightKg.toFixed(2)}</Text>
                                    <Text style={styles.resultUnit}>{t('calculators.growthHarvest.unitKg')}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </Card>

                {/* ── Growth Projection ── */}
                <Card style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="trending-up" size={20} color={theme.roles.light.successText} />
                        <Text style={styles.sectionTitle}>{t('calculators.growthHarvest.sectionGrowthProjection')}</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelCurrentWeight')}
                                value={gpCurrentWeight}
                                onChangeText={setGpCurrentWeight}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.growthHarvest.phCurrentWeight')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelAdg')}
                                value={gpAdg}
                                onChangeText={setGpAdg}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.growthHarvest.phAdg')}
                                required
                            />
                        </View>
                    </View>
                    <Input
                        label={t('calculators.growthHarvest.labelDaysToProject')}
                        value={gpDays}
                        onChangeText={setGpDays}
                        keyboardType="number-pad"
                        placeholder={t('calculators.growthHarvest.phDaysToProject')}
                        required
                    />
                    <Button title={t('calculators.growthHarvest.calculate')} onPress={handleGrowthProjection} loading={gpLoading} style={styles.calcBtn} />

                    {gpResult && (
                        <View style={styles.resultBox}>
                            <Text style={styles.resultLabel}>{t('calculators.growthHarvest.resultProjectedWeight')}</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{gpResult.projectedWeightG.toFixed(2)}</Text>
                            <Text style={styles.resultUnit}>{t('calculators.growthHarvest.unitG')}</Text>
                            {gpResult.projectedWeightByWeek.length > 0 && (
                                <View style={styles.weekTable}>
                                    <Text style={styles.weekTableTitle}>{t('calculators.growthHarvest.weeklyBreakdown')}</Text>
                                    {gpResult.projectedWeightByWeek.map((w, i) => (
                                        <View key={i} style={[styles.weekRow, i % 2 === 0 && styles.weekRowEven]}>
                                            <Text style={styles.weekCell}>{t('calculators.growthHarvest.weekLabel', { num: i + 1 })}</Text>
                                            <Text style={styles.weekCellRight}>{w.toFixed(2)} {t('calculators.growthHarvest.unitG')}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </Card>

                {/* ── Biomass ── */}
                <Card style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="weight-kilogram" size={20} color={theme.roles.light.warningText} />
                        <Text style={styles.sectionTitle}>{t('calculators.growthHarvest.sectionBiomass')}</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelStockCount')}
                                value={bmStockCount}
                                onChangeText={setBmStockCount}
                                keyboardType="number-pad"
                                placeholder={t('calculators.growthHarvest.phStockCount')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.growthHarvest.labelAverageWeight')}
                                value={bmAvgWeight}
                                onChangeText={setBmAvgWeight}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.growthHarvest.phAverageWeight')}
                                required
                            />
                        </View>
                    </View>
                    <Button title={t('calculators.growthHarvest.calculate')} onPress={handleBiomass} loading={bmLoading} style={styles.calcBtn} />

                    {bmResult && (
                        <View style={styles.resultBox}>
                            <Text style={styles.resultLabel}>{t('calculators.growthHarvest.resultTotalBiomass')}</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{bmResult.biomassKg.toFixed(2)}</Text>
                            <Text style={styles.resultUnit}>{t('calculators.growthHarvest.unitKg')}</Text>
                        </View>
                    )}
                </Card>

                {/* ── Recommended Feeding Rate ── */}
                <Card style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="corn" size={20} color={theme.roles.light.infoBorder} />
                        <Text style={styles.sectionTitle}>{t('calculators.growthHarvest.sectionRecommendedFeedingRate')}</Text>
                    </View>
                    <Input
                        label={t('calculators.growthHarvest.labelAverageWeight')}
                        value={rfrAvgWeight}
                        onChangeText={setRfrAvgWeight}
                        keyboardType="decimal-pad"
                        placeholder={t('calculators.growthHarvest.phAverageWeightRfr')}
                        required
                    />
                    <Button title={t('calculators.growthHarvest.getRate')} onPress={handleRecommendedFeedingRate} loading={rfrLoading} style={styles.calcBtn} />

                    {rfrResult && (
                        <View style={styles.resultBox}>
                            <Text style={styles.resultLabel}>{t('calculators.growthHarvest.resultRecommendedRate')}</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{rfrResult.recommendedFeedingRatePercent}</Text>
                            <Text style={styles.resultUnit}>{t('calculators.growthHarvest.unitBodyWeight')}</Text>
                        </View>
                    )}
                </Card>

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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    calcBtn: {
        marginTop: theme.spacing[4],
    },
    resultBox: {
        backgroundColor: theme.roles.light.infoBg,
        padding: theme.spacing[6],
        borderRadius: theme.radius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.roles.light.infoBorder,
        marginTop: theme.spacing[4],
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    resultItem: {
        flex: 1,
        alignItems: 'center',
    },
    resultDivider: {
        width: 1,
        height: 60,
        backgroundColor: theme.roles.light.borderDefault,
    },
    resultLabel: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
        textAlign: 'center',
    },
    resultValue: {
        fontSize: 32,
        fontWeight: '700',
        color: theme.roles.light.textPrimary,
    },
    resultUnit: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[1],
    },
    weekTable: {
        width: '100%',
        marginTop: theme.spacing[4],
    },
    weekTableTitle: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
        textAlign: 'center',
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[2],
    },
    weekRowEven: {
        backgroundColor: theme.roles.light.background,
        borderRadius: theme.radius.sm,
    },
    weekCell: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    weekCellRight: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
});
