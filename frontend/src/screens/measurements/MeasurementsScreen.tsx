/**
 * MeasurementsScreen — the farmer-facing surface of the Measurement keystone.
 *
 * Drives the unified pipeline end-to-end:
 *   - loads the versioned data dictionary,
 *   - lets the user pick a parameter and record a reading (numeric or coded),
 *     written through `POST /measurements` with `source=manual`, and
 *   - reads the time-series back (`GET /measurements`) as a trend chart + log.
 *
 * Every future capture form will write through this same pipeline; this screen
 * is the first consumer and the proof that the envelope works.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/charts/LineChart';
import { theme } from '../../theme';
import {
    measurementsApi,
    type DataDictionaryEntry,
    type Measurement,
} from '../../api/measurements';
import { useUIStore } from '../../store/uiStore';
import { saveRecord } from '../../sync/recordSync';

export const MeasurementsScreen = ({ route }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const { pondId, pondName, cropId } = route.params ?? {};

    const [dictionary, setDictionary] = useState<DataDictionaryEntry[]>([]);
    const [param, setParam] = useState<string>('');
    const [series, setSeries] = useState<Measurement[]>([]);
    const [loadingDict, setLoadingDict] = useState(true);
    const [loadingSeries, setLoadingSeries] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [valueNum, setValueNum] = useState('');
    const [valueText, setValueText] = useState('');

    const entry = useMemo(
        () => dictionary.find((d) => d.param === param),
        [dictionary, param],
    );

    // Load the data dictionary once.
    useEffect(() => {
        (async () => {
            try {
                const { data } = await measurementsApi.dictionary();
                setDictionary(data);
                if (data.length) setParam(data[0].param);
            } catch (err) {
                Alert.alert(t('engines.common.couldNotCompute'), t('engines.measurements.couldNotLoad'));
            } finally {
                setLoadingDict(false);
            }
        })();
    }, []);

    const loadSeries = useCallback(async () => {
        if (!pondId || !param) return;
        setLoadingSeries(true);
        try {
            const { data } = await measurementsApi.query({
                pondId,
                cropId,
                param,
                limit: 100,
            });
            setSeries(data);
        } catch {
            setSeries([]);
        } finally {
            setLoadingSeries(false);
        }
    }, [pondId, cropId, param]);

    useEffect(() => {
        loadSeries();
        // Reset the entry fields when switching params.
        setValueNum('');
        setValueText('');
    }, [loadSeries]);

    // React Navigation keeps this screen mounted, so the trend/recent-log data
    // above never refetched on return — e.g. a related reading logged
    // elsewhere and coming back here still showed the stale series. This does
    // NOT reset the input fields (unlike the effect above), so an in-progress
    // draft survives navigating away and back.
    useFocusEffect(useCallback(() => { loadSeries(); }, [loadSeries]));

    const handleSubmit = useCallback(async () => {
        if (!entry) return;
        setSubmitting(true);
        try {
            // Route through the offline-first queue: captured with no signal,
            // deduped on a client id, user-scoped, drained on reconnect
            // (recordSync — same path as the log screens).
            const res = await saveRecord({
                entity: 'measurement',
                endpoint: '/measurements',
                payload: {
                    pondId,
                    cropId,
                    param,
                    source: 'manual',
                    ...(entry.valueType === 'categorical'
                        ? { valueText }
                        : { valueNum: Number(valueNum) }),
                },
            });
            setValueNum('');
            setValueText('');
            showToast({
                message: res.queued
                    ? t('common.savedOffline', 'Saved — will sync when online')
                    : t('common.savedSuccess'),
                type: 'success',
            });
            if (!res.queued) await loadSeries();
        } catch (err: any) {
            // saveRecord only throws on real rejections (validation/permission);
            // network failures are queued, not surfaced as errors.
            const message =
                err?.response?.data?.message ||
                t('engines.measurements.invalidReadingSub');
            Alert.alert(t('engines.measurements.invalidReading'), String(message));
        } finally {
            setSubmitting(false);
        }
    }, [entry, pondId, cropId, param, valueNum, valueText, loadSeries]);

    const numericSeries = useMemo(
        () =>
            series
                .filter((m) => m.valueNum !== null && m.valueNum !== undefined)
                .map((m) => ({
                    value: Number(m.valueNum),
                    label: new Date(m.measuredAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                    }),
                })),
        [series],
    );

    const canSubmit =
        !!entry &&
        !submitting &&
        (entry.valueType === 'categorical' ? !!valueText : valueNum.trim() !== '');

    if (loadingDict) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{t('engines.measurements.title')}</Text>
                {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}

                {/* Parameter picker */}
                <Card style={styles.card}>
                    <Text style={styles.label}>{t('engines.measurements.parameter')}</Text>
                    <View style={styles.pickerWrap}>
                        <Picker
                            selectedValue={param}
                            onValueChange={(v) => setParam(String(v))}
                        >
                            {dictionary.map((d) => (
                                <Picker.Item
                                    key={d.id}
                                    label={`${d.label}${d.unit ? ` (${d.unit})` : ''}`}
                                    value={d.param}
                                />
                            ))}
                        </Picker>
                    </View>
                    {entry && (
                        <Text style={styles.hint}>
                            {entry.category.replace(/_/g, ' ')}
                            {entry.valueType === 'numeric' &&
                            (entry.minValue !== null || entry.maxValue !== null)
                                ? ` · range ${entry.minValue ?? '–'}…${entry.maxValue ?? '–'} ${entry.unit}`
                                : ''}
                        </Text>
                    )}
                </Card>

                {/* Quick record */}
                <Card style={styles.card}>
                    <Text style={styles.label}>{t('engines.measurements.record')}</Text>
                    {entry?.valueType === 'categorical' ? (
                        <View style={styles.pickerWrap}>
                            <Picker
                                selectedValue={valueText}
                                onValueChange={(v) => setValueText(String(v))}
                            >
                                <Picker.Item label={t('engines.measurements.selectOption')} value="" />
                                {(entry.allowedValues ?? []).map((v) => (
                                    <Picker.Item key={v} label={v} value={v} />
                                ))}
                            </Picker>
                        </View>
                    ) : (
                        <TextInput
                            style={styles.input}
                            value={valueNum}
                            onChangeText={setValueNum}
                            keyboardType="numeric"
                            placeholder={entry?.unit ? t('engines.measurements.valueWithUnit', { unit: entry.unit }) : t('engines.measurements.value')}
                            placeholderTextColor={theme.roles.light.textSecondary}
                        />
                    )}
                    <Button
                        title={t('engines.measurements.save')}
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={!canSubmit}
                        style={styles.saveBtn}
                    />
                </Card>

                {/* Trend */}
                <Card style={styles.card}>
                    <Text style={styles.label}>{t('engines.measurements.trend')}</Text>
                    {loadingSeries ? (
                        <ActivityIndicator color={theme.roles.light.primary} />
                    ) : numericSeries.length >= 2 ? (
                        <LineChart
                            data={{
                                labels: numericSeries.map((p) => p.label),
                                datasets: [{ data: numericSeries.map((p) => p.value) }],
                            }}
                            yAxisSuffix={entry?.unit ? ` ${entry.unit}` : ''}
                        />
                    ) : (
                        <EmptyState
                            icon="chart-line"
                            title={t('engines.measurements.notEnough')}
                            subtitle={t('engines.measurements.notEnoughSub')}
                        />
                    )}
                </Card>

                {/* Recent log */}
                <Card style={styles.card}>
                    <Text style={styles.label}>{t('engines.measurements.recent')}</Text>
                    {series.length === 0 ? (
                        <Text style={styles.hint}>{t('engines.measurements.noReadings')}</Text>
                    ) : (
                        [...series]
                            .reverse()
                            .slice(0, 20)
                            .map((m) => (
                                <View key={m.id} style={styles.row}>
                                    <MaterialCommunityIcons
                                        name={m.source === 'manual' ? 'pencil' : 'access-point'}
                                        size={16}
                                        color={theme.roles.light.textSecondary}
                                    />
                                    <Text style={styles.rowValue} numberOfLines={1}>
                                        {m.isMissingReason
                                            ? `— (${m.isMissingReason})`
                                            : `${m.valueNum ?? m.valueText} ${m.unit}`.trim()}
                                    </Text>
                                    <Text style={styles.rowMeta} numberOfLines={1}>
                                        {m.doc !== null ? `DOC ${m.doc} · ` : ''}
                                        {new Date(m.measuredAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            ))
                    )}
                </Card>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[3],
    },
    card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
    label: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[2],
    },
    hint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
    },
    pickerWrap: {
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
    },
    input: {
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[3],
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    saveBtn: { marginTop: theme.spacing[3] },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    rowValue: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        flex: 1,
    },
    rowMeta: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
});

export default MeasurementsScreen;
