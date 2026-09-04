import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { SelectField } from '../../components/ui/SelectField';
import { CANONICAL_SPECIES, SEED_TYPES, speciesLabelKey } from '../../features/species';
import { theme } from '../../theme';
import { cropsApi, Crop, UpdateCropDto } from '../../api/crops';
import { apiErrorMessage } from '../../api/errors';
import { toLocalISODate } from '../../utils/localDate';
import { confirm } from '../../utils/confirm';

const num = (s: string) => (s.trim() ? Number(s) : undefined);
const str = (n?: number | null) => (n == null ? '' : String(n));

/**
 * Fields whose change re-dates the cycle or re-points the engines at different
 * thresholds. Editing one silently rewrites DOC, the ABW curve and every alert
 * band the pond has been judged against — so each goes through the §3.8
 * confirm; the cosmetic ones (name, targets) save straight through.
 */
const CRUCIAL: (keyof UpdateCropDto)[] = ['stockingDate', 'stockingCount', 'speciesType', 'seedType'];

export const EditCycleForm = ({
    cycle,
    onCancel,
    onSaved,
}: {
    cycle: Crop;
    onCancel: () => void;
    onSaved: () => void;
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(cycle.name ?? '');
    const [stockingDate, setStockingDate] = useState<Date>(
        cycle.stockingDate ? new Date(cycle.stockingDate) : new Date(),
    );
    const [stockingCount, setStockingCount] = useState(str(cycle.stockingCount));
    const [speciesType, setSpeciesType] = useState(cycle.speciesType ?? '');
    const [seedType, setSeedType] = useState(cycle.seedType ?? '');
    const [targetDays, setTargetDays] = useState(str(cycle.targetCultivationDays));
    const [targetSize, setTargetSize] = useState(str(cycle.targetSize));
    const [targetSr, setTargetSr] = useState(str(cycle.targetSrPercent));
    const [feedPrice, setFeedPrice] = useState(str(cycle.feedPriceRpPerKg));

    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; stockingCount?: string }>({});

    const handleSave = async () => {
        const next: { name?: string; stockingCount?: string } = {};
        if (!name.trim()) next.name = t('cycles.errorCycleNameRequired');
        const count = Number(stockingCount);
        if (!Number.isInteger(count) || count <= 0) next.stockingCount = t('cycles.errorStockingCountRequired');
        if (Object.keys(next).length) {
            setErrors(next);
            return;
        }
        setErrors({});

        const payload: UpdateCropDto = {
            name: name.trim(),
            stockingDate: toLocalISODate(stockingDate),
            stockingCount: count,
            speciesType: speciesType || undefined,
            seedType: seedType || undefined,
            targetCultivationDays: num(targetDays),
            targetSize: num(targetSize),
            targetSrPercent: num(targetSr),
            feedPriceRpPerKg: num(feedPrice),
        };

        const changed = CRUCIAL.filter((k) => {
            const before = k === 'stockingDate' ? cycle.stockingDate?.split('T')[0] : (cycle as any)[k];
            return (payload[k] ?? null) !== (before ?? null);
        });
        if (changed.length) {
            const ok = await confirm({
                title: t('cycles.editConfirmTitle'),
                message: t('cycles.editConfirmMessage', {
                    fields: changed.map((k) => t(`cycles.editField_${k}`)).join(', '),
                }),
                confirmLabel: t('common.save'),
                cancelLabel: t('common.cancel'),
            });
            if (!ok) return;
        }

        setIsSaving(true);
        try {
            await cropsApi.update(cycle.id, payload);
            onSaved();
        } catch (err) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('cycles.errorEditCycle')));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Input
                label={t('cycles.fieldCycleName')}
                value={name}
                onChangeText={setName}
                error={errors.name}
                required
            />
            <CalendarPicker
                label={t('cycles.fieldStockingDate')}
                value={stockingDate}
                onChange={setStockingDate}
                maxDate={new Date()}
                required
            />
            <Input
                label={t('cycles.fieldStockingCount')}
                value={stockingCount}
                onChangeText={setStockingCount}
                keyboardType="number-pad"
                error={errors.stockingCount}
                required
            />
            <SelectField
                label={t('cycles.fieldSpeciesType')}
                value={speciesType || null}
                options={CANONICAL_SPECIES.map((s) => ({ value: s, label: t(speciesLabelKey(s)) }))}
                onSelect={setSpeciesType}
                placeholder={t('cycles.placeholderSpeciesType')}
            />
            <SelectField
                label={t('cycles.fieldSeedType')}
                value={seedType || null}
                options={SEED_TYPES.map((s) => ({ value: s, label: s }))}
                onSelect={setSeedType}
                placeholder={t('cycles.placeholderSeedType')}
            />

            <Text style={styles.sectionLabel}>{t('cycles.createTargets')}</Text>
            <View style={styles.row}>
                <View style={styles.halfCol}>
                    <Input label={t('cycles.fieldTargetDays')} value={targetDays} onChangeText={setTargetDays} keyboardType="number-pad" />
                </View>
                <View style={styles.halfCol}>
                    <Input label={t('cycles.fieldTargetSize')} value={targetSize} onChangeText={setTargetSize} keyboardType="number-pad" />
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.halfCol}>
                    <Input label={t('cycles.fieldTargetSr')} value={targetSr} onChangeText={setTargetSr} keyboardType="decimal-pad" />
                </View>
                <View style={styles.halfCol}>
                    <Input label={t('cycles.fieldFeedPrice')} value={feedPrice} onChangeText={setFeedPrice} keyboardType="decimal-pad" />
                </View>
            </View>

            <Button title={t('common.save')} onPress={handleSave} loading={isSaving} style={styles.saveBtn} />
            <Button title={t('common.cancel')} variant="outlined" onPress={onCancel} style={styles.cancelBtn} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[12],
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing[4],
    },
    halfCol: {
        flex: 1,
    },
    sectionLabel: {
        ...theme.typeScale.overline,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[5],
        marginBottom: theme.spacing[2],
    },
    saveBtn: {
        marginTop: theme.spacing[6],
    },
    cancelBtn: {
        marginTop: theme.spacing[3],
    },
});
