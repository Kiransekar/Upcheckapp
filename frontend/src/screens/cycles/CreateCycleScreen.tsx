import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { theme } from '../../theme';
import { cropsApi } from '../../api/crops';
import { apiErrorMessage } from '../../api/errors';
import { toLocalISODate } from '../../utils/localDate';

/** Parse a non-empty numeric string, else undefined (so the column default applies). */
const num = (s: string) => (s.trim() ? Number(s) : undefined);

/**
 * Carrying capacity (max sustainable standing biomass, kg/m²) is a system
 * parameter farmers reason about as culture intensity, not a raw figure. These
 * presets map the intensity to a kg/m² value (semi-intensive = JALA's 1.25
 * default). Advanced users / aeration-derived values can override later.
 */
type Intensity = 'extensive' | 'semi' | 'intensive';
const INTENSITY: { key: Intensity; tkey: string; kgM2: number; icon: any }[] = [
    { key: 'extensive', tkey: 'cycles.intensityExtensive', kgM2: 0.5, icon: 'water-outline' },
    { key: 'semi', tkey: 'cycles.intensitySemi', kgM2: 1.25, icon: 'water' },
    { key: 'intensive', tkey: 'cycles.intensityIntensive', kgM2: 2.5, icon: 'water-plus' },
];

export const CreateCycleScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { pondId } = route.params;
    const [name, setName] = useState('');
    const [stockingDate, setStockingDate] = useState<Date>(new Date());
    const [stockingCount, setStockingCount] = useState('');
    const [speciesType, setSpeciesType] = useState('Vannamei');
    const [seedType, setSeedType] = useState('');

    // Cycle targets (consumed by the simulation + harvest/feed engines). Prefilled
    // with the backend defaults so engines get sensible values out of the box.
    const [totalSeed, setTotalSeed] = useState('');
    const [feedPrice, setFeedPrice] = useState('');
    const [intensity, setIntensity] = useState<Intensity>('semi');
    const [targetDays, setTargetDays] = useState('120');
    const [targetSize, setTargetSize] = useState('');
    const [targetSr, setTargetSr] = useState('75');

    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; stockingCount?: string }>({});

    // A blank required "Cycle Name" field with nothing to go on is exactly the
    // kind of internal-sounding ask a farmer shouldn't have to think about —
    // pre-fill a sensible default (numbered after this pond's prior cycles) so
    // accepting it and moving on is the normal path; still fully editable for
    // anyone who wants a custom label.
    useEffect(() => {
        let cancelled = false;
        cropsApi.getAll(pondId)
            .then(({ data }) => {
                if (cancelled) return;
                const n = (Array.isArray(data) ? data.length : 0) + 1;
                setName((current) => current || t('cycles.defaultCycleName', { n }));
            })
            .catch(() => {
                if (cancelled) return;
                setName((current) => current || t('cycles.defaultCycleName', { n: 1 }));
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pondId]);

    const handleSave = async () => {
        const newErrors: { name?: string; stockingCount?: string } = {};
        if (!name.trim()) {
            newErrors.name = t('cycles.errorCycleNameRequired');
        }
        // parseInt('-500')=-500 and parseInt('500abc')=500 both slipped through the
        // old isNaN check; require a whole positive count so typos/garbage are caught.
        const count = Number(stockingCount);
        if (!Number.isInteger(count) || count <= 0) {
            newErrors.stockingCount = t('cycles.errorStockingCountRequired');
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setIsLoading(true);

        try {
            await cropsApi.create({
                pondId,
                name: name.trim(),
                stockingDate: toLocalISODate(stockingDate),
                stockingCount: count,
                speciesType: speciesType.trim() || undefined,
                seedType: seedType.trim() || undefined,
                totalSeed: num(totalSeed),
                feedPriceRpPerKg: num(feedPrice),
                carryingCapacityKgM2: INTENSITY.find((i) => i.key === intensity)!.kgM2,
                targetCultivationDays: num(targetDays),
                targetSize: num(targetSize),
                targetSrPercent: num(targetSr),
            });
            navigation.goBack();
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('cycles.errorStartCycle')));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContainer}>
                <Input
                    label={t('cycles.fieldCycleName')}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('cycles.placeholderCycleName')}
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
                    placeholder={t('cycles.placeholderStockingCount')}
                    error={errors.stockingCount}
                    required
                />
                <Input
                    label={t('cycles.fieldSpeciesType')}
                    value={speciesType}
                    onChangeText={setSpeciesType}
                    placeholder={t('cycles.placeholderSpeciesType')}
                />
                <Input
                    label={t('cycles.fieldSeedType')}
                    value={seedType}
                    onChangeText={setSeedType}
                    placeholder={t('cycles.placeholderSeedType')}
                />

                <Text style={styles.sectionLabel}>{t('cycles.createTargets')}</Text>
                <Text style={styles.sectionHint}>
                    {t('cycles.createTargetsHint')}
                </Text>

                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTotalSeed')} value={totalSeed} onChangeText={setTotalSeed} keyboardType="number-pad" placeholder="e.g. 400000" />
                    </View>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldFeedPrice')} value={feedPrice} onChangeText={setFeedPrice} keyboardType="decimal-pad" placeholder="e.g. 95" />
                    </View>
                </View>
                <Text style={styles.fieldLabel}>{t('cycles.fieldIntensity')}</Text>
                <View style={styles.segment}>
                    {INTENSITY.map((opt) => {
                        const active = intensity === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.segBtn, active && styles.segBtnActive]}
                                onPress={() => setIntensity(opt.key)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name={opt.icon}
                                    size={18}
                                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                />
                                <Text numberOfLines={1} style={[styles.segLabel, active && { color: theme.roles.light.primary }]}>{t(opt.tkey)}</Text>
                                <Text style={styles.segValue}>{opt.kgM2} kg/m²</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.sectionHint}>
                    {t('cycles.intensityHint')}
                </Text>

                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetDays')} value={targetDays} onChangeText={setTargetDays} keyboardType="number-pad" />
                    </View>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetSize')} value={targetSize} onChangeText={setTargetSize} keyboardType="number-pad" placeholder="e.g. 40" />
                    </View>
                </View>
                <View style={styles.row}>
                    <View style={styles.halfCol}>
                        <Input label={t('cycles.fieldTargetSr')} value={targetSr} onChangeText={setTargetSr} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.halfCol} />
                </View>

                <Button
                    title={t('cycles.startCycle')}
                    onPress={handleSave}
                    loading={isLoading}
                    style={styles.saveBtn}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    formContainer: {
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[10],
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
        marginBottom: theme.spacing[1],
    },
    sectionHint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    fieldLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[1],
    },
    segment: {
        flexDirection: 'row',
        gap: theme.spacing[2],
    },
    segBtn: {
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    segBtnActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceOverlay,
    },
    segLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    segValue: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
    },
    saveBtn: {
        marginTop: theme.spacing[6],
    },
});
