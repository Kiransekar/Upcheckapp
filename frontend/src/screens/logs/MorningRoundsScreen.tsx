/**
 * MorningRoundsScreen — every pond's water quality in one pass (L3 / D1).
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Quick mode cut each water-quality form from ten fields to three. Nobody cut
 * the number of FORMS. A four-pond farmer doing the morning round walks
 * QuickLog → pond picker → tile → form → save → back, four times over — around
 * 35–40 interactions — then does it again in the evening, plus feed.
 * Twice-daily dissolved oxygen is standard practice, not an edge case.
 *
 * This is where paper still wins, and not on field count: one notebook page
 * holds every pond in a single pass. Depth was fixed; breadth was not.
 *
 * Rows are ponds, columns are the quick-mode three. One Save.
 *
 * ── What this screen deliberately does NOT do ─────────────────────────────
 * It does not replace `WaterQualityLogScreen`, and it does not touch four of
 * that screen's five entry points. Once a farmer has navigated INTO a pond,
 * they have already answered "which pond" and a grid of every pond is the
 * wrong screen. The per-pond form remains right for one pond, for editing, and
 * for the full ten parameters behind "more".
 *
 * It also introduces NO sync machinery. One Save writes N records through the
 * existing `saveRecord`, each with its own client-minted UUID, so the queue's
 * idempotent replay carries it unchanged. N queued records is the correct
 * shape for a farmer who loses signal between pond two and pond three — a
 * batch endpoint would turn a partial success into a total failure.
 *
 * ── The rules carried over from the single-pond form ──────────────────────
 * These are what make the data honest, so they are not simplified away:
 *  • A blank row is NOT a record. Ponds left empty are skipped, never written
 *    as empties (L2) — the app must not count a pond as logged because the
 *    farmer opened a screen that mentioned it.
 *  • Warnings are per cell and never block the save (L4).
 *  • Partial failure is reported PER POND and the grid stays open with the
 *    failed rows intact. `PondNamesScreen` toasts a count and resets to Home
 *    with no retry path; repeating that here would lose a morning's readings.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { useUIStore } from '../../store/uiStore';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondLabel } from '../../utils/pondHealth';
import { isOutOfBounds } from '../../features/parameterBounds';
import { evaluateParameter, type ThresholdParam } from '../../features/waterQualityThresholds';
import { qk } from '../../query/client';
import { useAppQuery } from '../../query/hooks';

const c = theme.roles.light;

/** The quick-mode three, in the order the farmer reads their meter. */
const COLUMNS: { key: 'ph' | 'dissolvedOxygen' | 'temperature'; param: ThresholdParam; labelKey: string }[] = [
    { key: 'ph', param: 'ph', labelKey: 'logs.waterQuality_labelPh' },
    { key: 'dissolvedOxygen', param: 'do', labelKey: 'logs.waterQuality_labelDo' },
    { key: 'temperature', param: 'temperature', labelKey: 'logs.waterQuality_labelTemperature' },
];

type Row = Partial<Record<'ph' | 'dissolvedOxygen' | 'temperature', string>>;

/** A cell worth commenting on, and how loudly. */
const cellTone = (param: ThresholdParam, raw: string): 'none' | 'warn' | 'bad' => {
    if (!raw.trim()) return 'none';
    if (isOutOfBounds(param, raw)) return 'bad';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'none';
    const status = evaluateParameter('vannamei', param, n).status;
    return status === 'critical' || status === 'warning' ? 'warn' : 'none';
};

export const MorningRoundsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);

    // Same cached key QuickLog and Home already warm, so this opens instantly
    // and works offline — which is the whole point of a screen used standing
    // at a pond.
    const pondsQuery = useAppQuery({
        queryKey: qk.ponds(),
        queryFn: async () => (await pondsApi.getMine()).data,
    });
    const ponds: Pond[] = pondsQuery.data ?? [];

    const [rows, setRows] = useState<Record<string, Row>>({});
    const [busy, setBusy] = useState(false);
    /** Ponds whose write failed on the last attempt — kept on screen to retry. */
    const [failedPondIds, setFailedPondIds] = useState<string[]>([]);

    const setCell = (pondId: string, key: keyof Row, value: string) =>
        setRows((prev) => ({ ...prev, [pondId]: { ...prev[pondId], [key]: value } }));

    /** Ponds the farmer actually entered something for. A blank row is not a record. */
    const filledPondIds = useMemo(
        () =>
            ponds
                .map((p) => p.id)
                .filter((id) =>
                    COLUMNS.some((col) => (rows[id]?.[col.key] ?? '').trim() !== ''),
                ),
        [ponds, rows],
    );

    const save = async () => {
        if (filledPondIds.length === 0) return;
        setBusy(true);
        const failed: string[] = [];
        let saved = 0;
        let queued = 0;

        for (const pondId of filledPondIds) {
            const row = rows[pondId] ?? {};
            const payload: Record<string, unknown> = { pondId };
            for (const col of COLUMNS) {
                const raw = (row[col.key] ?? '').trim();
                if (raw === '') continue;
                const n = Number(raw);
                // A cell that is not a number at all is skipped rather than
                // sent as NaN, which would serialise to null and fail the
                // at-least-one-value guard for reasons the farmer cannot see.
                if (Number.isFinite(n)) payload[col.key] = n;
            }
            // Guard against a row of pure junk surviving the filter above.
            if (Object.keys(payload).length === 1) continue;

            try {
                const res = await saveRecord({
                    entity: 'water_quality',
                    endpoint: '/water-quality',
                    // Stamped at PRESS time, not at drain time — an offline
                    // round drained this evening must not claim to be a 6 a.m.
                    // reading. Same lesson as the attendance check-in fix.
                    payload: { ...payload, recordedAt: new Date().toISOString() },
                });
                if (res.queued) queued += 1;
                else saved += 1;
            } catch {
                failed.push(pondId);
            }
        }

        setBusy(false);
        setFailedPondIds(failed);

        if (failed.length > 0) {
            /**
             * Stay on the screen. The successful rows are cleared and the
             * failed ones are left exactly as typed, so the farmer retries
             * three ponds rather than re-walking four.
             */
            setRows((prev) => {
                const next: Record<string, Row> = {};
                for (const id of failed) if (prev[id]) next[id] = prev[id];
                return next;
            });
            showToast({
                message: t('logs.roundsPartial', {
                    failed: failed.length,
                    saved: saved + queued,
                }),
                type: 'error',
            });
            return;
        }

        showToast({
            message: queued > 0
                ? t('logs.roundsQueued', { count: queued + saved })
                : t('logs.roundsSaved', { count: saved }),
            type: 'success',
        });
        navigation.goBack();
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('logs.roundsEyebrow')}
                title={t('logs.roundsTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.lead}>{t('logs.roundsLead')}</Text>

                <View style={styles.headRow}>
                    <Text style={[styles.headCell, styles.pondCol]}>{t('logs.roundsPond')}</Text>
                    {COLUMNS.map((col) => (
                        <Text key={col.key} style={[styles.headCell, styles.valueCol]}>
                            {t(col.labelKey)}
                        </Text>
                    ))}
                </View>

                {ponds.map((pond) => {
                    const row = rows[pond.id] ?? {};
                    const didFail = failedPondIds.includes(pond.id);
                    return (
                        <View
                            key={pond.id}
                            style={[styles.row, didFail && styles.rowFailed]}
                            testID={`rounds-row-${pond.id}`}
                        >
                            <Text style={[styles.pondName, styles.pondCol]} numberOfLines={2}>
                                {pondLabel(pond)}
                            </Text>
                            {COLUMNS.map((col) => {
                                const raw = row[col.key] ?? '';
                                const tone = cellTone(col.param, raw);
                                return (
                                    <View key={col.key} style={styles.valueCol}>
                                        <TextInput
                                            value={raw}
                                            onChangeText={(v) => setCell(pond.id, col.key, v)}
                                            keyboardType="decimal-pad"
                                            placeholder="—"
                                            placeholderTextColor={c.textDisabled}
                                            style={[
                                                styles.cell,
                                                tone === 'warn' && styles.cellWarn,
                                                tone === 'bad' && styles.cellBad,
                                            ]}
                                            testID={`rounds-${col.key}-${pond.id}`}
                                            accessibilityLabel={`${pondLabel(pond)} — ${t(col.labelKey)}`}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}

                {/*
                  * Said once, under the grid, rather than per cell: a warning
                  * beside every reading in a crisis is noise, and none of them
                  * stop the save anyway (D3).
                  */}
                <Text style={styles.note}>{t('logs.roundsNote')}</Text>
            </ScrollView>

            <View style={styles.footer}>
                {failedPondIds.length > 0 && (
                    <View style={styles.failRow}>
                        <Icon name="warning" size={18} color={c.dangerText} />
                        <Text style={styles.failText}>{t('logs.roundsRetryHint')}</Text>
                    </View>
                )}
                <Button
                    title={
                        filledPondIds.length > 0
                            ? t('logs.roundsSaveN', { count: filledPondIds.length })
                            : t('logs.roundsSave')
                    }
                    onPress={save}
                    loading={busy}
                    // A blank grid writes nothing (L2). Ponds left empty are
                    // skipped, so "save" with nothing typed is a no-op worth
                    // preventing rather than performing.
                    disabled={filledPondIds.length === 0}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    body: { padding: theme.spacing[4], paddingBottom: theme.spacing[8] },
    lead: { ...theme.typeScale.bodySmall, color: c.textSecondary, marginBottom: theme.spacing[4] },
    headRow: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
    headCell: { ...theme.typeScale.labelSmall, color: c.textTertiary, textAlign: 'center' },
    pondCol: { width: 88, textAlign: 'left' },
    valueCol: { flex: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
    },
    rowFailed: { backgroundColor: c.dangerBg },
    pondName: { ...theme.typeScale.labelMedium, color: c.textPrimary },
    cell: {
        minHeight: 44,
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: c.borderDefault,
        backgroundColor: c.surface,
        ...theme.typeScale.bodyMedium,
        color: c.textPrimary,
        textAlign: 'center',
    },
    cellWarn: { borderColor: c.warningBorder },
    cellBad: { borderColor: c.dangerBorder },
    note: { ...theme.typeScale.bodySmall, color: c.textTertiary, marginTop: theme.spacing[4] },
    footer: {
        padding: theme.spacing[4],
        borderTopWidth: 1,
        borderTopColor: c.borderDefault,
        gap: theme.spacing[2],
    },
    failRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    failText: { ...theme.typeScale.bodySmall, color: c.dangerText, flex: 1 },
});

export default MorningRoundsScreen;
