/**
 * LunarScreen — Lunar Molt module (lunar_module_spec). Shows the current moon
 * phase as a vector diagram, the molt window, and (with the pond's latest ABW)
 * the molt-risk band with steps.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/NumberField';
import { SeverityPill, type Severity } from '../../components/ui/SeverityPill';
import { MoonDiagram } from '../../components/charts/MoonDiagram';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { FirstUseHint } from '../../components/ui/FirstUseHint';
import { theme } from '../../theme';
import { lunarApi, type MoonPhase, type MoltRisk, type LunarPlaybook, type PlaybookStep, type StepCategory, type StepPriority, type MoltVulnerabilityInput } from '../../api/lunar';
import { type PondContext } from '../../api/pondContext';
import { usePondContext } from '../../hooks/usePondContext';
import { MissingInputs } from '../../components/ui/MissingInputs';
import { EngineUnavailable } from '../../components/ui/EngineUnavailable';
import { missingInputs, type RequiredInput } from '../../features/engineInputs';
import { localizePhaseName } from '../../features/lunarPhaseI18n';
import { apiErrorMessage } from '../../api/errors';

const bandSeverity = (b: string): Severity =>
  b === 'Critical' ? 'critical' : b === 'Watch' ? 'watch' : 'low';

const CATEGORY_ICON: Record<StepCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  mineral: 'flask-outline',
  aeration: 'fan',
  feed: 'food-variant',
  handling: 'hand-back-right-outline',
  biosecurity: 'shield-outline',
  water: 'water-outline',
  monitoring: 'clipboard-check-outline',
  general: 'information-outline',
};

const PRIORITY_RANK: Record<StepPriority, number> = { critical: 0, important: 1, routine: 2 };

// Map the pond's latest snapshot into the molt-vulnerability factors so the
// playbook steps are driven by real data, not just the moon phase.
const buildVulnerability = (c: PondContext): MoltVulnerabilityInput => {
  const v: MoltVulnerabilityInput = {};
  const wq = c.waterQuality;
  if (wq?.dissolvedOxygen != null) v.do = wq.dissolvedOxygen;
  if (wq?.temperature != null) v.temp = wq.temperature;
  if (wq?.salinity != null) v.salinity = wq.salinity;
  if (c.freeAmmoniaMgL != null) v.freeNh3 = c.freeAmmoniaMgL;
  // Alkalinity as a shell-reserve proxy: deficit below the 120 ppm molt target.
  if (wq?.alkalinity != null) v.mineralDeficitFrac = Math.max(0, (120 - wq.alkalinity) / 120);
  if (c.biomassKg != null && c.areaM2 && c.crop?.carryingCapacityKgM2) {
    v.densityRatio = c.biomassKg / c.areaM2 / c.crop.carryingCapacityKgM2;
  }
  if (c.latestTrayResidue) v.tray = c.latestTrayResidue;
  return v;
};

export const LunarScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  const [phase, setPhase] = useState<MoonPhase | null>(null);
  const [abw, setAbw] = useState('');
  const [risk, setRisk] = useState<MoltRisk | null>(null);
  const [playbook, setPlaybook] = useState<LunarPlaybook | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Through the shared hook (E1): a failure is a state this screen renders,
   * not a swallowed catch that leaves a seeded ABW standing in for a sampling.
   */
  const { ctx, error: ctxError, refetch } = usePondContext(pondId);

  useEffect(() => {
    lunarApi.phase().then(({ data }) => setPhase(data)).catch(() => undefined);
  }, []);

  // Prefill ABW from the latest sampling — only when there IS one.
  useEffect(() => {
    if (ctx?.abwG != null) setAbw(String(ctx.abwG));
  }, [ctx]);

  /** Molt vulnerability scales with size; without ABW it is not this pond's. */
  const required: RequiredInput[] = [
    { value: abw, labelKey: 'engines.common.needsSampling' },
  ];
  const missing = missingInputs(required);

  const assess = useCallback(async () => {
    setLoading(true);
    try {
      const vulnerability = ctx ? buildVulnerability(ctx) : undefined;
      // No fallback. An empty field used to become a 20 g shrimp silently,
      // which is the same fabrication in miniature — the assess button is
      // disabled until a real sampling exists.
      const { data } = await lunarApi.risk({ abwG: Number(abw), vulnerability });
      setPhase(data.phase);
      setRisk(data.risk);
      setPlaybook(data.playbook);
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotCompute'), apiErrorMessage(e, t('engines.common.tryAgain')));
    } finally {
      setLoading(false);
    }
  }, [abw, ctx, t]);

  // Surface the phase playbook automatically: once on open, and again when the
  // pond snapshot loads (so the steps reflect the pond's latest data).
  // Auto-assess once the pond snapshot lands — but only when there is
  // actually an ABW to assess. It used to fire regardless and fall back to a
  // 20 g default, so the screen showed a molt risk for an invented shrimp.
  useEffect(() => {
    if (missing.length === 0) assess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.lunar.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {phase && (
          <Card style={[styles.card, styles.phaseCard]}>
            <MoonDiagram phase={phase.phase} size={104} />
            <View style={{ flex: 1 }}>
              <Text style={styles.phaseName}>{localizePhaseName(phase.name, t)}</Text>
              <Text style={styles.phaseMeta}>{t('engines.lunar.illuminated', { pct: Math.round(phase.illumination * 100) })}</Text>
              {phase.inMoltWindow ? (
                <SeverityPill severity="watch" label={t('engines.lunar.moltWindow', { days: phase.daysToSpringTide.toFixed(1) })} icon="waves" />
              ) : (
                <SeverityPill severity="low" label={t('engines.lunar.toNextWindow', { days: phase.daysToSpringTide.toFixed(1) })} icon="calendar-blank-outline" />
              )}
              {/*
                * The actual DATES (E5.1) — true phase, corrected per Meeus,
                * and already bucketed into IST by the server.
                *
                * "5.6 days to the next spring tide" is not something a farmer
                * can hold against their Panchang; a date is. And these are the
                * first dates this screen has shown that agree with one: the
                * mean-phase instant could be ±14 h out, and was formatted
                * without converting to IST, so a phase after 18:30 UTC named
                * the previous day.
                */}
              {phase.nextNewMoonIst && (
                <Text style={styles.phaseDates}>
                  {t('engines.lunar.nextNewMoon', { date: phase.nextNewMoonIst })}
                </Text>
              )}
              {phase.nextFullMoonIst && (
                <Text style={styles.phaseDates}>
                  {t('engines.lunar.nextFullMoon', { date: phase.nextFullMoonIst })}
                </Text>
              )}
            </View>
          </Card>
        )}

        {ctxError ? <EngineUnavailable onRetry={refetch} /> : null}
        {ctx && ctx.abwG != null && <PrefilledBanner doc={ctx.doc} />}

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>{t('engines.lunar.assessment')}</Text>
          <View style={styles.row}>
            <NumberField label={t('engines.lunar.abw')} value={abw} onChangeText={setAbw} unit="g" />
            <Button
              title={t('engines.lunar.assess')}
              onPress={assess}
              loading={loading}
              disabled={missing.length > 0}
              style={styles.assessBtn}
            />
          </View>

          <MissingInputs missing={missing} />

          {risk && (
            <View style={styles.riskBox}>
              <View style={styles.riskTop}>
                <Text style={styles.riskScore}>{risk.score}</Text>
                <SeverityPill severity={bandSeverity(risk.band)} label={risk.band} />
              </View>
              <Text style={styles.riskMeta}>
                {t('engines.lunar.moltPressure', { pressure: Math.round(risk.moltPressure * 100), vuln: Math.round(risk.vulnerability * 100) })}
              </Text>
              <ConfidenceChip confidence={ctx?.confidence} />
              {/* E4: molt likelihood is a prediction, not a measurement. */}
              <FirstUseHint
                flagKey="lunar-heuristic"
                message={t('engines.common.heuristicNote')}
              />
            </View>
          )}
        </Card>

        {playbook && (
          <Card style={styles.card}>
            <View style={styles.playbookHead}>
              <Text style={styles.phaseLabel}>{playbook.phaseLabel}</Text>
              <Text style={styles.headline}>{playbook.headline}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t('engines.lunar.management')}</Text>
            {[...playbook.steps]
              .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
              .map((step, i) => (
                <PlaybookRow key={i} step={step} priorityLabel={t(`engines.lunar.priority_${step.priority}`)} />
              ))}

            <View style={styles.noteBox}>
              <MaterialCommunityIcons name="information-outline" size={14} color={theme.roles.light.textTertiary} />
              <Text style={styles.noteText}>{playbook.note}</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const PRIORITY_STYLE: Record<StepPriority, { bg: string; fg: string }> = {
  critical: { bg: theme.roles.light.dangerBg, fg: theme.roles.light.dangerText },
  important: { bg: theme.roles.light.warningBg, fg: theme.roles.light.warningText },
  routine: { bg: theme.roles.light.surfaceVariant, fg: theme.roles.light.textSecondary },
};

const PlaybookRow = ({ step, priorityLabel }: { step: PlaybookStep; priorityLabel: string }) => {
  const ps = PRIORITY_STYLE[step.priority];
  return (
    <View style={styles.pbRow}>
      <View style={[styles.pbIcon, { backgroundColor: ps.bg }]}>
        <MaterialCommunityIcons name={CATEGORY_ICON[step.category]} size={18} color={ps.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pbText}>{step.text}</Text>
        {step.priority !== 'routine' && (
          <Text style={[styles.pbPriority, { color: ps.fg }]}>{priorityLabel}</Text>
        )}
        {/*
          * WHY this step is here (E5.2). The backend tags every data-driven
          * step with the datum that produced it and the screen threw it away —
          * the same "show your reasoning" standard the feed advisor's
          * `reasons[]` already sets — which is what makes advice checkable
          * rather than oracular.
          */}
        {step.trigger ? <Text style={styles.pbTrigger}>{step.trigger}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
  pbTrigger: {
    ...theme.typeScale.bodySmall,
    color: theme.roles.light.textTertiary,
    marginTop: theme.spacing[1],
  },
  phaseDates: {
    ...theme.typeScale.bodySmall,
    color: theme.roles.light.textSecondary,
    marginTop: theme.spacing[1],
  },
  phaseCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  phaseName: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
  phaseMeta: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[2] },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] },
  assessBtn: { minWidth: 110 },
  riskBox: { marginTop: theme.spacing[4], gap: theme.spacing[2] },
  riskTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  riskScore: { ...theme.typeScale.numericLarge, color: theme.roles.light.textPrimary },
  riskMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
  playbookHead: { marginBottom: theme.spacing[4] },
  phaseLabel: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
  headline: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginTop: theme.spacing[1] },
  pbRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3], marginBottom: theme.spacing[3] },
  pbIcon: {
    width: 34, height: 34, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  pbText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary },
  pbPriority: {
    ...theme.typeScale.caption,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
    paddingTop: theme.spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.roles.light.borderDefault,
  },
  noteText: { ...theme.typeScale.caption, color: theme.roles.light.textTertiary, flex: 1 },
});

export default LunarScreen;
