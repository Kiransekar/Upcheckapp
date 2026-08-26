/**
 * Run a simulation — the form behind one question on p4.
 *
 * Two things the old screen did that the design specifically argues against:
 *
 *  - it asked the farmer to type a pond UUID. Nobody knows their pond's UUID.
 *    The pond now arrives from the question they tapped, and the picker is
 *    there to change it.
 *  - it showed all four variables for every scenario, so three of them were
 *    always irrelevant. Each question now shows only the number it is about,
 *    with the pond's current value as the starting point.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PondPicker } from '../../components/ui/PondPicker';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { simulationsApi, type SimulationScenarioType } from '../../api/simulations';
import type { PondContext } from '../../api/pondContext';

const c = theme.roles.light;

/** Which variable each question is actually about. */
const SCENARIO_FIELD: Record<SimulationScenarioType, 'feedPrice' | 'sellingPrice' | 'stockingDensity'> = {
    feed_change: 'feedPrice',
    price_change: 'sellingPrice',
    stocking_density: 'stockingDensity',
};

export const SimulationCreateScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const scenarioType: SimulationScenarioType = route?.params?.scenarioType ?? 'feed_change';
    const field = SCENARIO_FIELD[scenarioType];

    const [pondId, setPondId] = useState<string | null>(route?.params?.pondId ?? null);
    const [context, setContext] = useState<PondContext | null>(null);
    const [value, setValue] = useState('');
    const [growthImprovement, setGrowthImprovement] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handlePond = useCallback(
        (id: string, ctx: PondContext | null) => {
            setPondId(id);
            if (!ctx) return;
            setContext(ctx);
            // Start from what the pond is doing today, so the farmer edits a
            // real number rather than inventing one.
            if (field === 'feedPrice' && ctx.crop?.feedPriceRpPerKg != null) {
                setValue((v) => v || String(ctx.crop!.feedPriceRpPerKg));
            }
        },
        [field],
    );

    /** Today's value for the variable under test, for the "currently" line. */
    const currentValue =
        field === 'feedPrice' && context?.crop?.feedPriceRpPerKg != null
            ? `₹${context.crop.feedPriceRpPerKg}`
            : null;

    const run = async () => {
        if (!pondId) {
            Alert.alert(t('simulations.create.validationTitle'), t('simulations.create.errorPondId'));
            return;
        }
        const parsed = parseFloat(value);
        if (!parsed || parsed <= 0) {
            Alert.alert(t('simulations.create.validationTitle'), t(`simulations.q.${scenarioType}.errorValue`));
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await simulationsApi.run({
                pondId,
                scenarioType,
                variables: {
                    [field]: parsed,
                    ...(growthImprovement ? { growthImprovement: parseFloat(growthImprovement) } : {}),
                },
            });
            navigation.replace('SimulationResults', { resultData: data, scenarioType, pondId });
        } catch (error: any) {
            Alert.alert(
                t('simulations.create.simFailedTitle'),
                error.response?.data?.message || t('simulations.create.errorSimFailed'),
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('simulations.create.eyebrow')}
                title={t(`simulations.q.${scenarioType}.title`)}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.intro}>{t(`simulations.q.${scenarioType}.desc`)}</Text>

                <PondPicker pondId={pondId} onChange={handlePond} stockedOnly />

                <SectionHeader label={t('simulations.create.whatYouAreChanging')} />
                <View style={styles.form}>
                    <Input
                        label={t(`simulations.q.${scenarioType}.label`)}
                        value={value}
                        onChangeText={setValue}
                        keyboardType="decimal-pad"
                        required
                    />
                    {!!currentValue && (
                        <Text style={styles.current}>
                            {t('simulations.create.currently', { value: currentValue })}
                        </Text>
                    )}

                    {/* Growth only moves in the feed scenarios; asking about it
                        on a stocking-density run would be noise. */}
                    {scenarioType === 'feed_change' && (
                        <Input
                            label={t('simulations.create.labelGrowthImprovement')}
                            value={growthImprovement}
                            onChangeText={setGrowthImprovement}
                            keyboardType="decimal-pad"
                            placeholder="0"
                        />
                    )}

                    <TouchableOpacity
                        style={[styles.runBtn, isLoading && styles.runBusy]}
                        onPress={run}
                        disabled={isLoading}
                        accessibilityRole="button"
                    >
                        <Text style={styles.runLabel}>{t('simulations.create.runSimulation')}</Text>
                    </TouchableOpacity>
                </View>
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
    form: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[1] },
    current: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        marginTop: -theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    runBtn: {
        marginTop: theme.spacing[2],
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    runBusy: { opacity: 0.6 },
    runLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },
});

export default SimulationCreateScreen;
