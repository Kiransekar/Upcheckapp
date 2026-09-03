import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
// Five of the parameters below are the SAME measurements the daily
// water-quality form takes, and constants/ranges.ts already holds their
// bands — this screen simply was not asking. Calcium, magnesium and
// potassium stay plain fields: there is no agronomist-confirmed band for
// them in that table, and a made-up target on a chemistry form is worse
// than none, because a farmer would dose against it.
import { ParameterInput } from '../../components/forms/ParameterInput';
import { theme } from '../../theme';
import { logResourcesApi } from '../../api/logResources';
import { apiErrorMessage } from '../../api/errors';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { saveRecord } from '../../sync/recordSync';

export const ChemicalLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [date, setDate] = useState(editRecord?.measurementDate ?? todayLocalISODate());
    const [time, setTime] = useState(editRecord?.measurementTime ?? new Date().toTimeString().split(' ')[0].substring(0, 5));
    const [ammoniaNh3, setAmmoniaNh3] = useState(editRecord?.ammoniaNh3Ppm != null ? String(editRecord.ammoniaNh3Ppm) : '');
    const [nitriteNo2, setNitriteNo2] = useState(editRecord?.nitriteNo2Ppm != null ? String(editRecord.nitriteNo2Ppm) : '');
    const [nitrateNo3, setNitrateNo3] = useState(editRecord?.nitrateNo3Ppm != null ? String(editRecord.nitrateNo3Ppm) : '');
    const [alkalinity, setAlkalinity] = useState(editRecord?.alkalinityPpm != null ? String(editRecord.alkalinityPpm) : '');
    const [hardness, setHardness] = useState(editRecord?.hardnessPpm != null ? String(editRecord.hardnessPpm) : '');
    const [calciumCa, setCalciumCa] = useState(editRecord?.calciumCaPpm != null ? String(editRecord.calciumCaPpm) : '');
    const [magnesiumMg, setMagnesiumMg] = useState(editRecord?.magnesiumMgPpm != null ? String(editRecord.magnesiumMgPpm) : '');
    const [potassium, setPotassium] = useState(editRecord?.potassiumPpm != null ? String(editRecord.potassiumPpm) : '');

    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);

        const payload = {
            cropId,
            measurementDate: date,
            measurementTime: time,
            ammoniaNh3Ppm: ammoniaNh3 ? parseFloat(ammoniaNh3) : undefined,
            nitriteNo2Ppm: nitriteNo2 ? parseFloat(nitriteNo2) : undefined,
            nitrateNo3Ppm: nitrateNo3 ? parseFloat(nitrateNo3) : undefined,
            alkalinityPpm: alkalinity ? parseFloat(alkalinity) : undefined,
            hardnessPpm: hardness ? parseFloat(hardness) : undefined,
            calciumCaPpm: calciumCa ? parseFloat(calciumCa) : undefined,
            magnesiumMgPpm: magnesiumMg ? parseFloat(magnesiumMg) : undefined,
            potassiumPpm: potassium ? parseFloat(potassium) : undefined,
        };

        try {
            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await logResourcesApi.updateChemical(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'chemical',
                    endpoint: '/chemical-data',
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
            Alert.alert(t('common.error'), apiErrorMessage(error, t('logs.chemical_errorSave')));
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
                <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.chemical_title')}</Text>
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
                    <Text style={styles.sectionTitle}>{t('logs.chemical_nitrogenSection')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <ParameterInput label={t('logs.chemical_labelAmmoniaNh3')} value={ammoniaNh3} onChangeText={setAmmoniaNh3} unit="mg/L" parameterKey="ammonia" />
                        </View>
                        <View style={styles.halfCol}>
                            <ParameterInput label={t('logs.chemical_labelNitriteNo2')} value={nitriteNo2} onChangeText={setNitriteNo2} unit="mg/L" parameterKey="nitrite" />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <ParameterInput label={t('logs.chemical_labelNitrateNo3')} value={nitrateNo3} onChangeText={setNitrateNo3} unit="mg/L" parameterKey="nitrate" />
                        </View>
                        <View style={styles.halfCol} />
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.chemical_mineralsSection')}</Text>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <ParameterInput label={t('logs.chemical_labelAlkalinity')} value={alkalinity} onChangeText={setAlkalinity} unit="mg/L" parameterKey="alkalinity" />
                        </View>
                        <View style={styles.halfCol}>
                            <ParameterInput label={t('logs.chemical_labelHardness')} value={hardness} onChangeText={setHardness} unit="mg/L" parameterKey="hardness" />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.chemical_labelCalcium')} value={calciumCa} onChangeText={setCalciumCa} keyboardType="decimal-pad" placeholder="0.0" />
                        </View>
                        <View style={styles.halfCol}>
                            <Input label={t('logs.chemical_labelMagnesium')} value={magnesiumMg} onChangeText={setMagnesiumMg} keyboardType="decimal-pad" placeholder="0.0" />
                        </View>
                    </View>
                    <Input label={t('logs.chemical_labelPotassium')} value={potassium} onChangeText={setPotassium} keyboardType="decimal-pad" placeholder="0.0" />
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
