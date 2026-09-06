import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { SelectField } from '../../components/ui/SelectField';
import { CANONICAL_SPECIES, SEED_TYPES, speciesLabelKey } from '../../features/species';
import { theme } from '../../theme';
import { cropsApi } from '../../api/crops';
import { pondsApi, type Pond } from '../../api/ponds';
import { apiErrorMessage } from '../../api/errors';
import { toLocalISODate } from '../../utils/localDate';
import { capture, EVENTS } from '../../features/analytics';

/** Parse a non-empty numeric string, else undefined (so the column default applies). */
const num = (s: string) => (s.trim() ? Number(s) : undefined);

/**
 * Carrying capacity (max sustainable standing biomass, kg/m²) is a system
 * parameter farmers reason about as culture intensity, not a raw figure. These
 * presets map the intensity to a kg/m² value (semi-intensive = JALA's 1.25
 * default). Advanced users / aeration-derived values can override later.
 */
type Intensity = 'extensive' | 'semi' | 'intensive';
const INTENSITY: { key: Intensity; tkey: string; kgM2: number; icon: any }[] = [
    { key: 'extensive', tkey: 'cycles.intensityExtensive', kgM2: 0.5, icon: 'water-outline' },
    { key: 'semi', tkey: 'cycles.intensitySemi', kgM2: 1.25, icon: 'water' },
    { key: 'intensive', tkey: 'cycles.intensityIntensive', kgM2: 2.5, icon: 'water-plus' },
];

export const CreateCycleScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    /**
     * WHICH POND — answerable, and changeable.
     *
     * This screen took a `pondId` and then never mentioned it again: no header,
     * no pond name, no back button, and no way to switch. Arriving from the
     * Today hero ("Stock a cycle in Pond 2") that is survivable only if you
     * remember what the card said; arriving any other way you are filling in a
     * stocking form for a pond the app will not name. Reported as: "it took me
     * to start a cycle pond and i dont even know which pond is that for and
     * cant change, it didnt ask me also."
     *
     * The route param is the STARTING point now, not the whole answer.
     */
    const [pondId, setPondId] = useState<string>(route.params.pondId);
    const [ponds, setPonds] = useState<Pond[]>([]);
    const currentPond = ponds.find((p) => p.id === pondId);
    const [name, setName] = useState('');
    const [stockingDate, setStockingDate] = useState<Date>(new Date());
    const [stockingCount, setStockingCount] = useState('');
    const [speciesType, setSpeciesType] = useState('Vannamei');
    const [seedType, setSeedType] = useState('');

    // Cycle targets (consumed by the simulation + harvest/feed engines). Prefilled
    // with the backend defaults so engines get sensible values out of the box.
    const [totalSeed, setTotalSeed] = useState('');
    const [feedPrice, setFeedPrice] = useState('');
    const [intensity, setIntensity] = useState<Intensity>('semi');
    const [targetDays, setTargetDays] = useState('120');
    const [targetSize, setTargetSize] = useState('');
    const [targetSr, setTargetSr] = useState('75');

    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; stockingCount?: string; seedType?: string }>({});

    /**
     * The ponds this cycle could go on: the rest of the same farm.
     *
     * Only ponds with NO running cycle are offered, plus whichever one we
     * arrived on — a pond already mid-cycle cannot take a second, and listing
     * it would be an option that only fails on save. Best-effort: if the farm
     * cannot be read we simply do not offer the switch, which is exactly the
     * behaviour before this existed, rather than a broken screen.
     */
    useEffect(() => {
        let cancelled = false;
        void pondsApi
            .getById(route.params.pondId)
            .then(async ({ data: pond }) => {
                if (cancelled || !pond?.farmId) return;
                const res = await pondsApi.getAll(pond.farmId, { take: 100 });
                const raw: any = res.data;
                const list: Pond[] = Array.isArray(raw)
                    ? raw
                    : (raw?.items ?? raw?.data ?? []);
                if (cancelled) return;
                setPonds(
                    list.filter(
                        (p) => !p.activeCycleId || p.id === route.params.pondId,
                    ),
                );
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [route.params.pondId]);

    // A blank required "Cycle Name" field with nothing to go on is exactly the
    // kind of internal-sounding ask a farmer shouldn't have to think about —
    // pre-fill a sensible default (numbered after this pond's prior cycles) so
    // accepting it and moving on is the normal path; still fully editable for
    // anyone who wants a custom label.
    useEffect(() => {
        let cancelled = false;
        cropsApi.getAll(pondId)
            .then(({ data }) => {
                if (cancelled) return;
                const n = (Array.isArray(data) ? data.length : 0) + 1;
                setName((current) => current || t('cycles.defaultCycleName', { n }));
            })
            .catch(() => {
                if (cancelled) return;
                setName((current) => current || t('cycles.defaultCycleName', { n: 1 }));
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pondId]);

    const handleSave = async () => {
        const newErrors: { name?: string; stockingCount?: string; seedType?: string } = {};
        // The seed grade sets what a "normal" ABW curve looks like from day one,
        // and it was the one stocking fact nobody was made to supply.
        if (!seedType) {
            newErrors.seedType = t('cycles.errorSeedTypeRequired');
        }
        if (!name.trim()) {
            newErrors.name = t('cycles.errorCycleNameRequired');
        }
        // parseInt('-500')=-500 and parseInt('500abc')=500 both slipped through the
        // old isNaN check; require a whole positive count so typos/garbage are caught.
        const count = Number(stockingCount);
        if (!Number.isInteger(count) || count <= 0) {
            newErrors.stockingCount = t('cycles.errorStockingCountRequired');
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setIsLoading(true);

        try {
            await cropsApi.create({
                pondId,
                name: name.trim(),
                stockingDate: toLocalISODate(stockingDate),
                stockingCount: count,
                speciesType: speciesType.trim() || undefined,
                seedType: seedType.trim() || undefined,
                totalSeed: num(totalSeed),
                feedPriceRpPerKg: num(feedPrice),
                carryingCapacityKgM2: INTENSITY.find((i) => i.key === intensity)!.kgM2,
                targetCultivationDays: num(targetDays),
                targetSize: num(targetSize),
                targetSrPercent: num(targetSr),
            });
            // Activation. The stocking count, seed and prices above are farm
            // records and stay here — only the fact of a cycle starting goes.
            capture(EVENTS.CYCLE_STARTED, { ok: true });
            navigation.goBack();
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('cycles.errorStartCycle')));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {/*
              * There was no header on this screen at all — so no pond name, and
              * no back button either. The only way out was the Android gesture.
              */}
            <ScreenHeader
                eyebrow={t('cycles.startCycle')}
                title={
                    currentPond
                        ? currentPond.displayName || currentPond.pondCode || currentPond.name
                        : t('cycles.startCycle')
                }
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContainer}>
                {/*
                  * Offered only when there is a real choice. One pond and this
                  * is a dropdown with a single entry — noise on a form that is
                  * already long, and the header above already names it.
                  */}
                {ponds.length > 1 && (
                    <SelectField
                        label={t('cycles.fieldPond')}
                        value={pondId}
                        options={ponds.map((p) => ({
                            value: p.id,
                            label: p.displayName || p.pondCode || p.name,
                        }))}
                        onSelect={setPondId}
                        required
                    />
                )}
                <Input
                    label={t('cycles.fieldCycleName')}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('cycles.placeholderCycleName')}
                    error={errors.name}
                    required
                />
                <CalendarPicker
                    label={t('cycles.fieldStockingDate')}
                    value={stockingDate}
                    onChange={setStockingDate}
                    maxDate={new Date()}
                    required
                />
                <Input
                    label={t('cycles.fieldStockingCount')}
                    value={stockingCount}
                    onChangeText={setStockingCount}
                    keyboardType="number-pad"
                    placeholder={t('cycles.placeholderStockingCount')}
                    error={errors.stockingCount}
                    required
                />
                {/* Both were free text. A typo did not error — it silently
                    picked the wrong threshold bands, so the pond was judged
                    against the wrong species with nothing on screen to say so.
                    The lists are the ones the API now validates against. */}
                <SelectField
                    label={t('cycles.fieldSpeciesType')}
                    value={speciesType}
                    options={CANONICAL_SPECIES.map((s) => ({ value: s, label: t(speciesLabelKey(s)) }))}
                    onSelect={setSpeciesType}
                    required
                />
                <SelectField
                    label={t('cycles.fieldSeedType')}
                    value={seedType || null}
                    options={SEED_TYPES.map((s) => ({ value: s, label: s }))}
                    onSelect={setSeedType}
                    placeholder={t('cycles.placeholderSeedType')}
                    error={errors.seedType}
                    required
                />

                <Text style={styles.sectionLabel}>{t('cycles.createTargets')}</Text>
                <Text style={styles.sectionHint}>
                    {t('cycles.createTargetsHint')}
                </Text>

                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTotalSeed')} value={totalSeed} onChangeText={setTotalSeed} keyboardType="number-pad" placeholder="e.g. 400000" />
                    </View>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldFeedPrice')} value={feedPrice} onChangeText={setFeedPrice} keyboardType="decimal-pad" placeholder="e.g. 95" />
                    </View>
                </View>
                <Text style={styles.fieldLabel}>{t('cycles.fieldIntensity')}</Text>
                <View style={styles.segment}>
                    {INTENSITY.map((opt) => {
                        const active = intensity === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.segBtn, active && styles.segBtnActive]}
                                onPress={() => setIntensity(opt.key)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name={opt.icon}
                                    size={18}
                                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                />
                                <Text numberOfLines={1} style={[styles.segLabel, active && { color: theme.roles.light.primary }]}>{t(opt.tkey)}</Text>
                                <Text style={styles.segValue}>{opt.kgM2} kg/m²</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.sectionHint}>
                    {t('cycles.intensityHint')}
                </Text>

                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetDays')} value={targetDays} onChangeText={setTargetDays} keyboardType="number-pad" />
                    </View>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetSize')} value={targetSize} onChangeText={setTargetSize} keyboardType="number-pad" placeholder="e.g. 40" />
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetSr')} value={targetSr} onChangeText={setTargetSr} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.halfCol} />
                </View>

                <Button
                    title={t('cycles.startCycle')}
                    onPress={handleSave}
                    loading={isLoading}
                    style={styles.saveBtn}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    formContainer: {
        // The screen is no longer padded by ScreenWrapper (it now owns a
        // full-bleed header), so the form supplies its own gutter.
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[10],
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    sectionLabel: {
        ...theme.typeScale.overline,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[5],
        marginBottom: theme.spacing[1],
    },
    sectionHint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    fieldLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
    },
    segment: {
        flexDirection: 'row',
        gap: theme.spacing[2],
    },
    segBtn: {
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    segBtnActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceOverlay,
    },
    segLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    segValue: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
    },
    saveBtn: {
        marginTop: theme.spacing[6],
    },
});
