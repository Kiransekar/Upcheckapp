/**
 * Daily feed — artboard p3.
 *
 * The design's point is the split between two kinds of input:
 *
 *   FROM THE POND   MBW, survival, count — the app already knows these, so it
 *                   fills them in and marks where they came from.
 *   WHAT YOU ARE    feeding rate, and the area if it differs. Typed by you,
 *   TESTING         and visibly the only thing you had to type.
 *
 * Both remain editable. A farmer who sampled this morning and has not logged it
 * yet must be able to overwrite MBW — prefilled is a starting point, not a
 * lock.
 *
 * The result then offers to LOG the feed it just computed, which is the whole
 * reason to calculate it. Previously the number was a dead end you had to
 * re-enter by hand on the feed log.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PondPicker } from '../../components/ui/PondPicker';
import { StatRow } from '../../components/ui/StatRow';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { calculatorsApi, type DailyFeedResponse } from '../../api/calculators';
import type { PondContext } from '../../api/pondContext';
import { survivalPctFrom, didPrefillAnything } from './prefill';
import { parseNumericInput } from '../../features/parseNumericInput';

const c = theme.roles.light;

/** Meals a day the result is divided into — the app's standing assumption. */
const MEALS_PER_DAY = 4;

const FEEDING_RATE_TABLE = [
    { sizeRange: '< 3 g', rate: '8–10%' },
    { sizeRange: '3–5 g', rate: '6–8%' },
    { sizeRange: '5–10 g', rate: '4–6%' },
    { sizeRange: '10–15 g', rate: '3–4%' },
    { sizeRange: '15–20 g', rate: '2.5–3%' },
    { sizeRange: '> 20 g', rate: '2–2.5%' },
];

/**
 * A pond holding more than 100 million post-larvae does not exist. Without a
 * ceiling the screen rendered 4.8e16 kg of feed per day with the confidence of
 * a real answer, and the biomass stat clipped silently past
 * Number.MAX_SAFE_INTEGER (QA BUG-011).
 */
const MAX_STOCKING_COUNT = 100_000_000;

export const DailyFeedCalculatorScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();

    const [pondId, setPondId] = useState<string | null>(route?.params?.pondId ?? null);
    const [pondName, setPondName] = useState<string | null>(route?.params?.pondName ?? null);
    const [doc, setDoc] = useState<number | null>(null);
    /** Which fields the pond filled in — drives the "from the pond" labelling. */
    const [prefilled, setPrefilled] = useState(false);

    const [mbwG, setMbwG] = useState('');
    const [srPct, setSrPct] = useState('');
    const [initialCount, setInitialCount] = useState('');
    const [feedingRatePct, setFeedingRatePct] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<DailyFeedResponse | null>(null);
    const [biomassKg, setBiomassKg] = useState<number | null>(null);

    /**
     * Fill from the pond's snapshot. Only empty fields are written, so a value
     * the farmer has already typed is never overwritten by a slower response.
     */
    const applyContext = useCallback((id: string, ctx: PondContext | null) => {
        setPondId(id);
        if (!ctx) return;
        setDoc(ctx.doc ?? null);
        // Only claim the form was filled from the pond when the pond could fill
        // the REQUIRED field (QA BUG-018).
        setPrefilled(didPrefillAnything(ctx));
        if (ctx.abwG != null) setMbwG((v) => v || String(ctx.abwG));
        if (ctx.crop?.stockingCount != null) {
            setInitialCount((v) => v || String(ctx.crop!.stockingCount));
            // Null until a sampling backs it — never the fabricated 100%
            // (QA BUG-019).
            const sr = survivalPctFrom(ctx);
            if (sr != null) setSrPct((v) => v || String(sr));
        }
    }, []);

    // Clear a stale result when any input changes — a number sitting under
    // edited inputs claims to be an answer to a question nobody asked.
    useEffect(() => {
        setResult(null);
        setBiomassKg(null);
    }, [mbwG, srPct, initialCount, feedingRatePct]);

    const handleCalculate = async () => {
        const mbw = parseNumericInput(mbwG);
        const sr = parseNumericInput(srPct);
        const count = parseNumericInput(initialCount);
        const fr = parseNumericInput(feedingRatePct);

        if (mbw === null || mbw <= 0) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorMbw'));
            return;
        }
        if (sr === null || sr <= 0 || sr > 100) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorSr'));
            return;
        }
        if (count === null || count <= 0 || count > MAX_STOCKING_COUNT) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorCount'));
            return;
        }
        // Mirror the server's @Max(100) (calculation.dto.ts:45) so an
        // out-of-range rate fails with the same field-named message every other
        // input gives, instead of a wasted round-trip and a generic error
        // (QA BUG-010).
        if (fr === null || fr <= 0 || fr > 100) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorFeedingRate'));
            return;
        }

        const computedBiomass = ((count * sr) / 100) * mbw / 1000;
        if (computedBiomass <= 0) {
            Alert.alert(t('common.error'), t('calculators.dailyFeed.errorBiomassZero'));
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await calculatorsApi.calculateDailyFeed({
                biomassKg: computedBiomass,
                feedingPercentage: fr,
            });
            setBiomassKg(computedBiomass);
            setResult(data);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.message || t('calculators.dailyFeed.errorCalc'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('calculators.dailyFeed.eyebrow')}
                title={t('calculators.dailyFeed.shortTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <PondPicker
                    pondId={pondId}
                    onChange={(id, ctx) => {
                        if (id !== pondId) setPondName(null);
                        applyContext(id, ctx);
                    }}
                    stockedOnly
                />

                {prefilled && (
                    <View style={styles.prefilled}>
                        <Text style={styles.prefilledText}>
                            {doc != null
                                ? t('calculators.dailyFeed.filledFromPondDay', { day: doc })
                                : t('calculators.dailyFeed.filledFromPond')}
                        </Text>
                    </View>
                )}

                <SectionHeader label={t('calculators.dailyFeed.fromThePond')} />
                <View style={styles.form}>
                    <View style={styles.triple}>
                        <View style={styles.third}>
                            <Input
                                label={t('calculators.dailyFeed.labelMbw')}
                                value={mbwG}
                                onChangeText={setMbwG}
                                keyboardType="decimal-pad"
                                placeholder="18.4"
                                required
                            />
                        </View>
                        <View style={styles.third}>
                            <Input
                                label={t('calculators.dailyFeed.labelSr')}
                                value={srPct}
                                onChangeText={setSrPct}
                                keyboardType="decimal-pad"
                                placeholder="78"
                                required
                            />
                        </View>
                        <View style={styles.third}>
                            <Input
                                label={t('calculators.dailyFeed.labelCountShort')}
                                value={initialCount}
                                onChangeText={setInitialCount}
                                keyboardType="number-pad"
                                placeholder="28700"
                                required
                            />
                        </View>
                    </View>
                </View>

                <SectionHeader label={t('calculators.dailyFeed.whatYouAreTesting')} />
                <View style={styles.form}>
                    <View style={styles.pair}>
                        <View style={styles.half}>
                            <Input
                                label={t('calculators.dailyFeed.labelFeedingRateShort')}
                                value={feedingRatePct}
                                onChangeText={setFeedingRatePct}
                                keyboardType="decimal-pad"
                                placeholder="3.2"
                                required
                            />
                            <Text style={styles.typedNote}>{t('calculators.dailyFeed.typedByYou')}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.calcBtn, isLoading && styles.calcBusy]}
                        onPress={handleCalculate}
                        disabled={isLoading}
                        accessibilityRole="button"
                    >
                        <Text style={styles.calcLabel}>{t('calculators.dailyFeed.calculate')}</Text>
                    </TouchableOpacity>
                </View>

                {result && (
                    <>
                        <View style={styles.result}>
                            <Text style={styles.resultLabel}>
                                {t('calculators.dailyFeed.requiredDailyFeed')}
                            </Text>
                            <Text style={styles.resultValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                {result.dailyFeedKg.toFixed(1)}
                                <Text style={styles.resultUnit}> kg</Text>
                            </Text>
                        </View>
                        <StatRow
                            divider
                            stats={[
                                {
                                    value: biomassKg != null ? Math.round(biomassKg).toLocaleString('en-IN') : '—',
                                    label: t('calculators.dailyFeed.biomassKg'),
                                },
                                {
                                    value: (result.dailyFeedKg / MEALS_PER_DAY).toFixed(1),
                                    label: t('calculators.dailyFeed.perMealKg'),
                                },
                                { value: String(MEALS_PER_DAY), label: t('calculators.dailyFeed.meals') },
                            ]}
                        />

                        {/* The calculation is only useful if it reaches the log. */}
                        {!!pondId && (
                            <TouchableOpacity
                                style={styles.logRow}
                                onPress={() =>
                                    navigation.navigate('FeedLog', {
                                        pondId,
                                        pondName,
                                        suggestedKg: Number(result.dailyFeedKg.toFixed(1)),
                                    })
                                }
                                accessibilityRole="button"
                            >
                                <Text style={styles.logLabel}>
                                    {t('calculators.dailyFeed.logThisAmount', {
                                        kg: result.dailyFeedKg.toFixed(1),
                                    })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                <SectionHeader label={t('calculators.dailyFeed.feedingRateReference')} />
                <View style={styles.tableHead}>
                    <Text style={[styles.headCell, { flex: 1 }]}>
                        {t('calculators.dailyFeed.colShrimpSize')}
                    </Text>
                    <Text style={[styles.headCell, styles.rateCol]}>
                        {t('calculators.dailyFeed.colRateBw')}
                    </Text>
                </View>
                {FEEDING_RATE_TABLE.map((row) => (
                    <View key={row.sizeRange} style={styles.tableRow}>
                        <Text style={[styles.cell, { flex: 1 }]}>{row.sizeRange}</Text>
                        <Text style={[styles.cell, styles.rateCol]}>{row.rate}</Text>
                    </View>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    prefilled: {
        backgroundColor: c.infoBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
    },
    prefilledText: { ...theme.typeScale.bodySmall, color: c.infoText },

    form: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[1] },
    triple: { flexDirection: 'row', gap: theme.spacing[2] },
    third: { flex: 1 },
    pair: { flexDirection: 'row', gap: theme.spacing[3] },
    half: { flex: 1 },
    typedNote: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: c.textDisabled,
        marginTop: -theme.spacing[2],
        marginBottom: theme.spacing[2],
    },
    calcBtn: {
        marginTop: theme.spacing[2],
        backgroundColor: c.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    calcBusy: { opacity: 0.6 },
    calcLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textInverse },

    result: {
        backgroundColor: c.successBg,
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
        marginTop: theme.spacing[4],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[4],
    },
    resultLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.successText,
    },
    resultValue: { fontFamily: 'DMMono-Medium', fontSize: 40, lineHeight: 48, color: c.successText },
    resultUnit: { fontSize: 20 },
    logRow: {
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        minHeight: 44,
        justifyContent: 'center',
    },
    logLabel: { ...theme.typeScale.labelLarge, color: c.textLink },

    tableHead: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[1],
    },
    headCell: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.textDisabled,
    },
    rateCol: { width: 110, textAlign: 'right' },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
    },
    cell: { ...theme.typeScale.bodyMedium, color: c.textPrimary },
});

export default DailyFeedCalculatorScreen;
