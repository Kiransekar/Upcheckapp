/**
 * DailyRoutineScreen — the guided daily operating loop for a pond:
 *   1. Water check (DO/pH/salinity/temp)  → feeds every engine
 *   2. Today's feed advice                → computed ration
 *   3. Log the feed actually fed
 *   4. Feeding-tray check                 → closes the FCR loop
 *
 * Steps show "done today" from the farmer's latest logs (pond-context), so the
 * routine reflects real progress and the tray check can be done inline.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { theme } from '../../theme';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { feedingTrayApi, type TrayResidue } from '../../api/feedingTray';
import { toLocalISODate } from '../../utils/localDate';
import { saveRecord } from '../../sync/recordSync';
import { useUIStore } from '../../store/uiStore';
import { useFocusEffect } from '@react-navigation/native';

const isToday = (iso: string | null | undefined) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();

const TRAYS: { key: TrayResidue; tkey: string; icon: any }[] = [
  { key: 'empty', tkey: 'empty', icon: 'circle-outline' },
  { key: 'few_left', tkey: 'fewLeft', icon: 'circle-slice-2' },
  { key: 'a_lot_left', tkey: 'aLotLeft', icon: 'circle-slice-6' },
];

export const DailyRoutineScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);
  const { pondId, pondName, cropId: cropParam } = route.params ?? {};
  const [ctx, setCtx] = useState<PondContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tray, setTray] = useState<TrayResidue | null>(null);
  const [savingTray, setSavingTray] = useState(false);

  const load = useCallback(async () => {
    if (!pondId) { setLoading(false); return; }
    try {
      const { data } = await pondContextApi.get(pondId);
      setCtx(data);
      if (data.latestTrayResidue) setTray(data.latestTrayResidue);
    } catch {
      setCtx(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pondId]);

  // Refetch on FOCUS, not on mount. React Navigation keeps a screen mounted
  // once it has been opened, so a mount-only effect never ran again: log
  // something in a pond, come back here, and the page still showed the
  // figures from before the log until the app was force-refreshed.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cropId = ctx?.cropId ?? cropParam;
  const params = { pondId, pondName, cropId };

  const wqDone = isToday(ctx?.waterQuality?.recordedAt);
  const feedDone = isToday(ctx?.lastFeedAt);
  const trayDone = isToday(ctx?.lastTrayAt);
  const doneCount = [wqDone, feedDone, trayDone].filter(Boolean).length;

  const saveTray = useCallback(async () => {
    if (!cropId || !tray) return;
    setSavingTray(true);
    try {
      const now = new Date();
      const res = await saveRecord({
        entity: 'feeding_tray_check',
        endpoint: '/feeding-tray-checks',
        payload: {
          cropId,
          checkDate: toLocalISODate(now),
          checkTime: now.toTimeString().slice(0, 5),
          trayNumber: 1,
          remainingFeedStatus: tray,
        },
      });
      if (res.queued) {
        // load()'s catch resets ctx to null on failure — while offline that
        // refetch would just fail and wipe the screen's current state, so
        // skip it and keep what's already shown; the focus-refetch picks up
        // the real server state once back online and the queue drains.
        showToast({ message: t('common.savedOffline', 'Saved — will sync when online'), type: 'success' });
      } else {
        await load();
      }
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotSave'), e?.response?.data?.message ?? t('engines.common.tryAgain'));
    } finally {
      setSavingTray(false);
    }
  }, [cropId, tray, load, t]);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}><ActivityIndicator size="large" color={theme.roles.light.primary} /></View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.routine.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}{ctx?.doc != null ? ` · DOC ${ctx.doc}` : ''}</Text> : null}
          </View>
          <View style={styles.progress}>
            <Text style={styles.progressNum}>{doneCount}<Text style={styles.progressDen}>/3</Text></Text>
            <Text style={styles.progressLabel}>{t('engines.routine.doneToday')}</Text>
          </View>
        </View>

        {ctx && <View style={styles.confidence}><ConfidenceChip confidence={ctx.confidence} showHint /></View>}

        {/* Step 1 — Water check */}
        <StepCard
          n={1}
          icon="water-percent"
          title={t('engines.routine.waterCheck')}
          subtitle={wqDone
            ? `${t('engines.routine.logged')}${ctx?.waterQuality?.dissolvedOxygen != null ? ` · DO ${ctx.waterQuality.dissolvedOxygen} mg/L` : ''}`
            : t('engines.routine.waterCheckLog')}
          done={wqDone}
          onPress={() => navigation.navigate('WaterQualityLog', params)}
        />

        {/* Step 2 — Feed advice (informational) */}
        <StepCard
          n={2}
          icon="silo-outline"
          title={t('engines.routine.feedAdvice')}
          subtitle={ctx?.runningFcr != null ? t('engines.routine.runningFcr', { value: ctx.runningFcr }) : t('engines.routine.feedAdviceSub')}
          accent
          onPress={() => navigation.navigate('FeedAdvisor', params)}
        />

        {/* Step 3 — Log feed fed */}
        <StepCard
          n={3}
          icon="basket-fill"
          title={t('engines.routine.logFeed')}
          subtitle={feedDone
            ? `${t('engines.routine.logged')}${ctx?.cumulativeFeedKg != null ? ` · ${t('engines.routine.cumulative', { value: ctx.cumulativeFeedKg })}` : ''}`
            : t('engines.routine.logFeedSub')}
          done={feedDone}
          onPress={() => navigation.navigate('FeedLog', params)}
        />

        {/* Step 4 — Feeding-tray check (inline) */}
        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.badge, trayDone && styles.badgeDone]}>
              {trayDone
                ? <MaterialCommunityIcons name="check" size={16} color={theme.roles.light.textInverse} />
                : <Text style={styles.badgeNum}>4</Text>}
            </View>
            <MaterialCommunityIcons name="tray" size={22} color={theme.roles.light.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('engines.routine.trayCheck')}</Text>
              <Text style={styles.cardSub}>{trayDone ? t('engines.routine.trayCheckDone') : t('engines.routine.trayCheckSub')}</Text>
            </View>
          </View>

          {cropId ? (
            <>
              <View style={styles.segment}>
                {TRAYS.map((tr) => {
                  const active = tray === tr.key;
                  return (
                    <TouchableOpacity
                      key={tr.key}
                      style={[styles.segBtn, active && styles.segBtnActive]}
                      onPress={() => setTray(tr.key)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name={tr.icon} size={18} color={active ? theme.roles.light.primary : theme.roles.light.textSecondary} />
                      <Text numberOfLines={1} style={[styles.segLabel, active && { color: theme.roles.light.primary }]}>{t(`engines.tray.${tr.tkey}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Button title={t('engines.routine.saveTray')} onPress={saveTray} loading={savingTray} disabled={!tray} style={styles.saveBtn} />
            </>
          ) : (
            <Text style={styles.cardSub}>{t('engines.routine.trayNoCrop')}</Text>
          )}
        </Card>
      </ScrollView>
    </ScreenWrapper>
  );
};

const StepCard = ({ n, icon, title, subtitle, done, accent, onPress }: {
  n: number; icon: any; title: string; subtitle: string; done?: boolean; accent?: boolean; onPress: () => void;
}) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
    <Card style={[styles.card, accent && styles.cardAccent]}>
      <View style={styles.cardRow}>
        <View style={[styles.badge, done && styles.badgeDone]}>
          {done ? <MaterialCommunityIcons name="check" size={16} color={theme.roles.light.textInverse} /> : <Text style={styles.badgeNum}>{n}</Text>}
        </View>
        <MaterialCommunityIcons name={icon} size={22} color={accent ? theme.roles.light.primary : theme.roles.light.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
      </View>
    </Card>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing[4] },
  confidence: { marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  progress: { alignItems: 'center' },
  progressNum: { ...theme.typeScale.numericLarge, color: theme.roles.light.primary },
  progressDen: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textTertiary },
  progressLabel: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[3], padding: theme.spacing[4] },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: theme.roles.light.primary },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  badge: {
    width: 26, height: 26, borderRadius: theme.radius.full,
    backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center',
  },
  badgeDone: { backgroundColor: theme.roles.light.successBorder },
  badgeNum: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, fontWeight: '700' },
  cardTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
  cardSub: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
  segment: { flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[4] },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1],
    paddingVertical: theme.spacing[3], borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.roles.light.borderDefault,
  },
  segBtnActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
  segLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
  saveBtn: { marginTop: theme.spacing[4] },
});

export default DailyRoutineScreen;
