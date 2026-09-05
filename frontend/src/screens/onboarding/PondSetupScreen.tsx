import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SelectField, SelectOption } from '../../components/ui/SelectField';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { theme } from '../../theme';
import { pondsApi, CreatePondResult } from '../../api/ponds';
import { cropsApi } from '../../api/crops';
import { referenceApi } from '../../api/reference';
import { apiErrorMessage } from '../../api/errors';

type Geometry = 'rectangular' | 'circular' | 'raceway';

const GEOMETRIES: { key: Geometry; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'rectangular', icon: 'rectangle-outline' },
    { key: 'circular', icon: 'circle-outline' },
    { key: 'raceway', icon: 'swap-horizontal' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Day-of-culture is 1-based: the stocking day itself is Day 1.
const dayOfCulture = (stocking: Date) => {
    const diff = Math.floor((startOfDay(new Date()).getTime() - startOfDay(stocking).getTime()) / 86400000);
    return Math.max(1, diff + 1);
};

// Derive a 1–4 char alphanumeric prefix (backend naming requirement) from the
// free-form pond name; the full name is preserved as displayName.
const derivePrefix = (name: string) => {
    const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return alnum.slice(0, 4) || 'P';
};

const computeArea = (g: Geometry, l: number, w: number, dia: number): number | null => {
    if (g === 'circular') return dia > 0 ? Math.PI * Math.pow(dia / 2, 2) : null;
    return l > 0 && w > 0 ? l * w : null;
};

const emptyForm = () => ({
    name: '',
    geometry: 'rectangular' as Geometry,
    lengthM: '',
    widthM: '',
    diameterM: '',
    depthM: '',
    speciesId: null as string | null,
    strainId: null as string | null,
    hatcheryId: null as string | null,
    stockingDensity: '',
    stockingDate: startOfDay(new Date()),
    aeratorCount: '',
    hpPerAerator: '',
});

export const PondSetupScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const farmId: string = route.params?.farmId;
    const totalPonds: number = Math.max(1, route.params?.totalPonds ?? 1);

    const scrollRef = useRef<ScrollView>(null);
    // Survives a failed crop-create so retry reuses the already-created pond (see handleSaveStep).
    const pendingPondIdRef = useRef<string | null>(null);
    const pendingAreaRef = useRef<number | null>(null);
    const [index, setIndex] = useState(0);
    const [form, setForm] = useState(emptyForm());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    // Most farms have several near-identical ponds — offered only while
    // filling in Pond 1 of a multi-pond batch, so the farmer can apply that
    // same shape/size/species/stocking setup to the rest instead of
    // re-entering identical data totalPonds times.
    const [copyToAll, setCopyToAll] = useState(false);

    const [loadingRef, setLoadingRef] = useState(true);
    const [speciesOpts, setSpeciesOpts] = useState<SelectOption[]>([]);
    const [strainOpts, setStrainOpts] = useState<SelectOption[]>([]);
    const [hatcheryOpts, setHatcheryOpts] = useState<SelectOption[]>([]);
    const [speciesLabels, setSpeciesLabels] = useState<Record<string, string>>({});

    useEffect(() => {
        (async () => {
            try {
                const [sp, br, ha] = await Promise.all([
                    referenceApi.getAllSpecies(),
                    referenceApi.getAllBroodstocks(),
                    referenceApi.getAllHatcheries(),
                ]);
                const labels: Record<string, string> = {};
                setSpeciesOpts(
                    sp.data.map((s) => {
                        const label = s.commonName || s.scientificName;
                        labels[s.id] = label;
                        return { value: s.id, label, sublabel: s.scientificName };
                    }),
                );
                setSpeciesLabels(labels);
                setStrainOpts(
                    br.data.map((b) => ({
                        value: b.id,
                        label: b.lineCode || b.supplier,
                        sublabel: [b.supplier, b.origin].filter(Boolean).join(' · ') || undefined,
                    })),
                );
                setHatcheryOpts(
                    ha.data.map((h) => ({ value: h.id, label: h.name, sublabel: h.location })),
                );
            } catch {
                // Reference data is optional — the user can still create ponds without it.
            } finally {
                setLoadingRef(false);
            }
        })();
    }, []);

    const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }));

    const previewArea = computeArea(
        form.geometry,
        parseFloat(form.lengthM),
        parseFloat(form.widthM),
        parseFloat(form.diameterM),
    );

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!form.name.trim() || !/[A-Za-z0-9]/.test(form.name)) e.name = t('pondSetup.errName');

        if (form.geometry === 'circular') {
            const dia = parseFloat(form.diameterM);
            if (!dia || dia < 1 || dia > 400) e.diameterM = t('pondSetup.errDiameter');
        } else {
            const l = parseFloat(form.lengthM);
            const w = parseFloat(form.widthM);
            if (!l || l < 1 || l > 500) e.lengthM = t('pondSetup.errLength');
            if (!w || w < 1 || w > 500) e.widthM = t('pondSetup.errWidth');
        }

        const depth = parseFloat(form.depthM);
        if (!depth || depth < 0.5 || depth > 5) e.depthM = t('pondSetup.errDepth');

        if (previewArea !== null && (previewArea < 10 || previewArea > 50000)) {
            e.area = t('pondSetup.errArea');
        }

        if (speciesOpts.length > 0 && !form.speciesId) e.speciesId = t('pondSetup.errSpecies');
        if (strainOpts.length > 0 && !form.strainId) e.strainId = t('pondSetup.errStrain');
        if (hatcheryOpts.length > 0 && !form.hatcheryId) e.hatcheryId = t('pondSetup.errHatchery');

        const density = parseFloat(form.stockingDensity);
        if (!density || density <= 0) e.stockingDensity = t('pondSetup.errDensity');

        const ac = parseInt(form.aeratorCount, 10);
        const hp = parseFloat(form.hpPerAerator);
        if (form.aeratorCount && (isNaN(ac) || ac < 0)) e.aeratorCount = t('pondSetup.errAerator');
        if (form.aeratorCount && ac > 0 && (!form.hpPerAerator || isNaN(hp) || hp <= 0)) e.hpPerAerator = t('pondSetup.errHp');

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const finish = () => navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });

    // Creates one pond + its stocked crop from the CURRENT form values, under
    // a given display name — used both for Pond 1's normal save and for
    // "copy to all", where ponds 2..totalPonds reuse Pond 1's shape/size/
    // species/stocking setup verbatim, just with a distinct name/pondCode.
    const createOnePondAndCrop = async (displayName: string) => {
        const ac = parseInt(form.aeratorCount, 10);
        const hp = parseFloat(form.hpPerAerator);
        const hasAerators = !!form.aeratorCount && !isNaN(ac) && ac > 0;
        const density = parseFloat(form.stockingDensity);

        const pondRes = await pondsApi.create({
            farmId,
            namePrefix: derivePrefix(form.name),
            displayName,
            geometryType: form.geometry,
            constructionType: 'earthen',
            depthM: parseFloat(form.depthM),
            ...(form.geometry === 'circular'
                ? { diameterM: parseFloat(form.diameterM) }
                : { lengthM: parseFloat(form.lengthM), widthM: parseFloat(form.widthM) }),
            aeratorCount: form.aeratorCount ? ac : undefined,
            installedAeratorHp: hasAerators && !isNaN(hp) ? Math.round(ac * hp * 100) / 100 : undefined,
        });

        const result = pondRes.data as unknown as CreatePondResult;
        const pondId = result.pond?.id ?? (result as any).id;
        const areaM2 = result.calculatedAreaM2 ?? previewArea ?? 0;
        const stockingCount = areaM2 > 0 ? Math.round(density * areaM2) : undefined;

        await cropsApi.create({
            pondId,
            name: `${displayName} – ${t('pondSetup.cropSuffix')}`,
            status: 'active',
            stockingDate: toISODate(form.stockingDate),
            stockingCount,
            stockingDensity: density,
            speciesId: form.speciesId ?? undefined,
            speciesType: form.speciesId ? speciesLabels[form.speciesId] : undefined,
            broodstockId: form.strainId ?? undefined,
            hatcheryId: form.hatcheryId ?? undefined,
        });
    };

    const handleSaveStep = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const ac = parseInt(form.aeratorCount, 10);
            const hp = parseFloat(form.hpPerAerator);
            const hasAerators = !!form.aeratorCount && !isNaN(ac) && ac > 0;
            const density = parseFloat(form.stockingDensity);

            // ponytail: pond-then-crop is two non-atomic calls. If a prior attempt for
            // this same pond already created the pond but the crop call failed, reuse
            // that pondId on retry instead of creating a duplicate orphan pond.
            let pondId = pendingPondIdRef.current;
            let areaM2 = pendingAreaRef.current ?? previewArea ?? 0;

            if (!pondId) {
                const pondRes = await pondsApi.create({
                    farmId,
                    namePrefix: derivePrefix(form.name),
                    displayName: form.name.trim(),
                    geometryType: form.geometry,
                    constructionType: 'earthen',
                    depthM: parseFloat(form.depthM),
                    ...(form.geometry === 'circular'
                        ? { diameterM: parseFloat(form.diameterM) }
                        : { lengthM: parseFloat(form.lengthM), widthM: parseFloat(form.widthM) }),
                    aeratorCount: form.aeratorCount ? ac : undefined,
                    installedAeratorHp: hasAerators && !isNaN(hp) ? Math.round(ac * hp * 100) / 100 : undefined,
                });

                const result = pondRes.data as unknown as CreatePondResult;
                pondId = result.pond?.id ?? (result as any).id;
                areaM2 = result.calculatedAreaM2 ?? previewArea ?? 0;
                pendingPondIdRef.current = pondId;
                pendingAreaRef.current = areaM2;
            }

            const stockingCount = areaM2 > 0 ? Math.round(density * areaM2) : undefined;

            await cropsApi.create({
                pondId,
                name: `${form.name.trim()} – ${t('pondSetup.cropSuffix')}`,
                status: 'active',
                stockingDate: toISODate(form.stockingDate),
                stockingCount,
                stockingDensity: density,
                speciesId: form.speciesId ?? undefined,
                speciesType: form.speciesId ? speciesLabels[form.speciesId] : undefined,
                broodstockId: form.strainId ?? undefined,
                hatcheryId: form.hatcheryId ?? undefined,
            });

            // Crop succeeded — this pond's pending state is done with, clear it before
            // moving to (or resetting for) the next pond in the loop.
            pendingPondIdRef.current = null;
            pendingAreaRef.current = null;

            if (index === 0 && copyToAll && totalPonds > 1) {
                // Pond 1 is saved; replicate its exact setup for ponds 2..N
                // (same shape/size/species/stocking, distinct name/pondCode —
                // the backend's per-prefix sequence numbering handles that).
                try {
                    const baseName = form.name.trim();
                    for (let i = 1; i < totalPonds; i++) {
                        await createOnePondAndCrop(`${baseName} ${i + 1}`);
                    }
                    finish();
                } catch {
                    Alert.alert(
                        t('common.error'),
                        t(
                            'pondSetup.errCopyToAll',
                            'Pond 1 was saved, but copying it to the rest failed partway through. Set up the remaining ponds one at a time.',
                        ),
                    );
                    setCopyToAll(false);
                    setIndex(1);
                    setForm(emptyForm());
                    setErrors({});
                    scrollRef.current?.scrollTo({ y: 0, animated: false });
                }
            } else if (index >= totalPonds - 1) {
                finish();
            } else {
                setIndex((i) => i + 1);
                setForm(emptyForm());
                setErrors({});
                scrollRef.current?.scrollTo({ y: 0, animated: false });
            }
        } catch (err: any) {
            const message = pendingPondIdRef.current
                ? t('pondSetup.errSaveCropRetry', 'Pond was created but saving the crop failed. Tap Save again to retry with the same pond.')
                : apiErrorMessage(err, t('pondSetup.errSave'));
            Alert.alert(t('common.error'), message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingRef) {
        return (
            <ScreenWrapper scroll={false}>
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    // "Copy to all" on Pond 1 finishes the whole batch in one tap, so the
    // button must say Finish rather than Save & Next in that state.
    const isLast = index >= totalPonds - 1 || (index === 0 && copyToAll && totalPonds > 1);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {/* Progress header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    {/* Only before Pond 1 is saved. Once index > 0 the previous
                        pond(s) in this batch already exist server-side — an
                        arrow here would read as "undo", and it can't. "Finish
                        Later" is the exit at every step instead. */}
                    {index === 0 ? (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            hitSlop={8}
                            style={styles.backBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.back')}
                        >
                            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.roles.light.textPrimary} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.backBtn} />
                    )}
                    <Text style={styles.stepText}>
                        {t('pondSetup.stepCounter', { current: index + 1, total: totalPonds })}
                    </Text>
                    <TouchableOpacity onPress={finish} hitSlop={8}>
                        <Text style={styles.skipText}>{t('pondSetup.finishLater')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.dotsRow}>
                    {Array.from({ length: totalPonds }).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                i < index && styles.dotDone,
                                i === index && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>{t('pondSetup.sectionPond')}</Text>
                <Text style={styles.sectionWhy}>{t('pondSetup.whyPond', 'Shape and size let us calculate area, stocking capacity, and dosage amounts for you.')}</Text>

                <Input
                    label={t('pondSetup.fieldName')}
                    value={form.name}
                    onChangeText={(v) => set({ name: v })}
                    placeholder={t('pondSetup.placeholderName')}
                    error={errors.name}
                    autoCapitalize="characters"
                    required
                />

                {/* Geometry */}
                <Text style={styles.fieldLabel}>{t('pondSetup.fieldGeometry')}</Text>
                <View style={styles.geomRow}>
                    {GEOMETRIES.map((g) => {
                        const active = form.geometry === g.key;
                        return (
                            <TouchableOpacity
                                key={g.key}
                                style={[styles.geomChip, active && styles.geomChipActive]}
                                onPress={() => set({ geometry: g.key })}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name={g.icon}
                                    size={18}
                                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                />
                                <Text style={[styles.geomLabel, active && { color: theme.roles.light.primary }]}>
                                    {t(`pondSetup.geom_${g.key}`)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Dimensions by geometry */}
                {form.geometry === 'circular' ? (
                    <Input
                        label={t('pondSetup.fieldDiameter')}
                        value={form.diameterM}
                        onChangeText={(v) => set({ diameterM: v })}
                        placeholder="0.0"
                        keyboardType="decimal-pad"
                        error={errors.diameterM}
                        required
                    />
                ) : (
                    <View style={styles.twoCol}>
                        <View style={styles.col}>
                            <Input
                                label={t('pondSetup.fieldLength')}
                                value={form.lengthM}
                                onChangeText={(v) => set({ lengthM: v })}
                                placeholder="0.0"
                                keyboardType="decimal-pad"
                                error={errors.lengthM}
                                required
                            />
                        </View>
                        <View style={styles.col}>
                            <Input
                                label={t('pondSetup.fieldWidth')}
                                value={form.widthM}
                                onChangeText={(v) => set({ widthM: v })}
                                placeholder="0.0"
                                keyboardType="decimal-pad"
                                error={errors.widthM}
                                required
                            />
                        </View>
                    </View>
                )}

                <Input
                    label={t('pondSetup.fieldDepth')}
                    value={form.depthM}
                    onChangeText={(v) => set({ depthM: v })}
                    placeholder="0.5 – 5.0"
                    keyboardType="decimal-pad"
                    error={errors.depthM || errors.area}
                    required
                />

                {previewArea !== null && (
                    <Text style={styles.areaPreview}>
                        {t('pondSetup.areaPreview', { area: previewArea.toFixed(1) })}
                    </Text>
                )}

                <Text style={styles.sectionTitle}>{t('pondSetup.sectionCulture')}</Text>
                <Text style={styles.sectionWhy}>{t('pondSetup.whyCulture', 'Species, stocking date and density drive every growth, feed, and harvest-timing recommendation the app gives you for this pond.')}</Text>

                <SelectField
                    label={t('pondSetup.fieldSpecies')}
                    value={form.speciesId}
                    options={speciesOpts}
                    placeholder={t('pondSetup.selectSpecies')}
                    onSelect={(v) => set({ speciesId: v })}
                    error={errors.speciesId}
                    required={speciesOpts.length > 0}
                    leftIcon="fish"
                />

                <SelectField
                    label={t('pondSetup.fieldStrain')}
                    value={form.strainId}
                    options={strainOpts}
                    placeholder={t('pondSetup.selectStrain')}
                    onSelect={(v) => set({ strainId: v })}
                    error={errors.strainId}
                    required={strainOpts.length > 0}
                    leftIcon="dna"
                />

                <SelectField
                    label={t('pondSetup.fieldHatchery')}
                    value={form.hatcheryId}
                    options={hatcheryOpts}
                    placeholder={t('pondSetup.selectHatchery')}
                    onSelect={(v) => set({ hatcheryId: v })}
                    error={errors.hatcheryId}
                    required={hatcheryOpts.length > 0}
                    leftIcon="home-variant-outline"
                />

                <Input
                    label={t('pondSetup.fieldDensity')}
                    value={form.stockingDensity}
                    onChangeText={(v) => set({ stockingDensity: v })}
                    placeholder={t('pondSetup.placeholderDensity')}
                    keyboardType="decimal-pad"
                    error={errors.stockingDensity}
                    hint={t('pondSetup.densityHint')}
                    required
                />

                <CalendarPicker
                    label={t('pondSetup.fieldStartDate')}
                    value={form.stockingDate}
                    onChange={(d) => set({ stockingDate: d })}
                    maxDate={startOfDay(new Date())}
                    required
                    helperText={t('pondSetup.docHelper', { day: dayOfCulture(form.stockingDate) })}
                />

                <Text style={styles.sectionTitle}>{t('pondSetup.sectionAeration')}</Text>
                <Text style={styles.sectionWhy}>{t('pondSetup.whyAeration', 'Optional, but the Aeration engine uses this to check adequacy and estimate power cost — you can skip it and add it later.')}</Text>

                <View style={styles.twoCol}>
                    <View style={styles.col}>
                        <Input
                            label={t('pondSetup.fieldAeratorCount')}
                            value={form.aeratorCount}
                            onChangeText={(v) => set({ aeratorCount: v })}
                            placeholder="0"
                            keyboardType="number-pad"
                            error={errors.aeratorCount}
                        />
                    </View>
                    <View style={styles.col}>
                        <Input
                            label={t('pondSetup.fieldHpPerAerator')}
                            value={form.hpPerAerator}
                            onChangeText={(v) => set({ hpPerAerator: v })}
                            placeholder="0.0"
                            keyboardType="decimal-pad"
                            error={errors.hpPerAerator}
                        />
                    </View>
                </View>
                {!!form.aeratorCount && !!form.hpPerAerator && (
                    <Text style={styles.areaPreview}>
                        {t('pondSetup.totalHp', {
                            hp: (parseInt(form.aeratorCount, 10) * parseFloat(form.hpPerAerator) || 0).toFixed(1),
                        })}
                    </Text>
                )}

                {/* Only offered while filling in Pond 1 of a multi-pond batch —
                    most farms have several near-identical ponds, so this skips
                    re-entering the same shape/size/species/stocking totalPonds times. */}
                {index === 0 && totalPonds > 1 && (
                    <TouchableOpacity
                        style={styles.copyToAllRow}
                        onPress={() => setCopyToAll((v) => !v)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: copyToAll }}
                    >
                        <MaterialCommunityIcons
                            name={copyToAll ? 'checkbox-marked' : 'checkbox-blank-outline'}
                            size={22}
                            color={copyToAll ? theme.roles.light.primary : theme.roles.light.textSecondary}
                        />
                        <Text style={styles.copyToAllLabel}>
                            {t('pondSetup.copyToAllLabel', {
                                count: totalPonds,
                                defaultValue: 'Use these same details for all {{count}} ponds',
                            })}
                        </Text>
                    </TouchableOpacity>
                )}

                <Button
                    title={isLast ? t('pondSetup.finishSetup') : t('pondSetup.saveAndNext')}
                    onPress={handleSaveStep}
                    loading={submitting}
                    style={styles.saveBtn}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[3],
        paddingBottom: theme.spacing[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backBtn: { width: 32, height: 32, justifyContent: 'center' },
    stepText: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    skipText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary },
    dotsRow: { flexDirection: 'row', gap: theme.spacing[1], marginTop: theme.spacing[3] },
    dot: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.roles.light.borderDefault,
    },
    dotDone: { backgroundColor: theme.roles.light.primary },
    dotActive: { backgroundColor: theme.roles.light.primary },
    body: { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[8] },
    sectionTitle: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textBrand,
        textTransform: 'uppercase',
        marginBottom: theme.spacing[1],
        marginTop: theme.spacing[2],
    },
    sectionWhy: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    fieldLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    geomRow: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    geomChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[1],
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    geomChipActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
    geomLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
    twoCol: { flexDirection: 'row', gap: theme.spacing[3] },
    col: { flex: 1 },
    areaPreview: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: -theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    copyToAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginTop: theme.spacing[5],
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    copyToAllLabel: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    saveBtn: { marginTop: theme.spacing[5] },
});
