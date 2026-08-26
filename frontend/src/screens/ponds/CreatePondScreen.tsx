import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { theme } from '../../theme';
import { pondsApi } from '../../api/ponds';

type GeometryType = 'rectangular' | 'circular' | 'irregular' | 'raceway';
type ConstructionType = 'earthen' | 'lined' | 'cage' | 'biofloc_ras';

// Derive a 1–4 char alphanumeric prefix (backend naming requirement) from the
// free-form pond name — same helper as PondSetupScreen (onboarding), so a
// farmer never has to understand or type this internal grouping code
// themselves; only the meaningful display name is ever asked for.
const derivePrefix = (name: string) => {
    const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return alnum.slice(0, 4) || 'P';
};

export const CreatePondScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName, pondCount } = route.params;

    // Per-farm draft key so an interrupted farmer (call, app kill, network drop)
    // doesn't lose their in-progress pond. Only plain text/selection fields are
    // persisted — never derived/computed values.
    const draftKey = farmId
        ? `@upcheck:draft:createPond:${farmId}`
        : '@upcheck:draft:createPond';

    const CONSTRUCTION_TYPES: { value: ConstructionType; label: string; icon: string }[] = [
        { value: 'earthen', label: t('ponds.constructionEarthen'), icon: 'terrain' },
        { value: 'lined', label: t('ponds.constructionLined'), icon: 'texture-box' },
        { value: 'cage', label: t('ponds.constructionCage'), icon: 'cube-outline' },
        { value: 'biofloc_ras', label: t('ponds.constructionBioflocRas'), icon: 'recycle' },
    ];
    const [geometryType, setGeometryType] = useState<GeometryType>('rectangular');
    const [constructionType, setConstructionType] = useState<ConstructionType>('earthen');
    const [lengthM, setLengthM] = useState('');
    const [widthM, setWidthM] = useState('');
    const [diameterM, setDiameterM] = useState('');
    const [depthM, setDepthM] = useState('');
    const [installedAeratorHp, setInstalledAeratorHp] = useState('');
    const [aeratorCount, setAeratorCount] = useState('');
    const [displayName, setDisplayName] = useState('');

    const [overrideAreaM2, setOverrideAreaM2] = useState('');
    const [showOverride, setShowOverride] = useState(false);

    const [computedArea, setComputedArea] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ displayName?: string; depthM?: string }>({});
    const [draftHydrated, setDraftHydrated] = useState(false);

    // Restore a saved draft once on mount. Corrupt drafts are ignored.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(draftKey);
                if (raw && !cancelled) {
                    const d = JSON.parse(raw);
                    if (typeof d.displayName === 'string') setDisplayName(d.displayName);
                    if (typeof d.geometryType === 'string') setGeometryType(d.geometryType);
                    if (typeof d.constructionType === 'string') setConstructionType(d.constructionType);
                    if (typeof d.lengthM === 'string') setLengthM(d.lengthM);
                    if (typeof d.widthM === 'string') setWidthM(d.widthM);
                    if (typeof d.diameterM === 'string') setDiameterM(d.diameterM);
                    if (typeof d.depthM === 'string') setDepthM(d.depthM);
                    if (typeof d.installedAeratorHp === 'string') setInstalledAeratorHp(d.installedAeratorHp);
                }
            } catch {
                // Ignore a corrupt/unreadable draft.
            } finally {
                if (!cancelled) setDraftHydrated(true);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    // Persist the draft on every change (only after the initial hydrate, so we
    // never overwrite a stored draft with the empty initial state).
    useEffect(() => {
        if (!draftHydrated) return;
        AsyncStorage.setItem(
            draftKey,
            JSON.stringify({
                displayName,
                geometryType,
                constructionType,
                lengthM,
                widthM,
                diameterM,
                depthM,
                installedAeratorHp,
            }),
        ).catch(() => { /* best-effort; non-fatal */ });
    }, [draftHydrated, draftKey, displayName, geometryType, constructionType, lengthM, widthM, diameterM, depthM, installedAeratorHp]);

    useEffect(() => {
        let area = 0;
        if (geometryType === 'rectangular' || geometryType === 'raceway') {
            const l = parseFloat(lengthM) || 0;
            const w = parseFloat(widthM) || 0;
            area = l * w;
        } else if (geometryType === 'circular') {
            const d = parseFloat(diameterM) || 0;
            const r = d / 2;
            area = Math.PI * r * r;
        }
        // A surveyed figure is a measurement of the real pond; the calculated
        // one is a rectangle's worth of arithmetic. Where both exist the survey
        // wins, because every stocking and dosing figure downstream reads it.
        const surveyed = parseFloat(overrideAreaM2) || 0;
        setComputedArea(surveyed > 0 ? surveyed : area);
    }, [geometryType, lengthM, widthM, diameterM, overrideAreaM2]);

    // Derived from the same inputs — no extra state to drift out of sync.
    const depthNum = parseFloat(depthM) || 0;
    const volumeM3 = computedArea * depthNum;
    const hectares = computedArea / 10_000;
    // Aeration intensity is the number farmers actually judge a pond by, and
    // it is meaningless until BOTH inputs are present — null, not 0, so the
    // line is absent rather than reading a confident "0 HP/ha".
    const hpNum = parseFloat(installedAeratorHp) || 0;
    const hpPerHa = hpNum > 0 && hectares > 0 ? hpNum / hectares : null;

    const handleSave = async () => {
        const newErrors: { displayName?: string; depthM?: string } = {};
        if (!displayName.trim()) {
            newErrors.displayName = t('ponds.errorDisplayName', 'Pond name is required');
        }
        if (!depthM || parseFloat(depthM) < 0.5 || parseFloat(depthM) > 5.0) {
            newErrors.depthM = t('ponds.errorDepth');
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setIsLoading(true);

        try {
            await pondsApi.create({
                farmId,
                namePrefix: derivePrefix(displayName),
                geometryType,
                constructionType,
                lengthM: (geometryType === 'rectangular' || geometryType === 'raceway') && lengthM ? parseFloat(lengthM) : undefined,
                widthM: (geometryType === 'rectangular' || geometryType === 'raceway') && widthM ? parseFloat(widthM) : undefined,
                diameterM: geometryType === 'circular' && diameterM ? parseFloat(diameterM) : undefined,
                depthM: parseFloat(depthM),
                overrideAreaM2: parseFloat(overrideAreaM2) > 0 ? parseFloat(overrideAreaM2) : undefined,
                installedAeratorHp: installedAeratorHp ? parseFloat(installedAeratorHp) : undefined,
                aeratorCount: aeratorCount ? parseInt(aeratorCount, 10) : undefined,
                displayName: displayName.trim(),
            });
            // Pond saved — discard the draft so it isn't restored next time.
            await AsyncStorage.removeItem(draftKey);
            navigation.goBack();
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.message || t('ponds.errorCreatePond'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={
                    [farmName, pondCount != null ? t('ponds.nthPond', { n: pondCount + 1 }) : null]
                        .filter(Boolean)
                        .join(' · ') || null
                }
                title={t('ponds.addPond')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView contentContainerStyle={styles.content}>
                <Input
                    label={t('ponds.fieldDisplayName')}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t('ponds.placeholderDisplayName')}
                    error={errors.displayName}
                    required
                />

                <Text style={styles.label}>{t('ponds.labelPondShape')}</Text>
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, geometryType === 'rectangular' && styles.toggleActive]}
                        onPress={() => setGeometryType('rectangular')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="rectangle-outline"
                            size={22}
                            color={geometryType === 'rectangular' ? theme.roles.light.primary : theme.roles.light.textSecondary}
                        />
                        <Text style={[styles.toggleText, geometryType === 'rectangular' && styles.toggleTextActive]}>{t('ponds.shapeRect')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, geometryType === 'circular' && styles.toggleActive]}
                        onPress={() => setGeometryType('circular')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="circle-outline"
                            size={22}
                            color={geometryType === 'circular' ? theme.roles.light.primary : theme.roles.light.textSecondary}
                        />
                        <Text style={[styles.toggleText, geometryType === 'circular' && styles.toggleTextActive]}>{t('ponds.shapeCircular')}</Text>
                    </TouchableOpacity>
                    {/*
                      * Irregular is the fourth shape in the design, and the one
                      * that matters most in practice: a great many real ponds
                      * are not rectangles, and without this option their owner
                      * has to pretend otherwise and accept a wrong area. There
                      * is no formula for it, so the surveyed area below becomes
                      * the source instead of an override.
                      */}
                    <TouchableOpacity
                        style={[styles.toggleBtn, geometryType === 'irregular' && styles.toggleActive]}
                        onPress={() => setGeometryType('irregular')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="pentagon-outline"
                            size={22}
                            color={geometryType === 'irregular' ? theme.roles.light.primary : theme.roles.light.textSecondary}
                        />
                        <Text style={[styles.toggleText, geometryType === 'irregular' && styles.toggleTextActive]}>{t('ponds.shapeIrregular')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, geometryType === 'raceway' && styles.toggleActive]}
                        onPress={() => setGeometryType('raceway')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="arrow-right-bold-outline"
                            size={22}
                            color={geometryType === 'raceway' ? theme.roles.light.primary : theme.roles.light.textSecondary}
                        />
                        <Text style={[styles.toggleText, geometryType === 'raceway' && styles.toggleTextActive]}>{t('ponds.shapeRaceway')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t('ponds.labelConstructionType')}</Text>
                <View style={styles.toggleRow}>
                    {CONSTRUCTION_TYPES.map((ct) => (
                        <TouchableOpacity
                            key={ct.value}
                            style={[styles.toggleBtn, constructionType === ct.value && styles.toggleActive]}
                            onPress={() => setConstructionType(ct.value)}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons
                                name={ct.icon as any}
                                size={20}
                                color={constructionType === ct.value ? theme.roles.light.primary : theme.roles.light.textSecondary}
                            />
                            <Text style={[styles.toggleText, constructionType === ct.value && styles.toggleTextActive, { fontSize: 11 }]}>{ct.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {(geometryType === 'rectangular' || geometryType === 'raceway') ? (
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('ponds.fieldLength')} value={lengthM} onChangeText={setLengthM} keyboardType="decimal-pad" placeholder={t('ponds.placeholderDecimal')} />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('ponds.fieldWidth')} value={widthM} onChangeText={setWidthM} keyboardType="decimal-pad" placeholder={t('ponds.placeholderDecimal')} />
                        </View>
                    </View>
                ) : geometryType === 'circular' ? (
                    <Input label={t('ponds.fieldDiameter')} value={diameterM} onChangeText={setDiameterM} keyboardType="decimal-pad" placeholder={t('ponds.placeholderDecimal')} />
                ) : null}

                <Input
                    label={t('ponds.fieldDepth')}
                    value={depthM}
                    onChangeText={setDepthM}
                    keyboardType="decimal-pad"
                    placeholder={t('ponds.placeholderDepth')}
                    error={errors.depthM}
                    required
                />

                {/* Area, volume and hectares together — the design shows all
                    three because a farmer thinks in hectares, stocking maths
                    needs m², and water exchange needs m³. Deriving two of them
                    on a calculator is exactly the friction this removes. */}
                <View style={styles.metricBand}>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{computedArea > 0 ? Math.round(computedArea).toLocaleString() : '0'}</Text>
                        <Text style={styles.metricLabel}>{t('ponds.metricArea')}</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{volumeM3 > 0 ? Math.round(volumeM3).toLocaleString() : '0'}</Text>
                        <Text style={styles.metricLabel}>{t('ponds.metricVolume')}</Text>
                    </View>
                    <View style={styles.metric}>
                        <Text style={styles.metricValue}>{hectares > 0 ? hectares.toFixed(2) : '0.00'}</Text>
                        <Text style={styles.metricLabel}>{t('ponds.metricHectares')}</Text>
                    </View>
                </View>

                <Text style={styles.label}>{t('ponds.fieldAerators')}</Text>
                <View style={styles.aeratorRow}>
                    <View style={{ flex: 1 }}>
                        <Input
                            label={t('ponds.fieldAeratorCount')}
                            value={aeratorCount}
                            onChangeText={setAeratorCount}
                            keyboardType="number-pad"
                            placeholder="0"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Input
                            label={t('ponds.fieldAeratorHp')}
                            value={installedAeratorHp}
                            onChangeText={setInstalledAeratorHp}
                            keyboardType="decimal-pad"
                            placeholder={t('ponds.placeholderAeratorHp')}
                        />
                    </View>
                </View>
                {hpPerHa !== null && (
                    <Text style={styles.aeratorDerived}>
                        {t('ponds.hpPerHa', { value: hpPerHa.toFixed(0) })}
                    </Text>
                )}

                {/*
                  * "Surveyed area is different". The calculated figure is a
                  * rectangle's worth of maths; a survey is a measurement of the
                  * actual pond. Where they disagree the survey wins, and every
                  * stocking and dosing calculation downstream depends on which
                  * number is stored — so this cannot stay a backend-only field.
                  * For an irregular pond it is not an override at all: it is
                  * the only way to state the area.
                  */}
                {geometryType === 'irregular' || showOverride ? (
                    <Input
                        label={t('ponds.fieldSurveyedArea')}
                        value={overrideAreaM2}
                        onChangeText={setOverrideAreaM2}
                        keyboardType="decimal-pad"
                        placeholder={t('ponds.placeholderDecimal')}
                        required={geometryType === 'irregular'}
                    />
                ) : (
                    <TouchableOpacity
                        style={styles.overrideRow}
                        onPress={() => setShowOverride(true)}
                        accessibilityRole="button"
                    >
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.overrideTitle}>{t('ponds.surveyedDifferent')}</Text>
                            <Text style={styles.overrideSub}>{t('ponds.surveyedDifferentSub')}</Text>
                        </View>
                        <Icon name="chevron_right" size={22} color={theme.roles.light.textDisabled} />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* The design pins Create pond to the bottom: the form is longer
                than a screen, and burying the only way to finish under it is
                what made people abandon halfway. */}
            <View style={styles.footer}>
                <Button
                    title={t('ponds.savePond')}
                    onPress={handleSave}
                    loading={isLoading}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    metricBand: {
        flexDirection: 'row', gap: theme.spacing[4],
        padding: theme.spacing[4], borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.infoBg, marginBottom: theme.spacing[4],
    },
    metric: { flex: 1 },
    metricValue: {
        ...theme.typeScale.h2, color: theme.roles.light.infoText,
        fontFamily: 'DMMono-Medium',
    },
    metricLabel: {
        ...theme.typeScale.bodySmall, color: theme.roles.light.infoText,
        letterSpacing: 1, textTransform: 'uppercase',
    },
    aeratorRow: { flexDirection: 'row', gap: theme.spacing[3] },
    aeratorDerived: {
        ...theme.typeScale.bodyMedium, color: theme.roles.light.successText,
        fontWeight: '600', marginBottom: theme.spacing[4],
    },
    overrideRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        paddingVertical: theme.spacing[3],
        minHeight: 48,
    },
    overrideTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    overrideSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    footer: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
    },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    label: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[2],
    },
    toggleRow: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[6],
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.md,
    },
    toggleActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.infoBg,
    },
    toggleText: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
    },
    toggleTextActive: {
        color: theme.roles.light.primary,
    },
    previewCard: {
        alignItems: 'center',
        paddingVertical: theme.spacing[6],
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
    previewLabel: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: 4,
    },
    previewValue: {
        ...theme.typeScale.h2,
        color: theme.roles.light.primary,
    },
});
