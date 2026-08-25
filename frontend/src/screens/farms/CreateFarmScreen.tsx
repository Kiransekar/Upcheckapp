import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { Icon } from '../../components/ui/Icon';
import { LanguagePill } from '../../components/ui/LanguagePill';
import { theme } from '../../theme';
import { farmsApi } from '../../api/farms';
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

export const CreateFarmScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const pendingFarmSetup = useAuthStore((s) => s.pendingFarmSetup);
    const completeFarmSetup = useAuthStore((s) => s.completeFarmSetup);
    const showToast = useUIStore((s) => s.showToast);
    // How many farms they already have. Drives the design's "YOUR 4TH FARM"
    // eyebrow and the reassurance line at the bottom.
    const memberships = useMembershipStore((st) => st.memberships);
    const existingFarmCount = memberships.length;

    const [name, setName] = useState('');
    const [numPonds, setNumPonds] = useState('');
    const [address, setAddress] = useState('');
    const [totalArea, setTotalArea] = useState('');
    const [waterSource, setWaterSource] = useState<string | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locating, setLocating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; numPonds?: string }>({});

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

    const handleSave = async () => {
        const nextErrors: { name?: string; numPonds?: string } = {};
        if (!name.trim()) nextErrors.name = t('farms.errorFarmRequired');
        const ponds = parseInt(numPonds, 10);
        // Pond count is mandatory during first-run owner setup; optional otherwise.
        if (pendingFarmSetup && (!numPonds || isNaN(ponds) || ponds < 1)) {
            nextErrors.numPonds = t('farms.errorPondCountRequired');
        } else if (numPonds && (isNaN(ponds) || ponds < 1)) {
            nextErrors.numPonds = t('farms.errorPondCountRequired');
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }
        setErrors({});
        setIsLoading(true);

        try {
            const res = await farmsApi.create({
                name: name.trim(),
                address: address.trim() || undefined,
                areaHectares: totalArea ? parseFloat(totalArea) : undefined,
                waterSourceType: waterSource ?? undefined,
                plannedPondCount: numPonds ? ponds : undefined,
                latitude: coords?.lat,
                longitude: coords?.lng,
            });
            showToast({
                message: t('farms.farmCreatedToast', { name: name.trim(), defaultValue: '{{name}} created' }),
                type: 'success',
            });
            const newFarmId = res.data?.id;
            if (pendingFarmSetup) {
                // First-run owner: clear the gate, then walk them through pond setup
                // for each declared pond. MainApp sits underneath so backing out or
                // "finish later" lands them in the app.
                completeFarmSetup();
                if (newFarmId && numPonds && ponds >= 1) {
                    navigation.reset({
                        index: 1,
                        routes: [
                            { name: 'MainApp' },
                            { name: 'PondSetup', params: { farmId: newFarmId, totalPonds: ponds } },
                        ],
                    });
                } else {
                    navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
                }
            } else if (newFarmId && numPonds && ponds >= 1) {
                // Bug: entering a pond count here previously did nothing — the count
                // was saved on the farm as a target (plannedPondCount) but no Pond
                // rows were ever created, so Farm Detail showed no ponds at all.
                // Route straight into the same per-pond setup wizard the first-run
                // flow already uses above, pre-filled to the declared count, instead
                // of fabricating placeholder ponds with made-up dimensions.
                navigation.navigate('PondSetup', { farmId: newFarmId, totalPonds: ponds });
            } else {
                navigation.goBack();
            }
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.message || t('farms.errorCreateFarm'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.formContainer}>
                {/* Persistent top bar: an exit affordance (a back arrow normally,
                    or a "Set up later" escape during the first-run gate) plus a
                    language switch — this is the screen the standard email-owner
                    flow lands on, so it must offer language selection here too,
                    not only on the pre-auth screens. */}
                <View style={styles.topBar}>
                    {pendingFarmSetup ? (
                        <TouchableOpacity
                            onPress={skipSetup}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('farms.setupLater')}
                        >
                            <Text style={styles.skipText}>{t('farms.setupLater')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.back', 'Back')}
                            style={styles.backBtn}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={26} color={theme.roles.light.textPrimary} />
                        </TouchableOpacity>
                    )}
                    <LanguagePill />
                </View>

                <View style={styles.setupHeader}>
                    {existingFarmCount > 0 && (
                        <Text style={styles.eyebrow}>
                            {t('farms.yourNthFarm', { n: existingFarmCount + 1 })}
                        </Text>
                    )}
                    <Text style={styles.setupTitle}>
                        {pendingFarmSetup ? t('farms.setupTitle') : t('farms.createFarmTitle')}
                    </Text>
                    {pendingFarmSetup && (
                        <Text style={styles.setupSubtitle}>{t('farms.setupSubtitle')}</Text>
                    )}
                </View>

                <Input
                    label={t('farms.fieldFarmName')}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('farms.placeholderFarmName')}
                    error={errors.name}
                    required
                />

                {/* A stepper, not a keyboard. Pond count is a small whole
                    number and the farmer is often outdoors — the design shows
                    − / + controls, and Stepper already implements them to the
                    44dp tap-target rule. */}
                <View style={styles.pondSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>{t('farms.pondsSection')}</Text>
                        <View style={styles.sectionRule} />
                    </View>
                    <Stepper
                        label={t('farms.createPondsNow')}
                        value={Number(numPonds) || 0}
                        onChange={(v) => setNumPonds(String(v))}
                        min={0}
                        max={200}
                    />
                    <Text style={styles.pondHint}>
                        {Number(numPonds) > 0
                            ? t('farms.pondsNamedHint', { last: Number(numPonds) })
                            : t('farms.pondsLaterHint')}
                    </Text>
                    {errors.numPonds ? <Text style={styles.fieldError}>{errors.numPonds}</Text> : null}
                </View>

                <Input
                    label={t('farms.fieldAddress')}
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('farms.placeholderAddress')}
                />

                <Input
                    label={t('farms.fieldArea')}
                    value={totalArea}
                    onChangeText={setTotalArea}
                    placeholder="0.0"
                    keyboardType="decimal-pad"
                />

                {/* GPS location — unlocks weather, lunar tides & regional pricing. */}
                <Text style={styles.fieldLabel}>{t('farms.fieldLocation')}</Text>
                <TouchableOpacity
                    style={styles.locationBtn}
                    onPress={detectLocation}
                    activeOpacity={0.8}
                    disabled={locating}
                    accessibilityRole="button"
                    accessibilityLabel={t('farms.detectLocation')}
                    accessibilityState={{ disabled: locating, busy: locating }}
                >
                    <MaterialCommunityIcons
                        name={coords ? 'map-marker-check' : 'crosshairs-gps'}
                        size={20}
                        color={theme.roles.light.primary}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                        {locating
                            ? t('farms.locating')
                            : coords
                                ? t('farms.locationCaptured', { lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) })
                                : t('farms.detectLocation')}
                    </Text>
                </TouchableOpacity>

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
                <Text style={styles.reassurance}>
                    {existingFarmCount > 0
                        ? t('farms.stayOwnerWithOthers', { count: existingFarmCount })
                        : t('farms.stayOwner')}
                </Text>

                <Button
                    title={t('farms.saveFarm')}
                    onPress={handleSave}
                    loading={isLoading}
                    style={styles.saveBtn}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    eyebrow: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
        letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600',
        marginBottom: theme.spacing[1],
    },
    pondSection: { marginBottom: theme.spacing[4], gap: theme.spacing[2] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    sectionLabel: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
        letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600',
    },
    sectionRule: { flex: 1, height: 1, backgroundColor: theme.roles.light.borderDefault },
    pondHint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    fieldError: { ...theme.typeScale.bodySmall, color: theme.roles.light.dangerText },
    noteCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3],
        padding: theme.spacing[4], borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.infoBg, marginBottom: theme.spacing[3],
    },
    noteText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.infoText, flex: 1 },
    reassurance: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary,
        marginBottom: theme.spacing[3],
    },
    formContainer: {
        paddingTop: theme.spacing[4],
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[3],
        minHeight: 32,
    },
    backBtn: { marginLeft: -theme.spacing[2] },
    skipText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textSecondary,
        fontWeight: '600',
    },
    setupHeader: {
        marginBottom: theme.spacing[4],
    },
    setupTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
    },
    setupSubtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[1],
    },
    fieldLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[2],
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    locationText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
    sourceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    sourceChipActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
    sourceLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary, flexShrink: 1 },
    saveBtn: {
        marginTop: theme.spacing[6],
    },
});
