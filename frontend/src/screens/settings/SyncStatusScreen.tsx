/**
 * Sync — "what has reached the server, and what has not".
 *
 * The farmer's complaint had two halves. The first was that the app stopped
 * working offline; the second was that they could not tell what had actually
 * synced. Nothing in the app answered that: the queue existed, the offline
 * banner counted it, and no screen ever listed it. This screen is that list.
 *
 * Three states, in the order they matter:
 *   1. Records needing attention — the app has given up retrying these. They
 *      are shown first and can be retried by hand, never silently dropped.
 *   2. Records waiting — saved on this phone, not yet on the server.
 *   3. Everything is synced — with when that last happened.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { useSyncStore } from '../../store/syncStore';
import { usePendingRecords, type PendingRecord } from '../../sync/pending';
import { drainRecordQueue } from '../../sync/recordSync';
import { formatDate, formatTime } from '../../utils/formatDate';

const c = theme.roles.light;

/** "Saved 14:32" today, "Saved 24 Aug 14:32" before that. */
const savedWhen = (iso: string): string => {
    const d = new Date(iso);
    const today = d.toDateString() === new Date().toDateString();
    return today ? formatTime(d) : `${formatDate(d)} ${formatTime(d)}`;
};

export const SyncStatusScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const isConnected = useSyncStore((s) => s.isConnected);
    const status = useSyncStore((s) => s.status);
    const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
    const retryFailed = useSyncStore((s) => s.retryFailed);
    const all = usePendingRecords();

    const waiting = all.filter((r) => !r.failed);
    const parked = all.filter((r) => r.failed);

    const syncNow = useCallback(() => {
        drainRecordQueue().catch(() => undefined);
    }, []);

    const retryAll = useCallback(() => {
        retryFailed();
        drainRecordQueue().catch(() => undefined);
    }, [retryFailed]);

    const row = (rec: PendingRecord) => (
        <SummaryRow
            key={rec.id}
            icon={rec.failed ? 'warning' : 'schedule'}
            title={t(`sync.entity_${rec.entity}`, { defaultValue: rec.entity.replace(/_/g, ' ') })}
            subtitle={t('sync.savedAt', { when: savedWhen(rec.createdAt) })}
        />
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={
                    isConnected
                        ? t('sync.stateOnline')
                        : t('common.offlineBanner', 'Offline — changes will sync')
                }
                title={t('sync.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={status === 'syncing'}
                        onRefresh={syncNow}
                        colors={[c.primary]}
                        tintColor={c.primary}
                    />
                }
            >
                {parked.length > 0 && (
                    <>
                        <SectionHeader
                            label={t('sync.needsAttentionSection')}
                            trailing={parked.length}
                            trailingColor={c.dangerText}
                        />
                        <Text style={styles.blurb}>{t('sync.needsAttentionBody')}</Text>
                        {parked.map(row)}
                        <Button
                            title={t('common.retry')}
                            onPress={retryAll}
                            variant="outlined"
                            style={styles.action}
                        />
                    </>
                )}

                {waiting.length > 0 && (
                    <>
                        <SectionHeader label={t('sync.waitingSection')} trailing={waiting.length} />
                        <Text style={styles.blurb}>
                            {isConnected ? t('sync.waitingBodyOnline') : t('sync.waitingBodyOffline')}
                        </Text>
                        {waiting.map(row)}
                        {isConnected && (
                            <Button
                                title={t('sync.syncNow')}
                                onPress={syncNow}
                                variant="outlined"
                                loading={status === 'syncing'}
                                style={styles.action}
                            />
                        )}
                    </>
                )}

                {all.length === 0 && (
                    <EmptyState
                        icon="cloud-check-outline"
                        title={t('sync.allSyncedTitle')}
                        subtitle={
                            lastSyncedAt
                                ? t('sync.lastSynced', { when: savedWhen(lastSyncedAt) })
                                : t('sync.allSyncedSubtitle')
                        }
                    />
                )}

                {/*
                  * Deliberately NOT shown here: any total, sum or derived figure
                  * that folds in a pending record. Those are computed by the
                  * server from data it does not have yet — see src/sync/pending.ts.
                  */}
                <View style={styles.footer}>
                    <Text style={styles.footnote}>{t('sync.footnote')}</Text>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[24], backgroundColor: c.surface },
    blurb: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    action: {
        marginHorizontal: theme.spacing[5],
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[5],
        borderColor: c.primary,
    },
    footer: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[6] },
    footnote: { ...theme.typeScale.caption, color: c.textTertiary },
});

export default SyncStatusScreen;
