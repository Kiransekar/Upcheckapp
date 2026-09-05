import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { logResourcesApi } from '../../api/logResources';
import { apiErrorMessage } from '../../api/errors';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { saveRecord } from '../../sync/recordSync';

export const MicrobiologyLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.measurementDate ?? todayLocalISODate());
    const [totalBacillus, setTotalBacillus] = useState(editRecord?.totalBacillusCfuMl != null ? String(editRecord.totalBacillusCfuMl) : '');
    const [totalVibrio, setTotalVibrio] = useState(editRecord?.totalVibrioCountTvcCfuMl != null ? String(editRecord.totalVibrioCountTvcCfuMl) : '');
    const [greenVibrio, setGreenVibrio] = useState(editRecord?.greenVibrioCountTvcCfuMl != null ? String(editRecord.greenVibrioCountTvcCfuMl) : '');
    const [yellowVibrio, setYellowVibrio] = useState(editRecord?.yellowVibrioCountTvcCfuMl != null ? String(editRecord.yellowVibrioCountTvcCfuMl) : '');
    const [luminescentBacteria, setLuminescentBacteria] = useState(editRecord?.luminescentBacteriaLbCfuMl != null ? String(editRecord.luminescentBacteriaLbCfuMl) : '');
    const [note, setNote] = useState(editRecord?.note ?? '');

    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);

        const payload = {
            cropId,
            measurementDate: date,
            totalBacillusCfuMl: totalBacillus ? parseFloat(totalBacillus) : undefined,
            totalVibrioCountTvcCfuMl: totalVibrio ? parseFloat(totalVibrio) : undefined,
            greenVibrioCountTvcCfuMl: greenVibrio ? parseFloat(greenVibrio) : undefined,
            yellowVibrioCountTvcCfuMl: yellowVibrio ? parseFloat(yellowVibrio) : undefined,
            luminescentBacteriaLbCfuMl: luminescentBacteria ? parseFloat(luminescentBacteria) : undefined,
            note: note.trim() || undefined,
        };

        try {
            if (isEditing) {
                await logResourcesApi.updateMicrobiology(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'microbiology',
                    endpoint: '/microbiology-data',
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.microbiology_errorSave')));
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
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.microbiology_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                <Card style={styles.card}>
                    <Input label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('logs.datePlaceholder')} required />
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.microbiology_sectionBacteria')}</Text>
                    <Input label={t('logs.microbiology_labelTotalBacillus')} value={totalBacillus} onChangeText={setTotalBacillus} keyboardType="number-pad" placeholder="0" />
                    <Input label={t('logs.microbiology_labelTotalVibrio')} value={totalVibrio} onChangeText={setTotalVibrio} keyboardType="number-pad" placeholder="0" />
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.microbiology_sectionVibrio')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.microbiology_labelGreenVibrio')} value={greenVibrio} onChangeText={setGreenVibrio} keyboardType="number-pad" placeholder="0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.microbiology_labelYellowVibrio')} value={yellowVibrio} onChangeText={setYellowVibrio} keyboardType="number-pad" placeholder="0" />
                        </View>
                    </View>
                    <Input label={t('logs.microbiology_labelLuminescent')} value={luminescentBacteria} onChangeText={setLuminescentBacteria} keyboardType="number-pad" placeholder="0" />
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('common.notes')}
                        value={note}
                        onChangeText={setNote}
                        placeholder={t('logs.microbiology_placeholderNotes')}
                        multiline
                        numberOfLines={4}
                        style={styles.textArea}
                    />
                </Card>

                <Button title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.saveRecord')} onPress={handleSave} loading={isLoading} style={styles.saveBtn} />
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
        minHeight: 100,
        textAlignVertical: 'top',
    },
    saveBtn: {
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
});
