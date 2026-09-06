/**
 * PondNamesScreen — artboard 06, "Your ponds", step 2 of 2.
 *
 * The farm draft arrives from step 1 (CreateFarmScreen) and is written HERE,
 * together with its ponds, when "Create farm" is pressed. That ordering is the
 * design's: the button says what it does, and abandoning step 2 leaves nothing
 * behind.
 *
 * ── Naming ────────────────────────────────────────────────────────────────
 * One editable name per pond, PRE-FILLED P1…PN.
 *
 * This was a single prefix field, and ponds were created with no `displayName`
 * at all — so every farm in the app was P1, P2, P3, a farmer with two farms had
 * two P1s with nothing between them, and the only route to a real name was an
 * edit form nobody found. Pre-filling means a farmer who does not care still
 * taps straight through; the ones who do can type "North pond" where it
 * matters. The server's prefix is derived from the name rather than asked for.
 *
 * ── Where this departs from the drawing, and why ──────────────────────────
 * The artboard asks only for an optional area per pond ("Area is optional now.
 * You can add it when you stock a pond."). The backend cannot create a pond
 * that thin: `pond.depth_m` and `pond.calculated_area_m2` are NOT NULL columns,
 * and `CreatePondDto.depthM` is validated 0.5–5.0 m. Depth is not cosmetic —
 * volume, aeration adequacy and every dosing figure downstream read it, so
 * defaulting it to a plausible number would seed the whole app with a
 * measurement nobody took.
 *
 * So one field the design does not show is asked for once and applied to every
 * pond: depth. It is a single question for the whole set, not per pond, which
 * keeps the screen at the design's decision budget.
 *
 * Shape and construction type sit behind an optional "Add more details" — a
 * farmer who wants to say is not forced to wait until later, and one who does
 * not is not held up. Leaving it shut still creates the pond, but records the
 * defaults as ASSUMED (`assumedFields`), so the pond page says those numbers
 * are not confirmed instead of presenting the app's guess as the farmer's
 * answer. Volume, aeration adequacy and every dosing figure read them.
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmsApi, type CreateFarmDto } from '../../api/farms';
import { pondsApi } from '../../api/ponds';
import { cropsApi } from '../../api/crops';
import { apiErrorMessage } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useUIStore } from '../../store/uiStore';
import { capture, EVENTS, sizeBand } from '../../features/analytics';

/** The server's naming rule, mirrored so the preview cannot disagree with it. */
export const isValidPrefix = (prefix: string) => /^[A-Za-z0-9]{1,4}$/.test(prefix);

/**
 * A 1–4 char alphanumeric prefix from a free-form pond name — the same helper
 * CreatePondScreen and PondSetupScreen use, so a pond named the same way gets
 * the same code wherever it was created. The farmer is never asked for it.
 * Falls back to 'P' for a name with no alphanumerics at all (e.g. "தென் குளம்"
 * in a script the code column cannot hold).
 */
export const derivePrefix = (name: string) => {
    const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return alnum.slice(0, 4) || 'P';
};

type Geometry = 'rectangular' | 'circular' | 'irregular';
type Construction = 'earthen' | 'lined' | 'cage' | 'biofloc_ras';

/** Only the shapes that need no dimensions to be legal at creation time. */
const GEOMETRIES: { value: Geometry; labelKey: string }[] = [
    { value: 'irregular', labelKey: 'ponds.shapeIrregular' },
    { value: 'rectangular', labelKey: 'ponds.shapeRect' },
    { value: 'circular', labelKey: 'ponds.shapeCircular' },
];

const CONSTRUCTIONS: { value: Construction; labelKey: string }[] = [
    { value: 'earthen', labelKey: 'ponds.constructionEarthen' },
    { value: 'lined', labelKey: 'ponds.constructionLined' },
    { value: 'cage', labelKey: 'ponds.constructionCage' },
    { value: 'biofloc_ras', labelKey: 'ponds.constructionBioflocRas' },
];

/** P, 4 → ['P1', 'P2', 'P3', 'P4']. Empty for an unusable prefix or count. */
export const pondNames = (prefix: string, count: number): string[] => {
    if (!isValidPrefix(prefix) || count < 1) return [];
    return Array.from({ length: count }, (_, i) => `${prefix.toUpperCase()}${i + 1}`);
};

export const PondNamesScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const farm: CreateFarmDto = route.params.farm;
    const pondCount: number = route.params.pondCount;

    const pendingFarmSetup = useAuthStore((s) => s.pendingFarmSetup);
    const completeFarmSetup = useAuthStore((s) => s.completeFarmSetup);
    const loadMemberships = useMembershipStore((s) => s.load);
    const showToast = useUIStore((s) => s.showToast);

    /**
     * One editable name per pond, pre-filled P1…PN.
     *
     * It used to be a single PREFIX, and the ponds were created with no
     * `displayName` at all — so every farm in the app was P1, P2, P3, and a
     * farmer with two farms had two P1s with nothing to tell them apart. The
     * only way to give a pond a real name was an edit form nobody found.
     *
     * Pre-filled rather than blank so a farmer who does not care taps straight
     * through and still ends up with something typed by hand for the ones they
     * do care about. Whatever is here becomes the pond's display name.
     */
    const [names, setNames] = useState<string[]>(() => pondNames('P', pondCount));
    const [depth, setDepth] = useState('');
    // Sparse by design: only the ponds whose area the farmer actually typed.
    const [areas, setAreas] = useState<Record<number, string>>({});
    const [errors, setErrors] = useState<{ names?: string; depth?: string }>({});
    const [busy, setBusy] = useState(false);
    // Shut by default; opening it is what turns a default into an answer.
    const [showMore, setShowMore] = useState(false);
    const [showStocking, setShowStocking] = useState(false);
    const [geometry, setGeometry] = useState<Geometry>('irregular');
    const [construction, setConstruction] = useState<Construction>('earthen');

    /**
     * "Is this pond already stocked?" — per pond, entirely optional (W7).
     *
     * Nothing in first run shows what this app computes, and honestly it
     * cannot: FCR, ABW, growth, feed advice, disease risk and P&L each need a
     * stocked cycle. Faking one is not an option — the fabricated "EXAMPLE"
     * dashboard was deleted for exactly that reason — so the app asks, at the
     * one moment the farmer is already thinking about this pond.
     *
     * Sparse, like `areas`: only the ponds the farmer actually answered for.
     * A pond with no date here simply gets no cycle, and the Home hero picks
     * up from there.
     */
    const [stocking, setStocking] = useState<
        Record<number, { date?: string; count?: string }>
    >({});
    const setStockingField = (i: number, field: 'date' | 'count', value: string) =>
        setStocking((prev) => ({ ...prev, [i]: { ...prev[i], [field]: value } }));

    const setName = (i: number, value: string) =>
        setNames((prev) => prev.map((n, j) => (j === i ? value : n)));

    const create = async () => {
        const next: { names?: string; depth?: string } = {};
        if (names.some((n) => !n.trim())) next.names = t('pondSetup.errPondName');
        const depthNum = parseFloat(depth);
        if (!depth || isNaN(depthNum) || depthNum < 0.5 || depthNum > 5.0) {
            next.depth = t('pondSetup.errDepth');
        }
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        setBusy(true);
        try {
            const { data: created } = await farmsApi.create(farm);
            // The farm exists from here on. Every later failure is partial, not
            // total — never unwind it and never report it as "nothing happened".
            let failed = 0;
            // Counted separately from `failed`: a pond that exists without its
            // cycle is a very different outcome from a pond that never got
            // made, and reporting them as one number would be a lie about
            // which one to go and fix.
            let cycleFailed = 0;
            for (let i = 0; i < pondCount; i++) {
                const areaNum = parseFloat(areas[i] ?? '');
                try {
                    const displayName = names[i].trim();
                    const createdPond = await pondsApi.create({
                        farmId: created.id,
                        displayName,
                        // The server still generates a code from a prefix; it is
                        // derived from the name now instead of being a question.
                        namePrefix: derivePrefix(displayName),
                        geometryType: geometry,
                        constructionType: construction,
                        depthM: depthNum,
                        // Server rejects an override below 1 m²; a blank or junk
                        // entry simply means "not measured yet".
                        overrideAreaM2: areaNum >= 1 ? areaNum : undefined,
                        /**
                         * What the APP chose rather than the farmer, so the pond
                         * can say which of its numbers are assumed. Volume,
                         * aeration adequacy and every dosing figure read these —
                         * rendering a default with the same confidence as a
                         * measurement is a lie the farmer plans a season on.
                         */
                        assumedFields: [
                            ...(showMore ? [] : ['geometryType', 'constructionType']),
                            ...(areaNum >= 1 ? [] : ['areaM2']),
                            /**
                             * Depth is asked ONCE and applied to every pond in
                             * the set. For a single pond that is the farmer's
                             * measurement of that pond. For a set it is the
                             * app extrapolating one number across N ponds —
                             * which pond it was actually measured on is
                             * unknowable, so none of them may claim it. Depth
                             * feeds volume, aeration adequacy and every dosing
                             * figure, so a borrowed one is exactly the kind of
                             * number this list exists to flag.
                             */
                            ...(pondCount > 1 ? ['depthM'] : []),
                        ],
                    });

                    /**
                     * Seed the first cycle, if the farmer said the pond is
                     * already stocked (W7).
                     *
                     * Nothing in first run shows what this app computes, and the
                     * honest reason is that it cannot: FCR, ABW, growth, feed
                     * advice, disease risk and P&L every one need a stocked
                     * cycle. Rather than fake a dashboard — the fabricated
                     * "EXAMPLE" card was deleted for exactly that reason — ask
                     * at the one moment the farmer is already thinking about
                     * this pond.
                     *
                     * Optional in the strongest sense: skipping is free and
                     * lands precisely where the Home hero picks up.
                     *
                     * Failing to create the CYCLE must never fail the POND. The
                     * pond exists by this line, and unwinding it — or counting
                     * it as failed — would lose the thing that did work.
                     */
                    const stockedOn = stocking[i]?.date?.trim();
                    const newPondId = createdPond?.data?.pond?.id;
                    if (stockedOn && newPondId) {
                        const count = parseFloat(stocking[i]?.count ?? '');
                        try {
                            await cropsApi.create({
                                pondId: newPondId,
                                name: t('pondSetup.firstCycleName', { pond: displayName }),
                                stockingDate: stockedOn,
                                // A count the farmer did not give must not reach
                                // the engines looking like an answer.
                                stockingCount:
                                    Number.isFinite(count) && count > 0 ? count : undefined,
                            });
                        } catch {
                            // The pond stands. The cycle can be started from the
                            // pond page, which is where the Home hero sends them.
                            cycleFailed++;
                        }
                    }
                } catch {
                    failed++;
                }
            }

            await loadMemberships();
            // No `band` on the farm: this screen never asks how many farms the
            // person has, and the contract says omit the band rather than make
            // a request for telemetry. The pond band is free — it is the count
            // this screen was handed. One POND_CREATED for the whole set,
            // because naming N ponds is one action by the farmer.
            capture(EVENTS.FARM_CREATED);
            if (pondCount - failed > 0) {
                capture(EVENTS.POND_CREATED, { band: sizeBand(pondCount - failed) });
            }
            /**
             * Three outcomes, said apart.
             *
             * A pond that never got made and a pond that exists without its
             * cycle need different things done about them, so reporting them
             * as one number would point the farmer at the wrong screen. The
             * cycle case is the milder one — the pond is there, and the Home
             * hero will ask for the cycle anyway — so it is a warning, not an
             * error.
             */
            showToast(
                failed > 0
                    ? { message: t('pondSetup.errPondsPartial', { count: failed }), type: 'error' }
                    : cycleFailed > 0
                        ? { message: t('pondSetup.errCyclesPartial', { count: cycleFailed }), type: 'error' }
                        : { message: t('farms.farmCreatedToast', { name: farm.name, defaultValue: '{{name}} created' }), type: 'success' },
            );

            if (pendingFarmSetup) completeFarmSetup();
            navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
        } catch (e: any) {
            // The farm itself failed — nothing was created, so let them retry.
            Alert.alert(t('common.error'), apiErrorMessage(e, t('farms.errorCreateFarm')));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                title={t('pondSetup.stepPondsTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                trailing={t('farms.stepOfTwo', { n: 2 })}
            />

            <View style={styles.progress} accessibilityRole="progressbar">
                <View style={[styles.progressSeg, styles.progressDone]} />
                <View style={[styles.progressSeg, styles.progressDone]} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Not in the artboard — see the file header for why it has to be. */}
                <Input
                    label={t('pondSetup.fieldDepth')}
                    value={depth}
                    onChangeText={setDepth}
                    keyboardType="decimal-pad"
                    placeholder="1.2"
                    error={errors.depth}
                    required
                />

                <Text style={styles.label}>{t('pondSetup.pondsToCreate')}</Text>
                <View style={styles.card}>
                    {names.map((n, i) => (
                        <View key={i} style={[styles.pondRow, i > 0 && styles.pondRowDivided]}>
                            <Icon name="waves" size={22} color={theme.roles.light.textSecondary} />
                            <TextInput
                                value={n}
                                onChangeText={(v) => setName(i, v)}
                                placeholder={t('pondSetup.pondNamePlaceholder')}
                                placeholderTextColor={theme.roles.light.textTertiary}
                                style={styles.pondNameInput}
                                maxLength={100}
                                accessibilityLabel={t('pondSetup.pondNameLabel')}
                                testID={`pond-name-${i}`}
                            />
                            <TextInput
                                value={areas[i] ?? ''}
                                onChangeText={(v) => setAreas((prev) => ({ ...prev, [i]: v }))}
                                placeholder={t('pondSetup.areaPlaceholder')}
                                placeholderTextColor={theme.roles.light.textTertiary}
                                keyboardType="decimal-pad"
                                style={styles.areaInput}
                                accessibilityLabel={`${n} — ${t('pondSetup.areaPlaceholder')}`}
                            />
                        </View>
                    ))}
                </View>

                {/*
                  * "Already stocked?" — optional, per pond (W7).
                  *
                  * The one question that turns a first run into a dashboard
                  * with real numbers on it. Every differentiated figure the
                  * product computes needs a stocked cycle, so without this a
                  * farmer can finish setup perfectly and still see nothing.
                  *
                  * A separate, collapsed section rather than two more boxes on
                  * every pond row: most ponds are not stocked at setup time,
                  * and putting the fields inline would tax everyone for the
                  * minority case.
                  */}
                <TouchableOpacity
                    style={styles.moreToggle}
                    onPress={() => setShowStocking((v) => !v)}
                    testID="stocking-toggle"
                    accessibilityRole="button"
                >
                    <Text style={styles.moreToggleText}>{t('pondSetup.stockedToggle')}</Text>
                    <Icon
                        name="expand_more"
                        size={20}
                        color={theme.roles.light.textSecondary}
                    />
                </TouchableOpacity>
                {showStocking && (
                    <View style={styles.moreBox}>
                        <Text style={styles.note}>{t('pondSetup.stockedHint')}</Text>
                        {names.map((n, i) => (
                            <View key={i} style={styles.stockRow}>
                                <Text style={styles.stockName} numberOfLines={1}>
                                    {n}
                                </Text>
                                <TextInput
                                    value={stocking[i]?.date ?? ''}
                                    onChangeText={(v) => setStockingField(i, 'date', v)}
                                    placeholder={t('pondSetup.stockedDatePlaceholder')}
                                    placeholderTextColor={theme.roles.light.textTertiary}
                                    style={styles.stockInput}
                                    testID={`stocked-date-${i}`}
                                    accessibilityLabel={`${n} — ${t('pondSetup.stockedDateLabel')}`}
                                />
                                <TextInput
                                    value={stocking[i]?.count ?? ''}
                                    onChangeText={(v) => setStockingField(i, 'count', v)}
                                    placeholder={t('pondSetup.stockedCountPlaceholder')}
                                    placeholderTextColor={theme.roles.light.textTertiary}
                                    keyboardType="number-pad"
                                    style={styles.stockInput}
                                    testID={`stocked-count-${i}`}
                                    accessibilityLabel={`${n} — ${t('pondSetup.stockedCountLabel')}`}
                                />
                            </View>
                        ))}
                    </View>
                )}
                {errors.names ? <Text style={styles.error}>{errors.names}</Text> : null}
                <Text style={styles.note}>{t('pondSetup.areaOptionalNote')}</Text>

                {/*
                  * The rest of what a pond IS — shape and construction — behind
                  * one tap.
                  *
                  * Not asked outright, because measurements in front of someone
                  * who has not seen the app yet is how you lose them; not
                  * skipped silently either, because the app has to pick
                  * something and the farmer never learns it did. Opening this
                  * is a real answer; leaving it shut records the defaults as
                  * ASSUMED, and the pond says so until they are confirmed.
                  */}
                <TouchableOpacity
                    style={styles.moreToggle}
                    onPress={() => setShowMore((v) => !v)}
                    testID="more-details-toggle"
                    accessibilityRole="button"
                >
                    <Text style={styles.moreToggleText}>{t('pondSetup.moreDetails')}</Text>
                    <Icon
                        name="expand_more"
                        size={20}
                        color={theme.roles.light.textSecondary}
                    />
                </TouchableOpacity>
                {showMore && (
                    <View style={styles.moreBox}>
                        <Text style={styles.note}>{t('pondSetup.moreDetailsHint')}</Text>

                        <Text style={styles.subLabel}>{t('ponds.labelPondShape')}</Text>
                        <View style={styles.optionRow}>
                            {GEOMETRIES.map((g) => (
                                <TouchableOpacity
                                    key={g.value}
                                    testID={`geometry-${g.value}`}
                                    style={[styles.option, geometry === g.value && styles.optionActive]}
                                    onPress={() => setGeometry(g.value)}
                                >
                                    <Text style={styles.optionText}>{t(g.labelKey)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.subLabel}>{t('ponds.labelConstructionType')}</Text>
                        <View style={styles.optionRow}>
                            {CONSTRUCTIONS.map((ct) => (
                                <TouchableOpacity
                                    key={ct.value}
                                    testID={`construction-${ct.value}`}
                                    style={[
                                        styles.option,
                                        construction === ct.value && styles.optionActive,
                                    ]}
                                    onPress={() => setConstruction(ct.value)}
                                >
                                    <Text style={styles.optionText}>{t(ct.labelKey)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Button title={t('pondSetup.createFarmCta')} onPress={create} loading={busy} />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    progress: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[4],
    },
    progressSeg: {
        flex: 1,
        height: 4,
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.borderDefault,
    },
    progressDone: { backgroundColor: theme.roles.light.primary },
    content: { padding: theme.spacing[4], paddingBottom: theme.spacing[12] },
    label: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    subLabel: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[2],
    },
    error: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        marginTop: theme.spacing[1],
    },
    card: {
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    pondRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        minHeight: 56,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[2],
    },
    pondRowDivided: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    pondNameInput: {
        flex: 1,
        minHeight: 40,
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.sm,
        backgroundColor: theme.roles.light.surfaceVariant,
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
    },
    moreToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        marginTop: theme.spacing[4],
    },
    moreToggleText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    moreBox: {
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
        padding: theme.spacing[4],
    },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
    option: {
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    optionActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginTop: theme.spacing[3],
    },
    stockName: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textPrimary,
        width: 64,
    },
    stockInput: {
        flex: 1,
        minHeight: 40,
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.sm,
        backgroundColor: theme.roles.light.surfaceVariant,
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    optionText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textPrimary,
    },
    areaInput: {
        width: 104,
        minHeight: 40,
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.sm,
        backgroundColor: theme.roles.light.surfaceVariant,
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        textAlign: 'right',
    },
    note: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[3],
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
    },
});

export default PondNamesScreen;
