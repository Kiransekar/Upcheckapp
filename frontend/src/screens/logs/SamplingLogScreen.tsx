import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { samplingApi } from '../../api/sampling';
import { apiErrorMessage } from '../../api/errors';

export const SamplingLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.samplingDate ?? todayLocalISODate());
    const [mbwG, setMbwG] = useState(editRecord?.mbwG != null ? String(editRecord.mbwG) : '');
    const [totalSamples, setTotalSamples] = useState(editRecord?.totalSamples != null ? String(editRecord.totalSamples) : '');
    const [biomassEstimation, setBiomassEstimation] = useState(editRecord?.biomassEstimationKg != null ? String(editRecord.biomassEstimationKg) : '');
    const [srEstimation, setSrEstimation] = useState(editRecord?.srEstimationPercent != null ? String(editRecord.srEstimationPercent) : '');
    const [notes, setNotes] = useState(editRecord?.notes ?? '');

    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!mbwG || isNaN(parseFloat(mbwG))) {
            Alert.alert(t('common.error'), t('logs.sampling_validationMbw'));
            return;
        }

        setIsLoading(true);

        const payload = {
            samplingDate: date,
            mbwG: parseFloat(mbwG),
            totalSamples: totalSamples ? parseInt(totalSamples, 10) : undefined,
            biomassEstimationKg: biomassEstimation ? parseFloat(biomassEstimation) : undefined,
            srEstimationPercent: srEstimation ? parseFloat(srEstimation) : undefined,
            notes: notes.trim() || undefined,
        };

        try {
            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await samplingApi.update(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'sampling',
                    endpoint: '/sampling',
                    payload: { pondId, ...payload },
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.sampling_errorSave')));
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
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.sampling_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                <Card style={styles.card}>
                    <Input label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('logs.datePlaceholder')} required />
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.sampling_sectionMeasurements')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.sampling_labelMbw')} value={mbwG} onChangeText={setMbwG} keyboardType="decimal-pad" placeholder="0.0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.sampling_labelTotalSamples')} value={totalSamples} onChangeText={setTotalSamples} keyboardType="number-pad" placeholder="0" />
                        </View>
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.sampling_sectionPopulation')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.sampling_labelEstSr')} value={srEstimation} onChangeText={setSrEstimation} keyboardType="decimal-pad" placeholder={t('logs.sampling_placeholderEstSr')} />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.sampling_labelEstBiomass')} value={biomassEstimation} onChangeText={setBiomassEstimation} keyboardType="decimal-pad" placeholder="0.0" />
                        </View>
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('logs.sampling_labelNotesAbnormalities')}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={t('logs.sampling_placeholderNotes')}
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
