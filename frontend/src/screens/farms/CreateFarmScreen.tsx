/**
 * CreateFarmScreen — artboard 05, "Your farm", step 1 of 2.
 *
 * The farm is no longer created here. Artboard 06 ends with "Create farm", so
 * the write happens there, once, after the ponds have been named — otherwise
 * backing out of step 2 would leave an orphan farm behind and the step-2 button
 * would be lying about what it does. This screen collects a draft and hands it
 * forward.
 *
 * Step 2 only exists when there are ponds to name. Declaring zero ponds makes
 * this the whole flow, so the step indicator disappears (rather than reading
 * "Step 1 of 2" with no step 2) and the button saves the farm directly.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmsApi, type CreateFarmDto } from '../../api/farms';
import { apiErrorMessage } from '../../api/errors';
import { useMembershipStore } from '../../store/membershipStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const WATER_SOURCES: { key: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'tidal', icon: 'waves' },
    { key: 'river', icon: 'wave' },
    { key: 'borehole', icon: 'pipe' },
    { key: 'reservoir', icon: 'water' },
    { key: 'recycled', icon: 'recycle' },
];

/**
 * The same screen edits a farm.
 *
 * Passed an `editFarmId`, it loads that farm, prefills every field, retitles
 * itself and PATCHes instead of POSTing. Two screens over one form would have
 * meant two sets of validation and two places for the water-source list to
 * drift; the fields a farmer may change are exactly the fields they were asked
 * for in the first place.
 *
 * The pond-count step is creation-only: it names new ponds, and a farm that
 * already has ponds is not the place to ask for more.
 */
export const CreateFarmScreen = ({ navigation, route }: any) => {
    const editFarmId: string | undefined = route?.params?.editFarmId;
    const isEdit = !!editFarmId;
    const { t } = useTranslation();
    const pendingFarmSetup = useAuthStore((s) => s.pendingFarmSetup);
    const completeFarmSetup = useAuthStore((s) => s.completeFarmSetup);
    const showToast = useUIStore((s) => s.showToast);
    // How many farms they already have. Drives the design's "YOUR 4TH FARM"
    // eyebrow and the reassurance line at the bottom.
    const memberships = useMembershipStore((st) => st.memberships);
    const existingFarmCount = memberships.length;

    const [name, setName] = useState('');
    const [numPonds, setNumPonds] = useState(0);
    const [address, setAddress] = useState('');
    const [totalArea, setTotalArea] = useState('');
    const [waterSource, setWaterSource] = useState<string | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locating, setLocating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; numPonds?: string }>({});
    // Edit mode blocks on the load: a form that paints empty and fills in a
    // moment later invites a farmer to type over their own data.
    const [isHydrating, setIsHydrating] = useState(isEdit);

    useEffect(() => {
        if (!editFarmId) return;
        let cancelled = false;
        farmsApi
            .getById(editFarmId)
            .then(({ data }) => {
                if (cancelled) return;
                setName(data.name ?? '');
                setAddress(data.address ?? '');
                setTotalArea(data.areaHectares != null ? String(data.areaHectares) : '');
                setWaterSource(data.waterSourceType ?? null);
                if (data.latitude != null && data.longitude != null) {
                    setCoords({ lat: data.latitude, lng: data.longitude });
                }
            })
            .catch(() => {
                Alert.alert(t('common.error'), t('farms.errorLoadFarm'));
                navigation.goBack();
            })
            .finally(() => { if (!cancelled) setIsHydrating(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editFarmId]);

    // Naming new ponds is a creation step; an existing farm adds ponds elsewhere.
    const hasPondStep = !isEdit && numPonds >= 1;

    // First-run owners were hard-gated into this screen with no way out — an
    // owner who wanted to look around first was stuck on a mandatory form. Give
    // them an explicit escape that clears the gate and drops them into the app;
    // the Getting-Started checklist on Home still nudges them back to finish.
    const skipSetup = () => {
        completeFarmSetup();
        navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
    };

    const detectLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('farms.locationDeniedTitle'), t('farms.locationDeniedMsg'));
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
            Alert.alert(t('common.error'), t('farms.locationError'));
        } finally {
            setLocating(false);
        }
    };

    /** The draft as the API wants it — built once, used by both exits below. */
    const buildDraft = (): CreateFarmDto => ({
        name: name.trim(),
        address: address.trim() || undefined,
        areaHectares: totalArea ? parseFloat(totalArea) : undefined,
        waterSourceType: waterSource ?? undefined,
        plannedPondCount: numPonds >= 1 ? numPonds : undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
    });

    const handleContinue = async () => {
        const nextErrors: { name?: string; numPonds?: string } = {};
        if (!name.trim()) nextErrors.name = t('farms.errorFarmRequired');
        // Pond count is mandatory during first-run owner setup; optional otherwise.
        if (pendingFarmSetup && numPonds < 1) {
            nextErrors.numPonds = t('farms.errorPondCountRequired');
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }
        setErrors({});

        if (hasPondStep) {
            // Step 2 owns the write — see the header comment.
            navigation.navigate('PondNames', { farm: buildDraft(), pondCount: numPonds });
            return;
        }

        setIsLoading(true);
        try {
            if (isEdit) {
                // Only the fields this form owns. PATCHing the whole draft
                // would send plannedPondCount: undefined and quietly clear a
                // figure this screen never shows in edit mode.
                const { plannedPondCount, ...editable } = buildDraft();
                await farmsApi.update(editFarmId!, editable);
                showToast({ message: t('farms.farmSavedToast', { name: name.trim() }), type: 'success' });
                navigation.goBack();
                return;
            }
            // No ponds declared: this is the entire flow, so save here.
            await farmsApi.create(buildDraft());
            showToast({
                message: t('farms.farmCreatedToast', { name: name.trim(), defaultValue: '{{name}} created' }),
                type: 'success',
            });
            if (pendingFarmSetup) completeFarmSetup();
            navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
        } catch (error: any) {
            Alert.alert(
                t('common.error'),
                apiErrorMessage(error, t(isEdit ? 'farms.errorSaveFarm' : 'farms.errorCreateFarm')),
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={isEdit ? name || null : existingFarmCount > 0 ? t('farms.yourNthFarm', { n: existingFarmCount + 1 }) : null}
                title={isEdit ? t('farms.editFarmTitle') : t('farms.stepFarmTitle')}
                onBack={pendingFarmSetup ? undefined : () => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                // During the first-run gate there is nothing to go back TO, so
                // the escape is a labelled action, not an arrow.
                actionLabel={pendingFarmSetup ? t('farms.setupLater') : undefined}
                onAction={pendingFarmSetup ? skipSetup : undefined}
                trailing={hasPondStep ? t('farms.stepOfTwo', { n: 1 }) : undefined}
            />

            {hasPondStep && (
                <View style={styles.progress} accessibilityRole="progressbar">
                    <View style={[styles.progressSeg, styles.progressDone]} />
                    <View style={styles.progressSeg} />
                </View>
            )}

            {isHydrating ? (
                <View style={styles.hydrating}>
                    <ActivityIndicator color={theme.roles.light.primary} />
                </View>
            ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Input
                    label={t('farms.fieldFarmName')}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('farms.farmNamePlaceholder')}
                    error={errors.name}
                    required
                />

                <Input
                    label={t('farms.fieldAreaHectares')}
                    value={totalArea}
                    onChangeText={setTotalArea}
                    placeholder="0.0"
                    keyboardType="decimal-pad"
                    hint={t('farms.areaHint')}
                />

                {!isEdit && (<>{/* A stepper, not a keyboard. Pond count is a small whole
                    number and the farmer is often outdoors — the design shows
                    − / + controls, and Stepper already implements them to the
                    44dp tap-target rule. */}
                <Stepper
                    label={t('farms.fieldPondCount')}
                    value={numPonds}
                    onChange={setNumPonds}
                    min={0}
                    max={200}
                />
                <Text style={styles.hint}>
                    {hasPondStep ? t('farms.pondsNamedHint', { last: numPonds }) : t('farms.pondsLaterHint')}
                </Text>
                {errors.numPonds ? <Text style={styles.fieldError}>{errors.numPonds}</Text> : null}</>)}

                {/* GPS location — unlocks weather, lunar tides & regional pricing. */}
                <Text style={styles.fieldLabel}>{t('farms.fieldLocation')}</Text>
                <TouchableOpacity
                    style={styles.locationBtn}
                    onPress={detectLocation}
                    activeOpacity={0.8}
                    disabled={locating}
                    accessibilityRole="button"
                    accessibilityLabel={t('farms.useCurrentLocation')}
                    accessibilityState={{ disabled: locating, busy: locating }}
                >
                    <Icon
                        name="location_on"
                        size={20}
                        color={theme.roles.light.primary}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                        {locating
                            ? t('farms.locating')
                            : coords
                                ? t('farms.locationCaptured', { lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) })
                                : t('farms.useCurrentLocation')}
                    </Text>
                </TouchableOpacity>
                {/* The design shows a map preview slot. There is no map widget in
                    the app yet, so the slot states what it is waiting for instead
                    of rendering an empty grey rectangle that looks broken. */}
                {!coords && (
                    <View style={styles.mapSlot}>
                        <Text style={styles.mapSlotText}>{t('farms.mapPlaceholder')}</Text>
                    </View>
                )}

                <Input
                    label={t('farms.fieldAddress')}
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('farms.placeholderAddress')}
                />

                {/* Water source — context for water-exchange & quality advice. */}
                <Text style={styles.fieldLabel}>{t('farms.fieldWaterSource')}</Text>
                <View style={styles.sourceRow}>
                    {WATER_SOURCES.map((s) => {
                        const active = waterSource === s.key;
                        return (
                            <TouchableOpacity
                                key={s.key}
                                style={[styles.sourceChip, active && styles.sourceChipActive]}
                                onPress={() => setWaterSource(active ? null : s.key)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={t(`farms.water_${s.key}`)}
                                accessibilityState={{ selected: active }}
                            >
                                <MaterialCommunityIcons
                                    name={s.icon}
                                    size={16}
                                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                />
                                <Text numberOfLines={1} style={[styles.sourceLabel, active && { color: theme.roles.light.primary }]}>
                                    {t(`farms.water_${s.key}`)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* The farm code is created with the farm — say so here rather
                    than letting the owner discover it on the members screen. */}
                <View style={styles.noteCard}>
                    <Icon name="key" size={20} color={theme.roles.light.primary} />
                    <Text style={styles.noteText}>{t('farms.farmCodeNote')}</Text>
                </View>

                {/* T3.15 — the plan asked for a "confirmation step" on farm
                    creation to discourage junk farms. The design answers it as
                    a reassurance LINE, not a modal: the worry it addresses is
                    "will this replace or affect my existing farms?", and a
                    confirm dialog would add friction without answering that. */}
                {!isEdit && (
                    <Text style={styles.reassurance}>
                    {existingFarmCount > 0
                        ? t('farms.stayOwnerWithOthers', { count: existingFarmCount })
                        : t('farms.stayOwner')}
                </Text>
                )}
            </ScrollView>
            )}

            <View style={styles.footer}>
                <Button
                    title={hasPondStep ? t('common.continue') : isEdit ? t('common.save') : t('farms.saveFarm')}
                    onPress={handleContinue}
                    loading={isLoading}
                />
            </View>
        </ScreenWrapper>
    );
};


const styles = StyleSheet.create({
    hydrating: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    hint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[4] },
    fieldError: { ...theme.typeScale.bodySmall, color: theme.roles.light.dangerText, marginBottom: theme.spacing[2] },
    noteCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3],
        padding: theme.spacing[4], borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.infoBg, marginBottom: theme.spacing[3],
    },
    noteText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.infoText, flex: 1 },
    reassurance: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
    },
    fieldLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
        marginBottom: theme.spacing[2],
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        minHeight: 48,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderStrong,
        backgroundColor: theme.roles.light.surface,
    },
    locationText: { ...theme.typeScale.labelLarge, color: theme.roles.light.textBrand, flex: 1 },
    mapSlot: {
        height: 96,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    mapSlotText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[6] },
    sourceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        minHeight: 44,
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    sourceChipActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.infoBg },
    sourceLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary, flexShrink: 1 },
    footer: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
    },
});
