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
import { waterQualityApi } from '../../api/waterQuality';
import { apiErrorMessage } from '../../api/errors';

// Fields that drift slowly (pond chemistry/geometry-driven, not day-to-day),
// so pre-filling them from the last logged reading saves a farmer re-typing
// the same number every visit — they only need to correct it when it
// actually changed. pH/DO/temperature are deliberately NOT pre-filled: they
// are the reason the farmer opened this screen and must be a fresh reading.
const SLOW_CHANGING_PREFILL_FIELDS = ['salinity', 'alkalinity', 'hardness', 'transparency'] as const;

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
    const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isEditing) return; // editing an exact past record — never overwrite with "latest"
        let cancelled = false;
        waterQualityApi
            .getLatest(pondId)
            .then(({ data }) => {
                if (cancelled || !data) return;
                const filled = new Set<string>();
                const setters: Record<string, (v: string) => void> = {
                    salinity: setSalinity,
                    alkalinity: setAlkalinity,
                    hardness: setHardness,
                    transparency: setTransparency,
                };
                SLOW_CHANGING_PREFILL_FIELDS.forEach((key) => {
                    const value = (data as any)[key];
                    if (value != null) {
                        setters[key](String(value));
                        filled.add(key);
                    }
                });
                if (filled.size > 0) {
                    setPrefilledFields(filled);
                    // Deliberately left collapsed: the carried-over values are
                    // already in state and will be saved as-is if the farmer
                    // never opens "more readings" — that's the point of
                    // pre-filling. Expanding is only needed to check or edit them.
                }
            })
            .catch(() => {
                // No prior reading (new pond) or offline — quietly start blank,
                // this is not an error the farmer needs to see.
            });
        return () => {
            cancelled = true;
        };
    }, [pondId, isEditing]);

    const handleSave = async () => {
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
                        {prefilledFields.size > 0 && (
                            <Text style={styles.prefillHint}>
                                {t(
                                    'logs.waterQuality_prefillHint',
                                    'Salinity, alkalinity, hardness & transparency are carried over from your last reading — edit any that changed.',
                                )}
                            </Text>
                        )}
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('logs.waterQuality_sectionPhysical')}</Text>
                            <View style={styles.row}>
                                <ParameterInput label={t('logs.waterQuality_labelTransparency')} unit="cm" value={transparency} onChangeText={setTransparency} parameterKey="transparency" />
                                <View style={styles.spacer} />
                                <ParameterInput label={t('logs.waterQuality_labelSalinity')} unit="ppt" value={salinity} onChangeText={setSalinity} parameterKey="salinity" />
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
                                <ParameterInput label={t('logs.waterQuality_labelAlkalinity')} unit="mg/L" value={alkalinity} onChangeText={setAlkalinity} parameterKey="alkalinity" />
                                <View style={styles.spacer} />
                                <ParameterInput label={t('logs.waterQuality_labelNitrate')} unit="mg/L" value={nitrate} onChangeText={setNitrate} parameterKey="nitrate" />
                            </View>
                            <View style={styles.row}>
                                <ParameterInput label={t('logs.waterQuality_labelHardness')} unit="mg/L" value={hardness} onChangeText={setHardness} parameterKey="hardness" />
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

                <Button
                    title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.waterQuality_saveBtn')}
                    onPress={handleSave}
                    loading={isLoading}
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
    prefillHint: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
        fontStyle: 'italic',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    saveBtn: {
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[8],
    },
});
