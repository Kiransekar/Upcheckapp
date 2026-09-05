/**
 * PondNamesScreen — artboard 06, "Your ponds", step 2 of 2.
 *
 * The farm draft arrives from step 1 (CreateFarmScreen) and is written HERE,
 * together with its ponds, when "Create farm" is pressed. That ordering is the
 * design's: the button says what it does, and abandoning step 2 leaves nothing
 * behind.
 *
 * Naming is a pattern, not N text boxes. Farmers name ponds P1…P4 / A1…A4, and
 * the server's own naming service takes a 1–4 character prefix and a count and
 * generates exactly that sequence — so one field replaces four, and the preview
 * chips show the result before anything is created.
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
 * keeps the screen at the design's decision budget. Ponds are created as
 * `irregular` geometry — which is precisely "shape not stated, area supplied
 * separately", the only geometry the server accepts without length/width or a
 * diameter — and the owner refines shape and dimensions later from the pond
 * screen.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { farmsApi, type CreateFarmDto } from '../../api/farms';
import { pondsApi } from '../../api/ponds';
import { apiErrorMessage } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useUIStore } from '../../store/uiStore';
import { capture, EVENTS, sizeBand } from '../../features/analytics';

/** The server's naming rule, mirrored so the preview cannot disagree with it. */
export const isValidPrefix = (prefix: string) => /^[A-Za-z0-9]{1,4}$/.test(prefix);

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

    const [prefix, setPrefix] = useState('P');
    const [depth, setDepth] = useState('');
    // Sparse by design: only the ponds whose area the farmer actually typed.
    const [areas, setAreas] = useState<Record<number, string>>({});
    const [errors, setErrors] = useState<{ prefix?: string; depth?: string }>({});
    const [busy, setBusy] = useState(false);

    const names = pondNames(prefix, pondCount);

    const create = async () => {
        const next: { prefix?: string; depth?: string } = {};
        if (!isValidPrefix(prefix)) next.prefix = t('pondSetup.errPrefix');
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
            for (let i = 0; i < pondCount; i++) {
                const areaNum = parseFloat(areas[i] ?? '');
                try {
                    await pondsApi.create({
                        farmId: created.id,
                        namePrefix: prefix.toUpperCase(),
                        geometryType: 'irregular',
                        constructionType: 'earthen',
                        depthM: depthNum,
                        // Server rejects an override below 1 m²; a blank or junk
                        // entry simply means "not measured yet".
                        overrideAreaM2: areaNum >= 1 ? areaNum : undefined,
                    });
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
            showToast(
                failed > 0
                    ? { message: t('pondSetup.errPondsPartial', { count: failed }), type: 'error' }
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
                <Text style={styles.label}>{t('pondSetup.namePattern')}</Text>
                <View style={[styles.prefixBox, !!errors.prefix && styles.prefixBoxError]}>
                    <TextInput
                        value={prefix}
                        onChangeText={(v) => setPrefix(v.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
                        style={styles.prefixInput}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={4}
                        accessibilityLabel={t('pondSetup.namePattern')}
                    />
                    <Text style={styles.prefixHint}>{t('pondSetup.prefixPlaceholder')}</Text>
                </View>
                {errors.prefix ? <Text style={styles.error}>{errors.prefix}</Text> : null}

                <Text style={styles.subLabel}>{t('pondSetup.namesLabel')}</Text>
                <View style={styles.chips}>
                    {names.map((n) => (
                        <Text key={n} style={styles.chip}>{n}</Text>
                    ))}
                </View>

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
                        <View key={n} style={[styles.pondRow, i > 0 && styles.pondRowDivided]}>
                            <Icon name="waves" size={22} color={theme.roles.light.textSecondary} />
                            <Text style={styles.pondName}>{n}</Text>
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
                <Text style={styles.note}>{t('pondSetup.areaOptionalNote')}</Text>
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
    prefixBox: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingHorizontal: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surface,
    },
    prefixBoxError: { borderColor: theme.roles.light.dangerBorder },
    prefixInput: {
        flex: 1,
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        paddingVertical: theme.spacing[3],
    },
    prefixHint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    error: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        marginTop: theme.spacing[1],
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginBottom: theme.spacing[6] },
    chip: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.infoText,
        backgroundColor: theme.roles.light.infoBg,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
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
    pondName: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary, flex: 1 },
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
