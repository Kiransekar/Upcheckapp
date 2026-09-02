import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { calculatorsApi, ProductDosageResponse } from '../../api/calculators';
import { parseNumericInput } from '../../features/parseNumericInput';

export const ProductAmountScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    const [pondArea, setPondArea] = useState('');
    const [waterDepth, setWaterDepth] = useState('');
    const [targetPpm, setTargetPpm] = useState('');
    const [concentration, setConcentration] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ProductDosageResponse | null>(null);
    const [clientResult, setClientResult] = useState<number | null>(null);

    const handleCalculate = async () => {
        const area = parseNumericInput(pondArea);
        const depth = parseNumericInput(waterDepth);
        const ppm = parseNumericInput(targetPpm);
        const conc = concentration ? parseNumericInput(concentration) : 100;

        if (area === null || area <= 0) {
            Alert.alert(t('calculators.productDosage.validationTitle'), t('calculators.productDosage.errorArea'));
            return;
        }
        if (depth === null || depth <= 0) {
            Alert.alert(t('calculators.productDosage.validationTitle'), t('calculators.productDosage.errorDepth'));
            return;
        }
        if (ppm === null || ppm <= 0) {
            Alert.alert(t('calculators.productDosage.validationTitle'), t('calculators.productDosage.errorPpm'));
            return;
        }
        if (concentration && (conc === null || conc <= 0 || conc > 100)) {
            Alert.alert(t('calculators.productDosage.validationTitle'), t('calculators.productDosage.errorConc'));
            return;
        }

        const pondVolume = area * depth;

        setIsLoading(true);
        try {
            const { data } = await calculatorsApi.calculateProductDosage({
                pondArea: area,
                waterLevel: depth,
                dosage: ppm,
            });
            setResult(data);

            if (concentration && conc !== null && conc > 0) {
                // active ingredient (kg) = volume(m³) × ppm(g/m³) / 1000; a
                // product that is conc% active needs ÷(conc/100) more mass →
                // volume × ppm / (10 × conc). (Was ÷(conc×10000) = 1000× too
                // small, i.e. gross under-dosing.)
                const clientCalc = (pondVolume * ppm) / (conc * 10);
                setClientResult(Math.round(clientCalc * 1000) / 1000);
            } else {
                setClientResult(null);
            }
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.message || t('calculators.productDosage.errorCalc'));
        } finally {
            setIsLoading(false);
        }
    };

    const parsedArea = pondArea ? parseNumericInput(pondArea) : null;
    const parsedDepth = waterDepth ? parseNumericInput(waterDepth) : null;
    const pondVolume = parsedArea !== null && parsedDepth !== null
        ? parsedArea * parsedDepth
        : null;

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('calculators.productDosage.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('calculators.productDosage.sectionSettings')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.productDosage.labelPondArea')}
                                value={pondArea}
                                onChangeText={setPondArea}
                                keyboardType="decimal-pad"
                                placeholder="e.g. 5000"
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.productDosage.labelWaterDepth')}
                                value={waterDepth}
                                onChangeText={setWaterDepth}
                                keyboardType="decimal-pad"
                                placeholder="e.g. 1.2"
                                required
                            />
                        </View>
                    </View>
                    <Input
                        label={t('calculators.productDosage.labelTargetConc')}
                        value={targetPpm}
                        onChangeText={setTargetPpm}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 5.0"
                        required
                    />
                    <Input
                        label={t('calculators.productDosage.labelProductConc')}
                        value={concentration}
                        onChangeText={setConcentration}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 100 (default)"
                        hint={t('calculators.productDosage.hintProductConc')}
                    />

                    <Button title={t('calculators.productDosage.calculate')} onPress={handleCalculate} loading={isLoading} style={styles.calcBtn} />
                </Card>

                {pondVolume !== null && pondVolume > 0 && (
                    <Card variant="flat" style={styles.volumeCard}>
                        <Text style={styles.volumeLabel}>{t('calculators.productDosage.pondVolume')}</Text>
                        <Text style={styles.volumeValue}>{pondVolume.toFixed(0)} m³</Text>
                    </Card>
                )}

                {result && (
                    <View style={styles.resultBox}>
                        {/* The headline must be the mass the farmer weighs out. For a
                            sub-100% product that is the concentration-corrected figure,
                            not the pure-active-ingredient basis (QA BUG-003) - promoting
                            the latter under-doses a 50% product by half, and an
                            under-dosed treatment fails with no visible symptom. */}
                        <Text style={styles.resultLabel}>{t('calculators.productDosage.requiredAmount')}</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>
                            {(clientResult ?? result.amountKg).toFixed(clientResult !== null ? 3 : 2)}
                        </Text>
                        <Text style={styles.resultUnit}>kg</Text>

                        {clientResult !== null && (
                            <View style={styles.clientResultSection}>
                                <View style={styles.divider} />
                                <Text style={styles.clientLabel}>{t('calculators.productDosage.activeIngredientBasis')}</Text>
                                <Text style={styles.clientValue}>{result.amountKg.toFixed(2)} kg</Text>
                                <Text style={styles.clientFormula}>
                                    ({pondVolume?.toFixed(0)} m³ × {targetPpm} ppm) / (10 × {concentration || 100}%)
                                </Text>
                            </View>
                        )}
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
        marginTop: theme.spacing[4],
    },
    volumeCard: {
        marginBottom: theme.spacing[4],
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    volumeLabel: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    volumeValue: {
        ...theme.typeScale.h4,
        color: theme.roles.light.primary,
    },
    resultBox: {
        backgroundColor: theme.roles.light.infoBg,
        padding: theme.spacing[8],
        borderRadius: theme.radius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.roles.light.infoBorder,
        marginTop: theme.spacing[2],
    },
    resultLabel: {
        ...theme.typeScale.h4,
        color: theme.roles.light.infoBorder,
        marginBottom: theme.spacing[3],
    },
    resultValue: {
        fontSize: 48,
        fontWeight: '700',
        color: theme.roles.light.textPrimary,
    },
    resultUnit: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
    },
    clientResultSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: theme.spacing[3],
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: theme.roles.light.borderDefault,
        marginVertical: theme.spacing[3],
    },
    clientLabel: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
    },
    clientValue: {
        ...theme.typeScale.h4,
        color: theme.roles.light.primary,
        marginBottom: theme.spacing[2],
    },
    clientFormula: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
    },
});
