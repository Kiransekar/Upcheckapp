/**
 * WeeklyChemistryScreen — the periodic (≈weekly) test-kit / lab entry for the
 * chemistry parameters a farmer can't measure daily: ammonia, nitrite, nitrate,
 * alkalinity, hardness and water transparency (Secchi).
 *
 * Posts a water-quality record with just these fields; pond-context resolves
 * the latest non-null value per parameter, so these carry forward to every
 * engine until the next test — and raise the data-confidence score.
 *
 * The six fields are grouped by what they tell the farmer — nitrogen load,
 * buffering, clarity — rather than dumped as one six-cell grid, and each shows
 * the previous test's value so a bad strip reading stands out on the spot.
 */
import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';
// The same input the DAILY water-quality form uses: it reads the shared band
// table, tints its border and prints the target range. These six parameters
// are in that table already; only this screen was not asking it.
import { ParameterInput } from '../../components/forms/ParameterInput';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { useUIStore } from '../../store/uiStore';
import { waterQualityApi, LatestPerColumn } from '../../api/waterQuality';
import { apiErrorMessage } from '../../api/errors';

const num = (s: string) => (s.trim() ? Number(s) : undefined);

type ChemField = 'ammonia' | 'nitrite' | 'nitrate' | 'alkalinity' | 'hardness' | 'transparency';

const GROUPS: { key: string; fields: { field: ChemField; unit: string }[] }[] = [
    {
        key: 'nitrogen',
        fields: [
            { field: 'ammonia', unit: 'mg/L' },
            { field: 'nitrite', unit: 'mg/L' },
            { field: 'nitrate', unit: 'mg/L' },
        ],
    },
    {
        key: 'buffering',
        fields: [
            { field: 'alkalinity', unit: 'mg/L' },
            { field: 'hardness', unit: 'mg/L' },
        ],
    },
    { key: 'clarity', fields: [{ field: 'transparency', unit: 'cm' }] },
];

export const WeeklyChemistryScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName } = route.params ?? {};
    const [values, setValues] = useState<Record<ChemField, string>>({
        ammonia: '', nitrite: '', nitrate: '', alkalinity: '', hardness: '', transparency: '',
    });
    const [saving, setSaving] = useState(false);
    // Previous test, per column — the same per-field carry-forward the engines
    // read, so "last week" here is exactly what the engines are still using.
    const [last, setLast] = useState<LatestPerColumn | null>(null);

    useEffect(() => {
        let cancelled = false;
        waterQualityApi
            .getLatestPerColumn(pondId)
            .then(({ data }) => {
                if (!cancelled) setLast(data ?? null);
            })
            .catch(() => {
                // First test on this pond, or offline — the fields simply show no
                // previous value. Not an error worth interrupting the farmer for.
            });
        return () => { cancelled = true; };
    }, [pondId]);

    const set = useCallback(
        (field: ChemField) => (v: string) => setValues((prev) => ({ ...prev, [field]: v })),
        [],
    );

    const anyValue = Object.values(values).some((v) => v.trim() !== '');

    const lastLabel = (field: ChemField): string | null => {
        const value = last?.[field];
        const asOf = last?.[`${field}AsOf` as keyof LatestPerColumn] as string | null | undefined;
        if (value == null) return null;
        const at = asOf ? new Date(asOf).getTime() : NaN;
        if (Number.isNaN(at)) return t('logs.weeklyChem_lastValue', { value });
        const days = Math.max(0, Math.round((Date.now() - at) / 86_400_000));
        return t('logs.weeklyChem_lastValueAge', { value, days });
    };

    const save = useCallback(async () => {
        if (!anyValue) {
            Alert.alert(t('engines.weeklyChem.nothing'), t('engines.weeklyChem.nothingSub'));
            return;
        }
        setSaving(true);
        try {
            const res = await saveRecord({
                entity: 'water_quality',
                endpoint: '/water-quality',
                payload: {
                    pondId,
                    recordedAt: new Date().toISOString(),
                    ammonia: num(values.ammonia),
                    nitrite: num(values.nitrite),
                    nitrate: num(values.nitrate),
                    alkalinity: num(values.alkalinity),
                    hardness: num(values.hardness),
                    transparency: num(values.transparency),
                },
            });
            showToast({
                message: res.queued ? t('common.savedOffline', 'Saved — will sync when online') : t('common.savedSuccess'),
                type: 'success',
            });
            navigation.goBack();
        } catch (e: any) {
            Alert.alert(t('engines.common.couldNotSave'), apiErrorMessage(e, t('engines.common.tryAgain')));
        } finally {
            setSaving(false);
        }
    }, [anyValue, pondId, values, navigation, showToast, t]);

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.head}>
                    <MaterialCommunityIcons name="flask-outline" size={26} color={theme.roles.light.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{t('engines.weeklyChem.title')}</Text>
                        {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
                    </View>
                </View>

                <View style={styles.note}>
                    <MaterialCommunityIcons name="information-outline" size={16} color={theme.roles.light.infoText} />
                    <Text style={styles.noteText}>{t('engines.weeklyChem.note')}</Text>
                </View>

                {GROUPS.map((group) => (
                    <View key={group.key}>
                        <SectionHeader label={t(`logs.weeklyChem_group_${group.key}`)} />
                        <Card style={styles.card}>
                            <Text style={styles.groupHint}>{t(`logs.weeklyChem_groupHint_${group.key}`)}</Text>
                            <View style={styles.grid}>
                                {group.fields.map(({ field, unit }) => (
                                    <View key={field} style={styles.cell}>
                                        <ParameterInput
                                            label={t(`engines.weeklyChem.${field}`)}
                                            value={values[field]}
                                            onChangeText={set(field)}
                                            unit={unit}
                                            parameterKey={field}
                                        />
                                        {lastLabel(field) ? (
                                            <Text style={styles.lastValue}>{lastLabel(field)}</Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </Card>
                    </View>
                ))}

                <Button title={t('engines.weeklyChem.save')} onPress={save} loading={saving} disabled={!anyValue} style={styles.cta} />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[10] },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    note: {
        flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg, borderRadius: theme.radius.sm,
        padding: theme.spacing[3], marginBottom: theme.spacing[2],
    },
    noteText: { ...theme.typeScale.bodySmall, color: theme.roles.light.infoText, flex: 1 },
    card: { padding: theme.spacing[4] },
    groupHint: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[3] },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
    // 46% keeps two columns with the gap at 360dp without wrapping to one.
    cell: { width: '46%', flexGrow: 1 },
    lastValue: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary, marginTop: -theme.spacing[3], marginBottom: theme.spacing[3] },
    cta: { marginTop: theme.spacing[5] },
});

export default WeeklyChemistryScreen;
