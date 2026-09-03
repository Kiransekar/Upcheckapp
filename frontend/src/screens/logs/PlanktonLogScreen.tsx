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

export const PlanktonLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.measurementDate ?? todayLocalISODate());
    const [time, setTime] = useState(editRecord?.measurementTime ?? new Date().toTimeString().split(' ')[0].substring(0, 5));
    const [greenAlgae, setGreenAlgae] = useState(editRecord?.greenAlgaeGaCellMl != null ? String(editRecord.greenAlgaeGaCellMl) : '');
    const [blueGreenAlgae, setBlueGreenAlgae] = useState(editRecord?.blueGreenAlgaeBgaCellMl != null ? String(editRecord.blueGreenAlgaeBgaCellMl) : '');
    const [diatom, setDiatom] = useState(editRecord?.diatomCellMl != null ? String(editRecord.diatomCellMl) : '');
    const [dinoflagellata, setDinoflagellata] = useState(editRecord?.dinoflagellataCellMl != null ? String(editRecord.dinoflagellataCellMl) : '');
    const [protozoa, setProtozoa] = useState(editRecord?.protozoaCellMl != null ? String(editRecord.protozoaCellMl) : '');
    const [floc, setFloc] = useState(editRecord?.flocCellMl != null ? String(editRecord.flocCellMl) : '');

    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);

        const payload = {
            cropId,
            measurementDate: date,
            measurementTime: time,
            greenAlgaeGaCellMl: greenAlgae ? parseFloat(greenAlgae) : undefined,
            blueGreenAlgaeBgaCellMl: blueGreenAlgae ? parseFloat(blueGreenAlgae) : undefined,
            diatomCellMl: diatom ? parseFloat(diatom) : undefined,
            dinoflagellataCellMl: dinoflagellata ? parseFloat(dinoflagellata) : undefined,
            protozoaCellMl: protozoa ? parseFloat(protozoa) : undefined,
            flocCellMl: floc ? parseFloat(floc) : undefined,
        };

        try {
            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await logResourcesApi.updatePlankton(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'plankton',
                    endpoint: '/plankton-data',
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.plankton_errorSave')));
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
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.plankton_title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>{t('logs.loggingFor', { pondName })}</Text>

                <Card style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('logs.datePlaceholder')} required />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.time')} value={time} onChangeText={setTime} placeholder={t('logs.timePlaceholder')} required />
                        </View>
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.plankton_sectionCounts')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelGreenAlgae')} value={greenAlgae} onChangeText={setGreenAlgae} keyboardType="number-pad" placeholder="0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelBlueGreen')} value={blueGreenAlgae} onChangeText={setBlueGreenAlgae} keyboardType="number-pad" placeholder="0" />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelDiatom')} value={diatom} onChangeText={setDiatom} keyboardType="number-pad" placeholder="0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelDinoflagellata')} value={dinoflagellata} onChangeText={setDinoflagellata} keyboardType="number-pad" placeholder="0" />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelProtozoa')} value={protozoa} onChangeText={setProtozoa} keyboardType="number-pad" placeholder="0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.plankton_labelFloc')} value={floc} onChangeText={setFloc} keyboardType="number-pad" placeholder="0" />
                        </View>
                    </View>
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
    saveBtn: {
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[8],
    },
});
