import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { harvestsApi } from '../../api/harvests';
import { useUIStore } from '../../store/uiStore';
import { todayLocalISODate } from '../../utils/localDate';
import { confirm } from '../../utils/confirm';
import { saveRecord } from '../../sync/recordSync';

export const HarvestLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId, editRecord } = route.params;
    const isEditing = !!editRecord;

    const [harvestDate, setHarvestDate] = useState(editRecord?.harvestDate ?? todayLocalISODate());
    const [weightKg, setWeightKg] = useState(editRecord?.weightKg != null ? String(editRecord.weightKg) : '');
    const [harvestType, setHarvestType] = useState<'partial' | 'full'>(editRecord?.harvestType ?? 'partial');
    const [averageSize, setAverageSize] = useState(editRecord?.averageSize != null ? String(editRecord.averageSize) : '');
    const [salePriceTotal, setSalePriceTotal] = useState(editRecord?.salePriceTotal != null ? String(editRecord.salePriceTotal) : '');
    const [buyerName, setBuyerName] = useState(editRecord?.buyerName ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (!weightKg) {
            Alert.alert(t('common.error'), t('logs.harvest_validationWeight'));
            return;
        }

        // A harvest is a money record: the weight and sale price on it feed the
        // cycle's yield and P&L. Overwriting one is worth a question; creating
        // the first one is not.
        if (isEditing) {
            const ok = await confirm({
                title: t('common.confirmEditTitle'),
                message: t('common.confirmEditMessage'),
                confirmLabel: t('common.save'),
                cancelLabel: t('common.cancel'),
            });
            if (!ok) return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                harvestDate,
                weightKg: parseFloat(weightKg),
                harvestType,
                averageSize: averageSize ? parseFloat(averageSize) : undefined,
                salePriceTotal: salePriceTotal ? parseFloat(salePriceTotal) : undefined,
                buyerName: buyerName || undefined,
            };

            if (isEditing) {
                // Editing a specific past record is not a field-logging action,
                // so it goes straight to the API rather than through the
                // offline queue — there's no "this reading must be captured
                // right now, no signal" urgency the way a fresh log has.
                await harvestsApi.update(editRecord.id, payload);
                showToast({ message: t('common.savedSuccess'), type: 'success' });
            } else {
                const res = await saveRecord({
                    entity: 'harvest',
                    endpoint: '/harvests',
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
        } catch (error) {
            console.error('Failed to log harvest', error);
            Alert.alert(t('common.error'), t('logs.harvest_errorSave'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>{isEditing ? t('logs.editTitle', 'Edit Reading') : t('logs.harvest_title')}</Text>
                    <Text style={styles.subtitle}>{pondName}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.harvest_sectionDetails')}</Text>

                    <Input
                        label={t('logs.harvest_labelHarvestDate')}
                        value={harvestDate}
                        onChangeText={setHarvestDate}
                        placeholder={t('logs.harvest_placeholderHarvestDate')}
                    />

                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeBtn, harvestType === 'partial' && styles.typeBtnActive]}
                            onPress={() => setHarvestType('partial')}
                        >
                            <Text style={[styles.typeText, harvestType === 'partial' && styles.typeTextActive]}>{t('logs.harvest_typePartial')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeBtn, harvestType === 'full' && styles.typeBtnActive]}
                            onPress={() => setHarvestType('full')}
                        >
                            <Text style={[styles.typeText, harvestType === 'full' && styles.typeTextActive]}>{t('logs.harvest_typeFull')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Input
                        label={t('logs.harvest_labelTotalWeight')}
                        value={weightKg}
                        onChangeText={setWeightKg}
                        keyboardType="numeric"
                        placeholder={t('logs.harvest_placeholderTotalWeight')}
                    />

                    <Input
                        label={t('logs.harvest_labelAvgSize')}
                        value={averageSize}
                        onChangeText={setAverageSize}
                        keyboardType="numeric"
                        placeholder={t('logs.harvest_placeholderAvgSize')}
                    />
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('logs.harvest_sectionSales')}</Text>

                    <Input
                        label={t('logs.harvest_labelBuyerName')}
                        value={buyerName}
                        onChangeText={setBuyerName}
                        placeholder={t('logs.harvest_placeholderBuyerName')}
                    />

                    <Input
                        label={t('logs.harvest_labelSalePrice')}
                        value={salePriceTotal}
                        onChangeText={setSalePriceTotal}
                        keyboardType="numeric"
                        placeholder={t('logs.harvest_placeholderSalePrice')}
                    />
                </Card>

                <Button
                    title={isEditing ? t('logs.updateBtn', 'Update') : t('logs.harvest_saveBtn')}
                    onPress={handleSave}
                    loading={isSubmitting}
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
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary, textAlign: 'center' },
    subtitle: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, textAlign: 'center' },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    card: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    typeSelector: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    typeBtn: {
        flex: 1,
        paddingVertical: theme.spacing[3],
        alignItems: 'center',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    typeBtnActive: {
        backgroundColor: theme.roles.light.primary,
        borderColor: theme.roles.light.primary,
    },
    typeText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textSecondary,
    },
    typeTextActive: {
        color: theme.roles.light.surface,
    },
    saveBtn: {
        marginTop: theme.spacing[2],
    },
});
