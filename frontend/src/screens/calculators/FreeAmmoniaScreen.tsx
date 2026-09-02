import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { calculatorsApi, FreeAmmoniaResponse } from '../../api/calculators';
import { parseNumericInput, parseNumericInputOrDefault } from '../../features/parseNumericInput';

type ToxicityLevel = 'safe' | 'warning' | 'critical';

const getToxicityLevel = (nh3: number): ToxicityLevel => {
    if (nh3 > 0.5) return 'critical';
    if (nh3 >= 0.1) return 'warning';
    return 'safe';
};

export const FreeAmmoniaScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    const TOXICITY_CONFIG: Record<ToxicityLevel, {
        label: string;
        icon: keyof typeof MaterialCommunityIcons.glyphMap;
        bgColor: string;
        borderColor: string;
        textColor: string;
        message: string;
    }> = {
        safe: {
            label: t('calculators.freeAmmonia.safeLabel'),
            icon: 'check-circle',
            bgColor: theme.roles.light.successBg,
            borderColor: theme.roles.light.successBorder,
            textColor: theme.roles.light.successText,
            message: t('calculators.freeAmmonia.safeMessage'),
        },
        warning: {
            label: t('calculators.freeAmmonia.warningLabel'),
            icon: 'alert-circle',
            bgColor: theme.roles.light.warningBg,
            borderColor: theme.roles.light.warningBorder,
            textColor: theme.roles.light.warningText,
            message: t('calculators.freeAmmonia.warningMessage'),
        },
        critical: {
            label: t('calculators.freeAmmonia.criticalLabel'),
            icon: 'alert-decagram',
            bgColor: theme.roles.light.dangerBg,
            borderColor: theme.roles.light.dangerBorder,
            textColor: theme.roles.light.dangerText,
            message: t('calculators.freeAmmonia.criticalMessage'),
        },
    };

    const [tan, setTan] = useState('');
    const [ph, setPh] = useState('');
    const [temperature, setTemperature] = useState('');
    // Not pre-filled: salinity is a real term in the pKa model (QA BUG-002), and
    // a brackish default silently biases a freshwater pond's reading LOW - i.e.
    // toward "safe" - on a toxicity screen. Blank submits 0 via
    // `parseFloat(salinity) || 0` below, which is the freshwater Emerson form,
    // and the hint now says so.
    const [salinity, setSalinity] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<FreeAmmoniaResponse | null>(null);

    const handleCalculate = async () => {
        const tanVal = parseNumericInput(tan);
        const phVal = parseNumericInput(ph);
        const tempVal = parseNumericInput(temperature);

        if (tanVal === null || tanVal <= 0) {
            Alert.alert(t('calculators.freeAmmonia.validationTitle'), t('calculators.freeAmmonia.errorTan'));
            return;
        }
        if (phVal === null || phVal <= 0 || phVal > 14) {
            Alert.alert(t('calculators.freeAmmonia.validationTitle'), t('calculators.freeAmmonia.errorPh'));
            return;
        }
        if (tempVal === null || tempVal <= 0) {
            Alert.alert(t('calculators.freeAmmonia.validationTitle'), t('calculators.freeAmmonia.errorTemp'));
            return;
        }
        // Blank salinity is deliberate freshwater shorthand for 0 (QA BUG-002)
        // and must keep submitting silently. Anything else that isn't a valid
        // number used to fall through `parseFloat(salinity) || 0` with no
        // alert, while every sibling field here raises one — that silent
        // fallback maximises computed NH₃ (over-warns) instead of catching the
        // typo.
        const salinityVal = parseNumericInputOrDefault(salinity, 0);
        if (salinityVal === null) {
            Alert.alert(t('calculators.freeAmmonia.validationTitle'), t('calculators.freeAmmonia.errorSalinity'));
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await calculatorsApi.calculateFreeAmmonia({
                tan: tanVal,
                ph: phVal,
                temperature: tempVal,
                salinity: salinityVal,
            });
            setResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.message || t('calculators.freeAmmonia.errorCalc'));
        } finally {
            setIsLoading(false);
        }
    };

    // Use the backend's authoritative toxicityLevel when present; fall back to the
    // client-side derivation only if the field is missing (e.g. older server).
    const backendLevel =
        result?.toxicityLevel &&
        Object.prototype.hasOwnProperty.call(TOXICITY_CONFIG, result.toxicityLevel)
            ? (result.toxicityLevel as ToxicityLevel)
            : null;
    const level = result
        ? (backendLevel ?? getToxicityLevel(result.unionizedAmmonia))
        : null;
    const isBackendClassification = result !== null && backendLevel !== null;
    const config = level ? TOXICITY_CONFIG[level] : null;

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('calculators.freeAmmonia.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('calculators.freeAmmonia.sectionWater')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.freeAmmonia.labelTan')}
                                value={tan}
                                onChangeText={setTan}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.freeAmmonia.phTan')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.freeAmmonia.labelPh')}
                                value={ph}
                                onChangeText={setPh}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.freeAmmonia.phPh')}
                                required
                            />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.freeAmmonia.labelTemp')}
                                value={temperature}
                                onChangeText={setTemperature}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.freeAmmonia.phTemp')}
                                required
                            />
                        </View>
                        <View style={styles.halfCol}>
                            <Input
                                label={t('calculators.freeAmmonia.labelSalinity')}
                                value={salinity}
                                onChangeText={setSalinity}
                                keyboardType="decimal-pad"
                                placeholder={t('calculators.freeAmmonia.phSalinity')}
                                hint={t('calculators.freeAmmonia.hintSalinity')}
                            />
                        </View>
                    </View>

                    <Button title={t('calculators.freeAmmonia.calculateBtn')} onPress={handleCalculate} loading={isLoading} style={styles.calcBtn} />
                </Card>

                {result && config && (
                    <View style={[styles.resultBox, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
                        <MaterialCommunityIcons
                            name={config.icon}
                            size={48}
                            color={config.textColor}
                            style={styles.resultIcon}
                        />
                        <View style={[styles.levelBadge, { backgroundColor: config.borderColor }]}>
                            <Text style={styles.levelBadgeText}>
                                {config.label}{isBackendClassification ? t('calculators.freeAmmonia.serverSuffix') : ''}
                            </Text>
                        </View>
                        <Text style={[styles.resultLabel, { color: config.textColor }]}>
                            {t('calculators.freeAmmonia.resultLabel')}
                        </Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{result.unionizedAmmonia.toFixed(4)}</Text>
                        <Text style={styles.resultUnit}>{t('calculators.freeAmmonia.unitPpmMgL')}</Text>

                        <Text style={[styles.messageText, { color: config.textColor }]}>
                            {config.message}
                        </Text>
                    </View>
                )}

                <Card style={styles.scaleCard}>
                    <Text style={styles.scaleTitle}>{t('calculators.freeAmmonia.toxicityTitle')}</Text>
                    <View style={styles.scaleRow}>
                        <View style={[styles.scaleBlock, { backgroundColor: theme.roles.light.successBg, borderColor: theme.roles.light.successBorder }]}>
                            <Text style={[styles.scaleLabel, { color: theme.roles.light.successText }]}>{t('calculators.freeAmmonia.scaleSafe')}</Text>
                            <Text style={styles.scaleRange}>{t('calculators.freeAmmonia.rangeSafe')}</Text>
                        </View>
                        <View style={[styles.scaleBlock, { backgroundColor: theme.roles.light.warningBg, borderColor: theme.roles.light.warningBorder }]}>
                            <Text style={[styles.scaleLabel, { color: theme.roles.light.warningText }]}>{t('calculators.freeAmmonia.scaleWarning')}</Text>
                            <Text style={styles.scaleRange}>{t('calculators.freeAmmonia.rangeWarning')}</Text>
                        </View>
                        <View style={[styles.scaleBlock, { backgroundColor: theme.roles.light.dangerBg, borderColor: theme.roles.light.dangerBorder }]}>
                            <Text style={[styles.scaleLabel, { color: theme.roles.light.dangerText }]}>{t('calculators.freeAmmonia.scaleCritical')}</Text>
                            <Text style={styles.scaleRange}>{t('calculators.freeAmmonia.rangeCritical')}</Text>
                        </View>
                    </View>
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
    resultBox: {
        padding: theme.spacing[8],
        borderRadius: theme.radius.md,
        alignItems: 'center',
        borderWidth: 2,
        marginTop: theme.spacing[2],
        marginBottom: theme.spacing[6],
    },
    resultIcon: {
        marginBottom: theme.spacing[3],
    },
    levelBadge: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.full,
        marginBottom: theme.spacing[3],
    },
    levelBadgeText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textInverse,
        fontWeight: '700',
    },
    resultLabel: {
        ...theme.typeScale.h4,
        marginBottom: theme.spacing[2],
    },
    resultValue: {
        fontSize: 40,
        fontWeight: '700',
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[1],
    },
    resultUnit: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[4],
    },
    messageText: {
        ...theme.typeScale.bodyMedium,
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 20,
    },
    scaleCard: {
        marginBottom: theme.spacing[6],
    },
    scaleTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    scaleRow: {
        flexDirection: 'row',
        gap: theme.spacing[3],
    },
    scaleBlock: {
        flex: 1,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        alignItems: 'center',
    },
    scaleLabel: {
        ...theme.typeScale.labelMedium,
        fontWeight: '700',
        marginBottom: theme.spacing[1],
    },
    scaleRange: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
    },
});
