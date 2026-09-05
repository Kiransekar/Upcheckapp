/**
 * Export — one configurable flow, not a button per screen.
 *
 * Everything the farmer picks here lands in a single `ExportConfig`, which is
 * the only thing this screen hands to `runExport()`. The screen owns no data
 * layer and no renderer: it collects choices, guards the tap, and translates a
 * failure into a sentence.
 *
 * Two rules that are easy to lose:
 *  - A section the chosen dataset has no notion of is not shown, and goes out
 *    as `false`. A dead toggle that changes nothing is worse than an absent one.
 *  - Money is gated on VIEW_FINANCIALS, so a worker is never offered the
 *    dataset OR the costs section. UI-only, as always — the server still guards.
 *
 * The period comes from `moneyPeriodRange()` rather than a second copy of the
 * same arithmetic. It is already IST-local and already agrees with the Money
 * tab; a private reimplementation would drift on exactly the days that matter.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SelectField } from '../../components/ui/SelectField';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { theme } from '../../theme';
import { toLocalISODate } from '../../utils/localDate';
import { LANGUAGES } from '../../i18n/languages';
import { farmsApi, type Farm } from '../../api/farms';
import { pondsApi, type Pond } from '../../api/ponds';
import { cropsApi, type Crop } from '../../api/crops';
import { useAppQuery } from '../../query/hooks';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useSyncStore } from '../../store/syncStore';
import { capture, EVENTS } from '../../features/analytics';
import {
    DEFAULT_MONEY_PREFS,
    moneyPeriodRange,
    type MoneyPeriod,
} from '../../features/moneyPrefs';
import { runExport } from '../../features/export';
import {
    ALL_SECTIONS,
    type ExportConfig,
    type ExportDataset,
    type ExportFormat,
    type ExportSections,
} from '../../features/export/types';

const c = theme.roles.light;

const EMPTY_FARMS: Farm[] = [];
const EMPTY_PONDS: Pond[] = [];
const EMPTY_CYCLES: Crop[] = [];

const DATASETS: ExportDataset[] = ['cycle', 'pondLogs', 'money', 'inventory', 'attendance', 'tasks'];
const FORMATS: ExportFormat[] = ['pdf', 'xlsx', 'csv'];

/** No 'all' — an export with no bounds is a request nobody can wait out. */
const PERIODS: Exclude<MoneyPeriod, 'all'>[] = ['today', 'week', 'month', 'custom'];

/** Written out rather than built from the value, so the keys stay greppable. */
const DATASET_KEY: Record<ExportDataset, string> = {
    cycle: 'export.dataset_cycle',
    pondLogs: 'export.dataset_pondLogs',
    money: 'export.dataset_money',
    inventory: 'export.dataset_inventory',
    attendance: 'export.dataset_attendance',
    tasks: 'export.dataset_tasks',
};

const FORMAT_KEY: Record<ExportFormat, string> = {
    pdf: 'export.format_pdf',
    xlsx: 'export.format_xlsx',
    csv: 'export.format_csv',
};

const PERIOD_KEY: Record<Exclude<MoneyPeriod, 'all'>, string> = {
    today: 'export.period_today',
    week: 'export.period_week',
    month: 'export.period_month',
    custom: 'export.period_custom',
};

const SECTION_KEY: Record<keyof ExportSections, string> = {
    summary: 'export.section_summary',
    waterQuality: 'export.section_waterQuality',
    feed: 'export.section_feed',
    sampling: 'export.section_sampling',
    mortality: 'export.section_mortality',
    treatments: 'export.section_treatments',
    costs: 'export.section_costs',
    harvest: 'export.section_harvest',
};

/**
 * Which blocks a dataset can actually produce. A cycle report is the only one
 * that carries all eight; the rest would print empty headings.
 */
const SECTIONS_FOR: Record<ExportDataset, (keyof ExportSections)[]> = {
    cycle: ['summary', 'waterQuality', 'feed', 'sampling', 'mortality', 'treatments', 'costs', 'harvest'],
    pondLogs: ['summary', 'waterQuality', 'feed', 'sampling', 'mortality', 'treatments'],
    money: ['summary', 'costs', 'harvest'],
    inventory: ['summary', 'costs'],
    attendance: ['summary'],
    tasks: ['summary'],
};

const parseISO = (iso: string | null): Date => {
    if (!iso) return new Date();
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/**
 * A list endpoint that sometimes answers with an envelope and sometimes with a
 * bare array — same normalisation the Money tab does for ponds.
 */
const listOf = <T,>(data: any): T[] =>
    (Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])) as T[];

/**
 * `ExportError.code` (features/export/index.ts), turned into the sentence the
 * farmer reads. Two of the five are NOT "something went wrong":
 *   no-data — the range is real, there is simply nothing in it. An empty
 *             report is a fact about the farm, not a fault in the app.
 *   network — a different instruction ("get signal") from a different cause.
 * Duck-typed on `code` rather than `instanceof`, which survives a rethrow.
 */
const outcomeFor = (err: any): Outcome['kind'] =>
    err?.code === 'no-data' ? 'empty' : err?.code === 'network' ? 'offline' : 'error';

type Outcome =
    | { kind: 'idle' }
    | { kind: 'done' }
    | { kind: 'empty' }
    | { kind: 'offline' }
    | { kind: 'error' };

export const ExportScreen = ({ route, navigation }: any) => {
    const { t, i18n } = useTranslation();
    const params = route?.params ?? {};

    const activeFarmId = useActiveFarmStore((s) => s.selectedFarm?.id);
    const isConnected = useSyncStore((s) => s.isConnected);

    const [wantedDataset, setWantedDataset] = useState<ExportDataset>(params.dataset ?? 'cycle');
    const [format, setFormat] = useState<ExportFormat>('pdf');
    const [farmId, setFarmId] = useState<string | null>(params.farmId ?? activeFarmId ?? null);
    const [pondId, setPondId] = useState<string | null>(params.pondId ?? null);
    const [cropId, setCropId] = useState<string | null>(params.cropId ?? null);
    const [period, setPeriod] = useState<Exclude<MoneyPeriod, 'all'>>('month');
    const [customStart, setCustomStart] = useState<string | null>(toLocalISODate(new Date()));
    const [customEnd, setCustomEnd] = useState<string | null>(toLocalISODate(new Date()));
    const [toggles, setToggles] = useState<ExportSections>(ALL_SECTIONS);
    const [language, setLanguage] = useState<string>(i18n.language || 'en');
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

    const perms = usePermissions(farmId ?? undefined);

    /**
     * A farmer without VIEW_FINANCIALS is not offered the money dataset at all
     * — not offered-and-disabled, which only teaches them the app is broken.
     */
    const datasets = useMemo(
        () => DATASETS.filter((d) => d !== 'money' || perms.canViewFinancials),
        [perms.canViewFinancials],
    );

    // Losing the permission (or arriving with a deep-linked dataset that is not
    // on offer) must not leave the screen pinned to an invisible choice.
    const dataset = datasets.includes(wantedDataset) ? wantedDataset : 'cycle';

    const relevantSections = useMemo(
        () => SECTIONS_FOR[dataset].filter((k) => k !== 'costs' || perms.canViewFinancials),
        [dataset, perms.canViewFinancials],
    );

    const farmsQuery = useAppQuery({
        queryKey: ['export', 'farms'],
        queryFn: async () => listOf<Farm>((await farmsApi.getAll()).data),
    });
    const farms = farmsQuery.data ?? EMPTY_FARMS;

    const pondsQuery = useAppQuery({
        queryKey: ['export', 'ponds', farmId],
        queryFn: async () =>
            listOf<Pond>((await pondsApi.getAll(farmId as string, { take: 100, includeArchived: true })).data),
        enabled: !!farmId,
    });
    const ponds = pondsQuery.data ?? EMPTY_PONDS;

    const cyclesQuery = useAppQuery({
        queryKey: ['export', 'crops', pondId],
        queryFn: async () => listOf<Crop>((await cropsApi.getAll(pondId as string)).data),
        enabled: !!pondId,
    });
    const cycles = cyclesQuery.data ?? EMPTY_CYCLES;

    // Cascading: a pond belongs to a farm and a cycle to a pond, so changing
    // the parent invalidates the child rather than exporting a mismatched pair.
    const selectFarm = (id: string) => {
        setFarmId(id);
        setPondId(null);
        setCropId(null);
        setOutcome({ kind: 'idle' });
    };
    const selectPond = (id: string) => {
        setPondId(id || null);
        setCropId(null);
        setOutcome({ kind: 'idle' });
    };

    const config: ExportConfig = useMemo(() => {
        const range = moneyPeriodRange({
            ...DEFAULT_MONEY_PREFS,
            period,
            customStart,
            customEnd,
        });
        // A section the dataset cannot produce goes out as false, not as the
        // toggle's leftover value from a dataset the farmer looked at earlier.
        const sections = { ...ALL_SECTIONS };
        (Object.keys(sections) as (keyof ExportSections)[]).forEach((k) => {
            sections[k] = relevantSections.includes(k) && toggles[k];
        });

        return {
            dataset,
            format,
            startDate: range.startDate ?? undefined,
            endDate: range.endDate ?? undefined,
            farmId: farmId ?? undefined,
            pondId: pondId ?? undefined,
            cropId: cropId ?? undefined,
            sections,
            language,
        };
    }, [dataset, format, period, customStart, customEnd, farmId, pondId, cropId, relevantSections, toggles, language]);

    /** A cycle report without a cycle is not a report. Everything else is optional. */
    const missing =
        !farmId ? t('export.chooseFarm') : dataset === 'cycle' && !cropId ? t('export.chooseCycle') : null;

    /**
     * A farmer tapping Export three times must not produce three files.
     *
     * The ref is the actual guard, not `busy`: two presses inside one React
     * batch both read the stale `false` from state, whereas the ref is already
     * true by the second one.
     */
    const runningRef = useRef(false);

    const onExport = useCallback(async () => {
        if (runningRef.current || missing) return;

        // Offline is worth saying BEFORE spending ten seconds finding out — and
        // it is a different sentence from "something went wrong".
        if (!isConnected) {
            setOutcome({ kind: 'offline' });
            return;
        }

        runningRef.current = true;
        setBusy(true);
        setOutcome({ kind: 'idle' });
        try {
            await runExport(config);
            setOutcome({ kind: 'done' });
            // Only the FACT of an export, and only on success. Never the config,
            // the filename, the farm or a single figure — see features/export/types.ts.
            capture(EVENTS.EXPORT_GENERATED, { kind: config.format, feature: config.dataset });
        } catch (err) {
            setOutcome({ kind: outcomeFor(err) });
        } finally {
            runningRef.current = false;
            setBusy(false);
        }
    }, [config, isConnected, missing]);

    const notice =
        outcome.kind === 'offline'
            ? { tone: 'error' as const, title: t('export.errorTitle'), body: t('export.errorOffline') }
            : outcome.kind === 'error'
                ? { tone: 'error' as const, title: t('export.errorTitle'), body: t('export.errorBody') }
                : outcome.kind === 'empty'
                    ? { tone: 'warn' as const, title: t('export.emptyTitle'), body: t('export.emptyBody') }
                    : outcome.kind === 'done'
                        ? { tone: 'ok' as const, title: t('export.doneTitle'), body: t('export.doneBody') }
                        : null;

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader title={t('export.title')} onBack={() => navigation.goBack()} />

            {/*
              * Non-interactive while the export runs. A half-changed config
              * mid-render would be applied to a document already being built.
              */}
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                pointerEvents={busy ? 'none' : 'auto'}
            >
                <Text style={styles.subtitle}>{t('export.subtitle')}</Text>

                <SectionHeader label={t('export.datasetLabel')} />
                <View style={styles.chipWrap}>
                    {datasets.map((d) => (
                        <Chip
                            key={d}
                            testID={`export-dataset-${d}`}
                            label={t(DATASET_KEY[d])}
                            active={dataset === d}
                            onPress={() => {
                                setWantedDataset(d);
                                setOutcome({ kind: 'idle' });
                            }}
                        />
                    ))}
                </View>

                <SectionHeader label={t('export.scopeLabel')} />
                <SelectField
                    label={t('export.farmField')}
                    value={farmId}
                    placeholder={t('export.farmPlaceholder')}
                    options={farms.map((f) => ({ label: f.name, value: f.id }))}
                    onSelect={selectFarm}
                    required
                />
                <SelectField
                    label={t('export.pondField')}
                    value={pondId}
                    placeholder={t('export.pondPlaceholder')}
                    disabled={!farmId}
                    options={[
                        { label: t('export.pondAll'), value: '' },
                        ...ponds.map((p) => ({ label: p.name, value: p.id })),
                    ]}
                    onSelect={selectPond}
                />
                <SelectField
                    label={t('export.cycleField')}
                    value={cropId}
                    placeholder={t('export.cyclePlaceholder')}
                    disabled={!pondId}
                    required={dataset === 'cycle'}
                    options={[
                        { label: t('export.cycleAll'), value: '' },
                        ...cycles.map((cr) => ({ label: cr.name, value: cr.id })),
                    ]}
                    onSelect={(v) => {
                        setCropId(v || null);
                        setOutcome({ kind: 'idle' });
                    }}
                />

                <SectionHeader label={t('export.periodLabel')} />
                <View style={styles.chipWrap}>
                    {PERIODS.map((p) => (
                        <Chip
                            key={p}
                            testID={`export-period-${p}`}
                            label={t(PERIOD_KEY[p])}
                            active={period === p}
                            onPress={() => {
                                setPeriod(p);
                                setOutcome({ kind: 'idle' });
                            }}
                        />
                    ))}
                </View>

                {period === 'custom' && (
                    <View style={styles.customRange}>
                        {/* "To" can never precede "From" — moving "From" past the
                            current "To" drags "To" with it. */}
                        <View style={styles.customField}>
                            <CalendarPicker
                                label={t('export.customFrom')}
                                value={parseISO(customStart)}
                                maxDate={new Date()}
                                onChange={(d) => {
                                    const start = toLocalISODate(d);
                                    setCustomStart(start);
                                    if (customEnd && customEnd < start) setCustomEnd(start);
                                }}
                            />
                        </View>
                        <View style={styles.customField}>
                            <CalendarPicker
                                label={t('export.customTo')}
                                value={parseISO(customEnd)}
                                minDate={parseISO(customStart)}
                                onChange={(d) => setCustomEnd(toLocalISODate(d))}
                            />
                        </View>
                    </View>
                )}

                {/* One relevant section is not a choice, so the block is hidden
                    rather than shown with a single toggle nothing depends on. */}
                {relevantSections.length > 1 && (
                    <>
                        <SectionHeader label={t('export.sectionsLabel')} />
                        <Text style={styles.hint}>{t('export.sectionsHint')}</Text>
                        {relevantSections.map((k) => (
                            <View key={k} style={styles.toggleRow}>
                                <Text style={styles.toggleLabel} numberOfLines={1}>
                                    {t(SECTION_KEY[k])}
                                </Text>
                                <Switch
                                    testID={`export-section-${k}`}
                                    value={toggles[k]}
                                    onValueChange={(v) => setToggles((s) => ({ ...s, [k]: v }))}
                                    accessibilityLabel={t(SECTION_KEY[k])}
                                    trackColor={{ false: c.borderDefault, true: c.primaryHover }}
                                />
                            </View>
                        ))}
                    </>
                )}

                <SectionHeader label={t('export.formatLabel')} />
                <View style={styles.chipWrap}>
                    {FORMATS.map((f) => (
                        <Chip
                            key={f}
                            testID={`export-format-${f}`}
                            label={t(FORMAT_KEY[f])}
                            active={format === f}
                            onPress={() => setFormat(f)}
                        />
                    ))}
                </View>

                {/*
                  * The document's language, which need not be the app's — a
                  * farmer reading Tamil still needs an English sheet for a
                  * buyer. The hint says so, because "Language" on a screen that
                  * already has an app language reads as a duplicate control.
                  */}
                <SectionHeader label={t('export.languageLabel')} />
                <Text style={styles.hint}>{t('export.languageHint')}</Text>
                <View style={styles.chipWrap}>
                    {LANGUAGES.map((lang) => (
                        <Chip
                            key={lang.code}
                            testID={`export-language-${lang.code}`}
                            label={lang.nativeLabel}
                            active={language === lang.code}
                            onPress={() => setLanguage(lang.code)}
                        />
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                {notice && (
                    <View
                        testID="export-notice"
                        style={[
                            styles.notice,
                            notice.tone === 'error' && styles.noticeError,
                            notice.tone === 'warn' && styles.noticeWarn,
                            notice.tone === 'ok' && styles.noticeOk,
                        ]}
                    >
                        <Text style={styles.noticeTitle}>{notice.title}</Text>
                        <Text style={styles.noticeBody}>{notice.body}</Text>
                    </View>
                )}
                {missing && !busy && <Text style={styles.hint}>{missing}</Text>}
                {busy && <Text style={styles.hint}>{t('export.busyNote')}</Text>}

                {/*
                  * Not the shared <Button>: this one has to show a spinner AND
                  * keep its label ("Preparing report…"), so a farmer on a slow
                  * connection can see WHAT is taking the time.
                  */}
                <TouchableOpacity
                    testID="export-submit"
                    onPress={onExport}
                    disabled={busy || !!missing}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy || !!missing, busy }}
                    style={[styles.cta, (busy || !!missing) && styles.ctaDisabled]}
                >
                    {busy && <ActivityIndicator size="small" color={c.textInverse} style={styles.ctaSpinner} />}
                    <Text style={styles.ctaLabel} numberOfLines={1}>
                        {busy ? t('export.ctaBusy') : t('export.cta')}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

const Chip: React.FC<{
    label: string;
    active: boolean;
    onPress: () => void;
    testID?: string;
}> = ({ label, active, onPress, testID }) => (
    <TouchableOpacity
        testID={testID}
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[6],
    },
    subtitle: {
        ...theme.typeScale.bodySmall,
        color: c.textSecondary,
        marginBottom: theme.spacing[2],
    },
    hint: {
        ...theme.typeScale.bodySmall,
        color: c.textSecondary,
        marginBottom: theme.spacing[2],
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    chip: {
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: c.borderDefault,
        backgroundColor: c.surface,
        minHeight: 44,
        justifyContent: 'center',
    },
    chipActive: {
        backgroundColor: c.primary,
        borderColor: c.primary,
    },
    chipLabel: {
        ...theme.typeScale.labelMedium,
        color: c.textPrimary,
    },
    chipLabelActive: {
        color: c.textInverse,
    },
    customRange: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[3],
    },
    customField: {
        flex: 1,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[2],
        gap: theme.spacing[3],
    },
    toggleLabel: {
        ...theme.typeScale.bodyMedium,
        color: c.textPrimary,
        flex: 1,
        minWidth: 0,
    },
    footer: {
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[3],
        paddingBottom: theme.spacing[4],
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
        backgroundColor: c.background,
    },
    notice: {
        borderRadius: theme.radius.md,
        padding: theme.spacing[3],
        marginBottom: theme.spacing[3],
    },
    noticeError: { backgroundColor: c.dangerBg },
    noticeWarn: { backgroundColor: c.warningBg },
    noticeOk: { backgroundColor: c.successBg },
    noticeTitle: {
        ...theme.typeScale.labelMedium,
        color: c.textPrimary,
        marginBottom: 2,
    },
    noticeBody: {
        ...theme.typeScale.bodySmall,
        color: c.textSecondary,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: theme.tokens.button.heightMd,
        borderRadius: theme.tokens.button.radiusPrimary,
        backgroundColor: c.primary,
    },
    ctaDisabled: {
        backgroundColor: c.borderDefault,
    },
    ctaSpinner: {
        marginRight: theme.spacing[2],
    },
    ctaLabel: {
        ...theme.typeScale.labelLarge,
        color: c.textInverse,
    },
});

export default ExportScreen;
