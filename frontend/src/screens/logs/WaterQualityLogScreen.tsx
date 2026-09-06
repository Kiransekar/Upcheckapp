import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ParameterInput } from '../../components/forms/ParameterInput';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { useUIStore } from '../../store/uiStore';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import {
    waterQualityApi,
    prefillCandidates,
    PrefillCandidate,
    SlowChangingField,
} from '../../api/waterQuality';
import { apiErrorMessage } from '../../api/errors';

export const WaterQualityLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [ph, setPh] = useState(editRecord?.ph != null ? String(editRecord.ph) : '');
    const [dissolvedOxygen, setDissolvedOxygen] = useState(editRecord?.dissolvedOxygen != null ? String(editRecord.dissolvedOxygen) : '');
    const [temperature, setTemperature] = useState(editRecord?.temperature != null ? String(editRecord.temperature) : '');
    const [salinity, setSalinity] = useState(editRecord?.salinity != null ? String(editRecord.salinity) : '');
    const [ammonia, setAmmonia] = useState(editRecord?.ammonia != null ? String(editRecord.ammonia) : '');
    const [nitrite, setNitrite] = useState(editRecord?.nitrite != null ? String(editRecord.nitrite) : '');
    const [nitrate, setNitrate] = useState(editRecord?.nitrate != null ? String(editRecord.nitrate) : '');
    const [alkalinity, setAlkalinity] = useState(editRecord?.alkalinity != null ? String(editRecord.alkalinity) : '');
    const [hardness, setHardness] = useState(editRecord?.hardness != null ? String(editRecord.hardness) : '');
    const [transparency, setTransparency] = useState(editRecord?.transparency != null ? String(editRecord.transparency) : '');

    const [notes, setNotes] = useState(editRecord?.notes ?? '');
    const [isLoading, setIsLoading] = useState(false);
    // Quick-mode: only pH/DO/temperature show by default (the readings a
    // farmer logs every visit); the rest are one tap away, not a wall of
    // fields between "open screen" and "save" (USER_PERSPECTIVE_PRODUCT_ANALYSIS §Part 2 row #2).
    // Editing an existing record starts expanded — the farmer came here to
    // correct a specific value and needs to see everything they logged.
    const [showMore, setShowMore] = useState(isEditing);
    // Fields carried over from a reading younger than 12 h and not yet touched
    // or confirmed by the farmer. Emptying it is what clears the warning.
    const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
    // Readings 12 h or older: never written silently, only offered.
    const [staleOffers, setStaleOffers] = useState<PrefillCandidate[]>([]);
    const [anyPrefilled, setAnyPrefilled] = useState(false);

    const SETTERS: Record<SlowChangingField, (v: string) => void> = {
        salinity: setSalinity,
        alkalinity: setAlkalinity,
        hardness: setHardness,
        transparency: setTransparency,
    };

    useEffect(() => {
        if (isEditing) return; // editing an exact past record — never overwrite with "latest"
        let cancelled = false;
        waterQualityApi
            .getLatestPerColumn(pondId)
            .then(({ data }) => {
                if (cancelled || !data) return;
                // The age test is per FIELD, against that field's own `<field>AsOf`:
                // one pond can have a salinity from an hour ago and an alkalinity
                // from last week, and only the first may be filled in silently.
                const candidates = prefillCandidates(data);
                const filled = new Set<string>();
                candidates.forEach((c) => {
                    if (!c.fresh) return;
                    SETTERS[c.field](String(c.value));
                    filled.add(c.field);
                });
                setPrefilledFields(filled);
                setAnyPrefilled(filled.size > 0);
                setStaleOffers(candidates.filter((c) => !c.fresh));
            })
            .catch(() => {
                // No prior reading (new pond) or offline — quietly start blank,
                // this is not an error the farmer needs to see.
            });
        return () => {
            cancelled = true;
        };
    }, [pondId, isEditing]);

    /** Typing in a carried-over field is the farmer checking it — warning clears. */
    const touch = (field: SlowChangingField, setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPrefilledFields((prev) => {
            if (!prev.has(field)) return prev;
            const next = new Set(prev);
            next.delete(field);
            return next;
        });
    };

    const useLastReading = (c: PrefillCandidate) => {
        SETTERS[c.field](String(c.value));
        setStaleOffers((prev) => prev.filter((o) => o.field !== c.field));
        setShowMore(true); // so the farmer can see where the value landed
    };

    const ageLabel = (hours: number) =>
        hours < 24
            ? t('logs.waterQuality_ageHours', { hours: Math.max(1, Math.round(hours)) })
            : t('logs.waterQuality_ageDays', { days: Math.round(hours / 24) });

    const fieldLabel: Record<SlowChangingField, string> = {
        salinity: t('logs.waterQuality_labelSalinity'),
        alkalinity: t('logs.waterQuality_labelAlkalinity'),
        hardness: t('logs.waterQuality_labelHardness'),
        transparency: t('logs.waterQuality_labelTransparency'),
    };

    /** Caption under a field the value was carried into, so it is never invisible. */
    const carriedOver = (field: SlowChangingField) =>
        prefilledFields.has(field) ? (
            <Text style={styles.carriedOver}>{t('logs.waterQuality_carriedOver')}</Text>
        ) : null;

    /**
     * At least one PARAMETER, not one field. `notes` is excluded on purpose —
     * a note moves no `*AsOf`, feeds no engine and answers no question the
     * reminder was asking, so a record carrying only a note must not be what
     * makes the day count as logged.
     */
    const hasAnyReading = [
        ph,
        dissolvedOxygen,
        temperature,
        salinity,
        ammonia,
        nitrite,
        nitrate,
        alkalinity,
        hardness,
        transparency,
    ].some((v) => v.trim() !== '');

    const handleSave = async () => {
        // Belt to the disabled button's braces: the button cannot be pressed
        // in this state, but this method is the thing that must not write an
        // empty record, and a future caller may not know that.
        if (!hasAnyReading) return;
        setIsLoading(true);

        const payload = {
            ph: ph ? parseFloat(ph) : undefined,
            dissolvedOxygen: dissolvedOxygen ? parseFloat(dissolvedOxygen) : undefined,
            temperature: temperature ? parseFloat(temperature) : undefined,
            salinity: salinity ? parseFloat(salinity) : undefined,
            ammonia: ammonia ? parseFloat(ammonia) : undefined,
            nitrite: nitrite ? parseFloat(nitrite) : undefined,
            nitrate: nitrate ? parseFloat(nitrate) : undefined,
            alkalinity: alkalinity ? parseFloat(alkalinity) : undefined,
            hardness: hardness ? parseFloat(hardness) : undefined,
            transparency: transparency ? parseFloat(transparency) : undefined,
            notes: notes.trim() || undefined,
        };

        try {
            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await waterQualityApi.update(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'water_quality',
                    endpoint: '/water-quality',
                    payload: { pondId, recordedAt: new Date().toISOString(), ...payload },
                });
                showToast({
                    message: res.queued
                        ? t('common.savedOffline', 'Saved — will sync when online')
                        : t('common.savedSuccess'),
                    type: 'success',
                });
            }
            navigation.goBack();
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.waterQuality_errorSave')));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.waterQuality_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                {/* Quick mode: the 3 readings a farmer logs every visit, front and
                    centre with no scrolling past unrelated fields first. */}
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.waterQuality_sectionDaily', "Today's Reading")}</Text>
                    <View style={styles.row}>
                        <ParameterInput label={t('logs.waterQuality_labelPh')} value={ph} onChangeText={setPh} parameterKey="ph" />
                        <View style={styles.spacer} />
                        <ParameterInput label={t('logs.waterQuality_labelDo')} unit="mg/L" value={dissolvedOxygen} onChangeText={setDissolvedOxygen} parameterKey="do" />
                    </View>
                    <View style={styles.row}>
                        <ParameterInput label={t('logs.waterQuality_labelTemperature')} unit="°C" value={temperature} onChangeText={setTemperature} parameterKey="temperature" />
                        <View style={styles.spacer} />
                        <View style={styles.halfCol} />
                    </View>
                </Card>

                {/* Both of these sit OUTSIDE "more readings": a carried-over value
                    the farmer never sees is a wrong reading waiting to be saved. */}
                {anyPrefilled && <PrefilledBanner />}

                {staleOffers.length > 0 && (
                    <Card style={styles.card}>
                        <Text style={styles.sectionTitle}>{t('logs.waterQuality_lastReadingTitle')}</Text>
                        <Text style={styles.offerIntro}>{t('logs.waterQuality_lastReadingIntro')}</Text>
                        {staleOffers.map((o) => (
                            <TouchableOpacity
                                key={o.field}
                                style={styles.offerRow}
                                onPress={() => useLastReading(o)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`${t('logs.waterQuality_useLastReading')} — ${fieldLabel[o.field]} ${o.value}`}
                            >
                                <View style={styles.offerText}>
                                    <Text style={styles.offerField}>{fieldLabel[o.field]}</Text>
                                    <Text style={styles.offerMeta}>
                                        {o.value} · {ageLabel(o.ageHours)}
                                    </Text>
                                </View>
                                <Text style={styles.offerAction}>{t('logs.waterQuality_useLastReading')}</Text>
                            </TouchableOpacity>
                        ))}
                    </Card>
                )}

                <TouchableOpacity
                    style={styles.moreToggle}
                    onPress={() => setShowMore((v) => !v)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showMore }}
                >
                    <Text style={styles.moreToggleText}>
                        {showMore
                            ? t('logs.waterQuality_showFewer', 'Show fewer readings')
                            : t('logs.waterQuality_showMore', 'Add more readings')}
                    </Text>
                    <MaterialCommunityIcons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={theme.roles.light.primary} />
                </TouchableOpacity>

                {showMore && (
                    <>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('logs.waterQuality_sectionPhysical')}</Text>
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <ParameterInput label={t('logs.waterQuality_labelTransparency')} unit="cm" value={transparency} onChangeText={touch('transparency', setTransparency)} parameterKey="transparency" />
                                    {carriedOver('transparency')}
                                </View>
                                <View style={styles.spacer} />
                                <View style={styles.halfCol}>
                                    <ParameterInput label={t('logs.waterQuality_labelSalinity')} unit="ppt" value={salinity} onChangeText={touch('salinity', setSalinity)} parameterKey="salinity" />
                                    {carriedOver('salinity')}
                                </View>
                            </View>
                        </Card>

                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('logs.waterQuality_sectionChemical')}</Text>
                            <View style={styles.row}>
                                <ParameterInput label={t('logs.waterQuality_labelAmmonia')} unit="mg/L" value={ammonia} onChangeText={setAmmonia} parameterKey="ammonia" />
                                <View style={styles.spacer} />
                                <ParameterInput label={t('logs.waterQuality_labelNitrite')} unit="mg/L" value={nitrite} onChangeText={setNitrite} parameterKey="nitrite" />
                            </View>
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <ParameterInput label={t('logs.waterQuality_labelAlkalinity')} unit="mg/L" value={alkalinity} onChangeText={touch('alkalinity', setAlkalinity)} parameterKey="alkalinity" />
                                    {carriedOver('alkalinity')}
                                </View>
                                <View style={styles.spacer} />
                                <ParameterInput label={t('logs.waterQuality_labelNitrate')} unit="mg/L" value={nitrate} onChangeText={setNitrate} parameterKey="nitrate" />
                            </View>
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <ParameterInput label={t('logs.waterQuality_labelHardness')} unit="mg/L" value={hardness} onChangeText={touch('hardness', setHardness)} parameterKey="hardness" />
                                    {carriedOver('hardness')}
                                </View>
                                <View style={styles.spacer} />
                                <View style={styles.halfCol} />
                            </View>
                        </Card>
                    </>
                )}

                <Card style={styles.card}>
                    <Input
                        label={t('logs.waterQuality_labelNotesObservations')}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={t('logs.waterQuality_placeholderNotes')}
                        multiline
                        numberOfLines={3}
                        style={styles.textArea}
                    />
                </Card>

                {/* Persistent until every carried-over field has been typed in or
                    confirmed — saving someone else's numbers as today's reading
                    is the failure this whole screen exists to avoid. */}
                {prefilledFields.size > 0 && (
                    <>
                        <AlertBanner
                            type="warning"
                            title={t('logs.waterQuality_unconfirmedTitle')}
                            message={t('logs.waterQuality_unconfirmedMsg', {
                                fields: [...prefilledFields]
                                    .map((f) => fieldLabel[f as SlowChangingField])
                                    .join(', '),
                            })}
                        />
                        <Button
                            title={t('logs.waterQuality_confirmCarried')}
                            variant="outlined"
                            onPress={() => setPrefilledFields(new Set())}
                            style={styles.confirmBtn}
                        />
                    </>
                )}

                {/*
                  * Say WHY the button is off. A disabled control with no
                  * explanation is the farmer's problem to solve by guessing.
                  */}
                {!hasAnyReading && (
                    <Text style={styles.needsValueHint}>{t('logs.needsOneValue')}</Text>
                )}
                <Button
                    title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.waterQuality_saveBtn')}
                    onPress={handleSave}
                    loading={isLoading}
                    /**
                     * A log must carry at least one reading (L2 / D2).
                     *
                     * Saving a blank form used to succeed, and the empty row
                     * was never the real damage: `logProgress.pondSlotDone`
                     * asks only whether a record EXISTS in the slot, so the
                     * reminder stopped, the Today card went green and the
                     * streak held — while every `*AsOf` stayed old and the
                     * engines' confidence kept decaying. The app showed the
                     * farmer only the optimistic half of its own disagreement.
                     *
                     * The server enforces this too. Client-only would leave the
                     * offline queue able to write empties from an older build.
                     */
                    disabled={!hasAnyReading}
                    style={styles.saveBtn}
                />
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
    subtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[4],
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
    },
    halfCol: {
        flex: 1,
    },
    spacer: {
        width: theme.spacing[4],
    },
    moreToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[1],
        paddingVertical: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    moreToggleText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
        fontWeight: '600',
    },
    carriedOver: {
        ...theme.typeScale.caption,
        color: theme.roles.light.infoText,
        marginTop: -theme.spacing[3],
        marginBottom: theme.spacing[3],
    },
    offerIntro: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    offerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing[3],
        minHeight: 48,
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    offerText: { flex: 1 },
    offerField: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
    offerMeta: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary },
    offerAction: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary, fontWeight: '600' },
    confirmBtn: {
        marginTop: theme.spacing[3],
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    needsValueHint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginTop: theme.spacing[2],
    },
    saveBtn: {
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[8],
    },
});
