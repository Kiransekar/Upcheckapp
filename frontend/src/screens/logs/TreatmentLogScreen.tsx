import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { theme } from '../../theme';
import { treatmentsApi } from '../../api/treatments';
import { apiErrorMessage } from '../../api/errors';
import { findBannedSubstances } from '../../features/bannedSubstances';
import { useBannedSubstancesStore } from '../../features/bannedSubstancesStore';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { saveRecord } from '../../sync/recordSync';

export const TreatmentLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.treatmentDate ? editRecord.treatmentDate.slice(0, 10) : todayLocalISODate());
    const [description, setDescription] = useState(editRecord?.description ?? '');
    const [basedOn, setBasedOn] = useState(editRecord?.basedOn ?? 'product_usage');
    const [productName, setProductName] = useState('');
    const [dosageKg, setDosageKg] = useState(editRecord?.dosageKg != null ? String(editRecord.dosageKg) : '');
    const [notes, setNotes] = useState(editRecord?.notes ?? '');

    const [isLoading, setIsLoading] = useState(false);

    // Export-protection guardrail: scan the free-text fields for banned/restricted
    // substances (CAA/MPEDA). Warn-only and non-directive — no alternative suggested.
    const bannedList = useBannedSubstancesStore((s) => s.substances);
    const flagged = findBannedSubstances(`${description} ${productName} ${notes}`, bannedList);
    const hasBanned = flagged.some((s) => s.category === 'banned');

    const performSave = async () => {
        setIsLoading(true);

        const payload = {
            treatmentDate: date,
            description: description.trim(),
            basedOn: basedOn.trim() || undefined,
            dosageKg: dosageKg ? parseFloat(dosageKg) : undefined,
            notes: productName ? `Product: ${productName.trim()}. ${notes}`.trim() : (notes.trim() || undefined),
        };

        try {
            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await treatmentsApi.update(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'treatment',
                    endpoint: '/treatments',
                    payload: { cropId, ...payload },
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.treatment_errorSave')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!description.trim()) {
            Alert.alert(t('common.error'), t('logs.treatment_validationDescription'));
            return;
        }

        if (flagged.length > 0) {
            const names = flagged.map((s) => s.name).join(', ');
            Alert.alert(
                hasBanned ? t('logs.treatment_bannedTitle') : t('logs.treatment_restrictedTitle'),
                hasBanned
                    ? t('logs.treatment_bannedBody', { names })
                    : t('logs.treatment_restrictedBody', { names }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('logs.treatment_saveAnyway'), style: 'destructive', onPress: () => void performSave() },
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
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.treatment_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                {flagged.length > 0 ? (
                    <AlertBanner
                        type="warning"
                        title={hasBanned ? t('logs.treatment_bannerBannedTitle') : t('logs.treatment_bannerRestrictedTitle')}
                        message={
                            hasBanned
                                ? t('logs.treatment_bannerBannedMsg', { names: flagged.map((s) => s.name).join(', ') })
                                : t('logs.treatment_bannerRestrictedMsg', { names: flagged.map((s) => s.name).join(', ') })
                        }
                    />
                ) : null}

                <Card style={styles.card}>
                    <Input label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('logs.datePlaceholder')} required />
                    <Input label={t('logs.treatment_labelDescription')} value={description} onChangeText={setDescription} placeholder={t('logs.treatment_placeholderDescription')} required />
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.treatment_sectionProductDetails')}</Text>
                    <Input label={t('logs.treatment_labelProductName')} value={productName} onChangeText={setProductName} placeholder={t('logs.treatment_placeholderProductName')} />
                    <Input label={t('logs.treatment_labelDosage')} value={dosageKg} onChangeText={setDosageKg} keyboardType="decimal-pad" placeholder="0.0" />
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('logs.treatment_labelAdditionalNotes')}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={t('logs.treatment_placeholderNotes')}
                        multiline
                        numberOfLines={3}
                        style={styles.textArea}
                    />
                </Card>

                <Button
                    title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.saveRecord')}
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
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    saveBtn: {
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
});
