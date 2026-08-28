/**
 * MorningBriefingScreen — the "open the app, know what to do today" hub.
 * One row per pond with its highest-priority ALERT, ordered by severity, when
 * there's something wrong. When everything is fine (the common case on a good
 * day), it doesn't just say "all clear" and stop — it shows each pond's daily
 * routine checklist (water check / feed / tray) instead, so this screen is
 * always the actionable "today" destination, not just an exception feed
 * (previously this screen and DailyRoutineScreen competed for the same
 * "daily" territory with no clear front door — see docs/UI_UX_AUDIT.md
 * Tier 1 #2 and docs/ONBOARDING_MODULE_PLAN.md Phase 2).
 */
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { CacheNotice } from '../../components/ui/CacheNotice';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SeverityPill, type Severity } from '../../components/ui/SeverityPill';
import { theme } from '../../theme';
import { alertCenterApi, type BriefingItem } from '../../api/alertCenter';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondContextApi } from '../../api/pondContext';
import { qk } from '../../query/client';
import { useAppQuery, useRefetchOnFocus } from '../../query/hooks';

const isToday = (iso: string | null | undefined) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();

interface RoutineSummary {
  pondId: string;
  pondName: string;
  doc: number | null;
  wqDone: boolean;
  feedDone: boolean;
  trayDone: boolean;
}

const sevMap = (s: string): Severity => (s === 'critical' ? 'critical' : s === 'watch' ? 'watch' : 'info');
const sevRank = (s: string) => (s === 'critical' ? 3 : s === 'watch' ? 2 : 1);

/** One card per pond — keep the highest-severity item, sum the alert counts. */
const mergeByPond = (items: BriefingItem[]): BriefingItem[] => {
  const byPond = new Map<string, BriefingItem>();
  for (const it of items) {
    const key = it.pondId ?? 'farm';
    const cur = byPond.get(key);
    if (!cur) {
      byPond.set(key, { ...it });
    } else {
      const top = sevRank(it.topSeverity) > sevRank(cur.topSeverity) ? it : cur;
      byPond.set(key, { ...top, alertCount: cur.alertCount + it.alertCount });
    }
  }
  return [...byPond.values()].sort((a, b) => sevRank(b.topSeverity) - sevRank(a.topSeverity));
};
const sourceIcon: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  feed: 'silo-outline',
  disease: 'shield-alert-outline',
  lunar: 'moon-waning-crescent',
  harvest: 'calendar-clock',
  aeration: 'fan',
  weather: 'weather-lightning-rainy',
};

/**
 * Alerts, and — on a good day, when there are none — the routine checklist.
 *
 * One cached, disk-persisted read under `['briefing']`, so this screen opens on
 * yesterday's answer with no signal instead of a spinner that never resolves.
 * The routine fan-out still only runs when there are zero alerts: a farmer with
 * real alerts should not wait on N pond-context calls they do not need yet.
 */
const loadBriefing = async (): Promise<{ items: BriefingItem[]; routines: RoutineSummary[] | null }> => {
  // Live engine alerts (recomputed from latest data) + persisted alerts,
  // merged to one card per pond keeping the highest severity.
  const [live, persisted] = await Promise.all([
    alertCenterApi.liveBriefing().catch(() => ({ data: [] as BriefingItem[] })),
    alertCenterApi.briefing().catch(() => ({ data: [] as BriefingItem[] })),
  ]);
  const items = mergeByPond([...live.data, ...persisted.data]);
  if (items.length > 0) return { items, routines: null };

  const { data: ponds } = await pondsApi.getMine();
  const active = ponds.filter((p: Pond) => p.activeCycleId);
  const summaries = await Promise.all(
    active.map(async (p: Pond) => {
      try {
        const { data: ctx } = await pondContextApi.get(p.id);
        return {
          pondId: p.id,
          pondName: p.displayName || p.name,
          doc: ctx.doc,
          wqDone: isToday(ctx.waterQuality?.recordedAt),
          feedDone: isToday(ctx.lastFeedAt),
          trayDone: isToday(ctx.lastTrayAt),
        } as RoutineSummary;
      } catch {
        return null;
      }
    }),
  );
  return { items, routines: summaries.filter((s): s is RoutineSummary => s != null) };
};

export const MorningBriefingScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const query = useAppQuery({ queryKey: qk.briefing(), queryFn: loadBriefing });

  // Refetch on FOCUS, not just on mount. React Navigation keeps a screen mounted
  // once it has been opened, so a mount-only effect never ran again: log
  // something in a pond, come back here, and the page still showed the
  // figures from before the log until the app was force-refreshed.
  useRefetchOnFocus(qk.briefing());

  const items = query.data?.items ?? null;
  const routines = query.data?.routines ?? null;
  const refreshing = query.isRefetching;
  const load = () => query.refetch();

  return (
    <ScreenWrapper>
      <View style={styles.head}>
        <MaterialCommunityIcons name="weather-sunset-up" size={26} color={theme.roles.light.primary} />
        <Text style={styles.title}>{t('engines.briefing.title')}</Text>
      </View>

      <CacheNotice updatedAt={query.dataUpdatedAt} stale={query.isError} />

      {/* A failed read is not "all clear" — that distinction is the whole point
          of the error branch. Only shown when there is no cached copy at all. */}
      {query.isError && items === null ? (
        <ErrorState error={query.error} onRetry={load} />
      ) : items === null ? (
        <ActivityIndicator color={theme.roles.light.primary} style={{ marginTop: theme.spacing[8] }} />
      ) : items.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        >
          <View style={styles.allClearBanner}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.roles.light.successText} />
            <Text style={styles.allClearText}>{t('engines.briefing.allClear')}</Text>
          </View>

          {routines === null ? (
            <ActivityIndicator color={theme.roles.light.primary} style={{ marginTop: theme.spacing[6] }} />
          ) : routines.length === 0 ? (
            <EmptyState icon="clipboard-check-outline" title={t('engines.briefing.noPondsTitle')} subtitle={t('engines.briefing.noPondsSub')} />
          ) : (
            <>
              <Text style={styles.sectionLabel}>{t('engines.briefing.routineSectionTitle')}</Text>
              {routines.map((r) => {
                const done = [r.wqDone, r.feedDone, r.trayDone].filter(Boolean).length;
                return (
                  <TouchableOpacity
                    key={r.pondId}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('DailyRoutine', { pondId: r.pondId, pondName: r.pondName })}
                  >
                    <Card style={styles.routineCard}>
                      <View style={styles.routineHead}>
                        <Text style={styles.routinePond}>{r.pondName}{r.doc != null ? ` · DOC ${r.doc}` : ''}</Text>
                        <Text style={styles.routineCount}>{done}/3</Text>
                      </View>
                      <View style={styles.routineSteps}>
                        <RoutineStepIcon icon="water-percent" done={r.wqDone} />
                        <RoutineStepIcon icon="silo-outline" done={r.feedDone} />
                        <RoutineStepIcon icon="tray" done={r.trayDone} />
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textTertiary} style={{ marginLeft: 'auto' }} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        >
          {items.map((it, i) => (
            <Card key={i} style={[styles.card, { borderLeftColor: barColor(it.topSeverity) }]}>
              <View style={styles.cardHead}>
                <MaterialCommunityIcons
                  name={sourceIcon[it.source] ?? 'bell-outline'}
                  size={20}
                  color={theme.roles.light.textSecondary}
                />
                <Text style={styles.pond}>{it.pondId ? t('engines.briefing.pond', { id: it.pondId.slice(0, 8) }) : t('engines.briefing.farm')}</Text>
                <SeverityPill severity={sevMap(it.topSeverity)} label={it.topSeverity} />
              </View>
              <Text style={styles.action}>{it.topTitle}</Text>
              {it.steps.slice(0, 2).map((s, j) => (
                <View key={j} style={styles.step}>
                  <MaterialCommunityIcons name="arrow-right-thin" size={16} color={theme.roles.light.primary} />
                  <Text style={styles.stepText}>{s}</Text>
                </View>
              ))}
              {it.alertCount > 1 && (
                <Text style={styles.more}>
                  {t(it.alertCount > 2 ? 'engines.briefing.moreAlerts' : 'engines.briefing.moreAlert', { count: it.alertCount - 1 })}
                </Text>
              )}
            </Card>
          ))}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
};

const barColor = (s: string) =>
  s === 'critical' ? theme.roles.light.dangerBorder : s === 'watch' ? theme.roles.light.warningBorder : theme.roles.light.infoBorder;

const RoutineStepIcon = ({ icon, done }: { icon: any; done: boolean }) => (
  <View style={[styles.stepIconWrap, done && styles.stepIconWrapDone]}>
    <MaterialCommunityIcons name={icon} size={16} color={done ? theme.roles.light.successText : theme.roles.light.textTertiary} />
  </View>
);

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  card: { marginBottom: theme.spacing[3], padding: theme.spacing[4], borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[2] },
  pond: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, flex: 1 },
  allClearBanner: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[5] },
  allClearText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.successText, fontWeight: '600' },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  routineCard: { marginBottom: theme.spacing[3], padding: theme.spacing[4] },
  routineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[3] },
  routinePond: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, fontWeight: '600', flex: 1 },
  routineCount: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
  routineSteps: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  stepIconWrap: {
    width: 32, height: 32, borderRadius: theme.radius.full,
    backgroundColor: theme.roles.light.surfaceVariant, alignItems: 'center', justifyContent: 'center',
  },
  stepIconWrapDone: { backgroundColor: theme.roles.light.successBg },
  action: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, marginBottom: theme.spacing[2] },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[1] },
  stepText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textPrimary, flex: 1 },
  more: { ...theme.typeScale.caption, color: theme.roles.light.textTertiary, marginTop: theme.spacing[2] },
});

export default MorningBriefingScreen;
