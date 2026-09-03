import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { theme } from '../../theme';
import { diseaseApi, DiseaseLibrary } from '../../api/diseases';
import { apiErrorMessage } from '../../api/errors';
import { findBannedSubstances } from '../../features/bannedSubstances';
import { useBannedSubstancesStore } from '../../features/bannedSubstancesStore';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { saveRecord } from '../../sync/recordSync';

// Best-effort split of the combined "Symptoms: X. Action: Y" note string that
// performSave() builds, so editing a past record can repopulate the two
// separate form fields it came from. Falls back to putting everything in
// symptoms if the saved notes don't match that shape (e.g. older records).
const parseNotes = (notes?: string): { symptoms: string; actionTaken: string } => {
    if (!notes) return { symptoms: '', actionTaken: '' };
    const symptomsMatch = notes.match(/^Symptoms:\s*([\s\S]*?)(?:\.\s*Action:|$)/);
    const actionMatch = notes.match(/Action:\s*([\s\S]*)$/);
    if (symptomsMatch || actionMatch) {
        return {
            symptoms: symptomsMatch ? symptomsMatch[1].trim() : '',
            actionTaken: actionMatch ? actionMatch[1].trim() : '',
        };
    }
    return { symptoms: notes, actionTaken: '' };
};

export const DiseaseLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.recordedDate ? String(editRecord.recordedDate).slice(0, 10) : todayLocalISODate());
    // Disease is chosen from the seeded library — never a hand-typed UUID, so
    // the saved record always references a real disease_library row (FK-safe).
    const [diseases, setDiseases] = useState<DiseaseLibrary[]>([]);
    const [diseaseId, setDiseaseId] = useState(editRecord?.diseaseId ?? '');
    const [loadingDiseases, setLoadingDiseases] = useState(true);
    const [severity, setSeverity] = useState(editRecord?.severityAtDetection ?? 'Mild');
    const initialNotes = parseNotes(editRecord?.notes);
    const [symptoms, setSymptoms] = useState(initialNotes.symptoms);
    const [actionTaken, setActionTaken] = useState(initialNotes.actionTaken);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await diseaseApi.getAllDiseases();
                if (active) setDiseases(Array.isArray(data) ? data : []);
            } catch {
                if (active) setDiseases([]);
            } finally {
                if (active) setLoadingDiseases(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    // Export-protection guardrail: scan the free-text fields for banned/restricted
    // substances (CAA/MPEDA). Warn-only and non-directive — no alternative suggested.
    const bannedList = useBannedSubstancesStore((s) => s.substances);
    const flagged = findBannedSubstances(`${symptoms} ${actionTaken}`, bannedList);
    const hasBanned = flagged.some((s) => s.category === 'banned');

    const performSave = async () => {
        setIsLoading(true);

        try {
            // Build notes from all descriptive fields
            const notesParts: string[] = [];
            if (symptoms.trim()) notesParts.push(`Symptoms: ${symptoms.trim()}`);
            if (actionTaken.trim()) notesParts.push(`Action: ${actionTaken.trim()}`);

            const payload = {
                cropId,
                diseaseId: diseaseId.trim(),
                recordedDate: date,
                severityAtDetection: severity.trim() || undefined,
                notes: notesParts.length > 0 ? notesParts.join('. ') : undefined,
            };

            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await diseaseApi.update(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'disease',
                    endpoint: '/disease/record',
                    payload,
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.disease_errorSave')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!diseaseId) {
            Alert.alert(t('common.error'), t('logs.disease_validationSelectDisease'));
            return;
        }

        if (flagged.length > 0) {
            const names = flagged.map((s) => s.name).join(', ');
            Alert.alert(
                hasBanned ? t('logs.disease_bannedTitle') : t('logs.disease_restrictedTitle'),
                hasBanned
                    ? t('logs.disease_bannedBody', { names })
                    : t('logs.disease_restrictedBody', { names }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('logs.disease_saveAnyway'), style: 'destructive', onPress: () => void performSave() },
                ],
            );
            return;
        }

        void performSave();
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.disease_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                {flagged.length > 0 ? (
                    <AlertBanner
                        type="warning"
                        title={hasBanned ? t('logs.disease_bannerBannedTitle') : t('logs.disease_bannerRestrictedTitle')}
                        message={
                            hasBanned
                                ? t('logs.disease_bannerBannedMsg', { names: flagged.map((s) => s.name).join(', ') })
                                : t('logs.disease_bannerRestrictedMsg', { names: flagged.map((s) => s.name).join(', ') })
                        }
                    />
                ) : null}

                <Card style={styles.card}>
                    <Input label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('logs.datePlaceholder')} required />

                    <Text style={styles.pickerLabel}>{t('logs.disease_labelSuspectedDisease')}</Text>
                    {loadingDiseases ? (
                        <ActivityIndicator color={theme.roles.light.primary} style={{ marginVertical: theme.spacing[3] }} />
                    ) : diseases.length === 0 ? (
                        <Text style={styles.pickerEmpty}>{t('logs.disease_noDiseasesInLibrary')}</Text>
                    ) : (
                        <View style={styles.diseaseList}>
                            {diseases.map((d) => {
                                const selected = d.id === diseaseId;
                                return (
                                    <TouchableOpacity
                                        key={d.id}
                                        style={[styles.diseaseChip, selected && styles.diseaseChipSelected]}
                                        onPress={() => setDiseaseId(d.id)}
                                    >
                                        <Text style={[styles.diseaseChipText, selected && styles.diseaseChipTextSelected]}>
                                            {d.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <Input label={t('logs.disease_labelSeverity')} value={severity} onChangeText={setSeverity} placeholder={t('logs.disease_placeholderSeverity')} />
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('logs.disease_labelSymptoms')}
                        value={symptoms}
                        onChangeText={setSymptoms}
                        placeholder={t('logs.disease_placeholderSymptoms')}
                        multiline
                        numberOfLines={4}
                        style={styles.textArea}
                        required
                    />
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('logs.disease_labelActionTaken')}
                        value={actionTaken}
                        onChangeText={setActionTaken}
                        placeholder={t('logs.disease_placeholderActionTaken')}
                        multiline
                        numberOfLines={3}
                        style={styles.textArea}
                    />
                </Card>

                <Button title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.saveRecord')} onPress={handleSave} loading={isLoading} style={[styles.saveBtn, styles.dangerBtn]} />
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
        backgroundColor: theme.roles.light.dangerText + '20', // Light red tint for disease alert
    },
    backBtn: {
        padding: theme.spacing[4],
    },
    title: {
        ...theme.typeScale.h3,
        color: theme.roles.light.dangerText,
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
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    pickerLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    pickerEmpty: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textDisabled,
        marginBottom: theme.spacing[3],
    },
    diseaseList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4],
    },
    diseaseChip: {
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    diseaseChipSelected: {
        borderColor: theme.roles.light.dangerText,
        backgroundColor: theme.roles.light.dangerText + '15',
    },
    diseaseChipText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textPrimary,
    },
    diseaseChipTextSelected: {
        color: theme.roles.light.dangerText,
        fontWeight: '700',
    },
    saveBtn: {
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
    dangerBtn: {
        backgroundColor: theme.roles.light.dangerText,
    }
});
