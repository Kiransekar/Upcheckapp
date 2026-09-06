/**
 * FeedAdvisorScreen — Daily Feed Advisor (farmer_features_spec §3).
 * Shows the recommended ration as a single large number with per-meal split
 * and the adjustment reasons as tags. Icon-driven, no emoji.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/NumberField';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { FirstUseHint } from '../../components/ui/FirstUseHint';
import { theme } from '../../theme';
import { feedAdvisorApi, type RationResult, type TrayResidue } from '../../api/feedAdvisor';
import { apiErrorMessage } from '../../api/errors';
import { usePondContext } from '../../hooks/usePondContext';
import { MissingInputs } from '../../components/ui/MissingInputs';
import { EngineUnavailable } from '../../components/ui/EngineUnavailable';
import {
    missingInputs,
    type RequiredInput,
} from '../../features/engineInputs';

/** Set a text-field state from a context number only when it's present. */
const fill = (v: number | null | undefined, setter: (s: string) => void) => {
    if (v != null) setter(String(v));
};

const TRAYS: { key: TrayResidue; tkey: string; icon: any }[] = [
  { key: 'empty', tkey: 'empty', icon: 'circle-outline' },
  { key: 'few_left', tkey: 'fewLeft', icon: 'circle-slice-2' },
  { key: 'a_lot_left', tkey: 'aLotLeft', icon: 'circle-slice-6' },
];

export const FeedAdvisorScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  /**
   * EMPTY, not seeded (E1 / E-D1).
   *
   * These read `'120000'` and `'25'` — a whole invented pond. Combined with
   * the `.catch(() => {})` below, a farmer offline or on a cold start tapped
   * Calculate and got a confident ration computed from a population and a
   * weight nobody had ever entered, with no error and no way to tell.
   *
   * `mealsPerDay` keeps its default because 4 is a genuine PREFERENCE with a
   * sensible norm, not a measurement of this pond — nothing is fabricated by
   * assuming it, and the farmer can see and change it.
   */
  const [population, setPopulation] = useState('');
  const [abw, setAbw] = useState('');
  const [meals, setMeals] = useState('4');
  const [doVal, setDoVal] = useState('');
  const [nh3, setNh3] = useState('');
  const [temp, setTemp] = useState('');
  const [tray, setTray] = useState<TrayResidue | null>(null);
  const [molt, setMolt] = useState(false);
  const [fasting, setFasting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RationResult | null>(null);

  /**
   * The context, through the shared hook — which surfaces failure instead of
   * swallowing it, and reads through the cache so an offline farmer still gets
   * their own numbers rather than a silent nothing.
   */
  const { ctx, error: ctxError, refetch } = usePondContext(pondId);

  // Auto-fill from the farmer's latest logs — no re-asking for data already
  // entered. Only ever fills from a REAL value; there is nothing to fall back
  // to any more, which is the point.
  useEffect(() => {
    if (!ctx) return;
    fill(ctx.livePopulation, setPopulation);
    fill(ctx.abwG, setAbw);
    fill(ctx.waterQuality?.dissolvedOxygen, setDoVal);
    fill(ctx.freeAmmoniaMgL, setNh3);
    fill(ctx.waterQuality?.temperature, setTemp);
    if (ctx.latestTrayResidue) setTray(ctx.latestTrayResidue);
  }, [ctx]);

  /**
   * The two figures the ration is actually built from: `biomass = N × ABW`.
   * Everything else is a multiplier between 0.75 and 1.07, so without these
   * two there is no answer to give — only an invented one.
   */
  const required: RequiredInput[] = [
    { value: population, labelKey: 'engines.common.needsPopulation' },
    { value: abw, labelKey: 'engines.common.needsSampling' },
  ];
  const missing = missingInputs(required);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await feedAdvisorApi.compute({
        livePopulation: Number(population),
        abwG: Number(abw),
        species: ctx?.species ?? undefined,
        mealsPerDay: Number(meals),
        lastTray: tray ?? undefined,
        inMoltPeak: molt,
        fasting,
        do: doVal ? Number(doVal) : undefined,
        nh3: nh3 ? Number(nh3) : undefined,
        temp: temp ? Number(temp) : undefined,
        // Let the engine widen its own answer when the inputs are thin (E2).
        // Sent rather than applied here, so there is one definition of
        // confidence and it lives server-side.
        confidence: ctx?.confidence?.score,
      });
      setResult(data);
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotCompute'), apiErrorMessage(e, t('engines.common.tryAgain')));
    } finally {
      setLoading(false);
    }
  }, [population, abw, meals, tray, molt, fasting, doVal, nh3, temp, ctx]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="silo-outline" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.feed.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {/* The failure is a first-class state now, not a swallowed catch. */}
        {ctxError ? <EngineUnavailable onRetry={refetch} /> : null}
        {ctx && <PrefilledBanner doc={ctx.doc} recordedAt={ctx.waterQuality?.recordedAt} />}

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>{t('engines.feed.pondBiomass')}</Text>
          <View style={styles.grid}>
            <NumberField label={t('engines.feed.livePopulation')} value={population} onChangeText={setPopulation} />
            <NumberField label={t('engines.feed.abw')} value={abw} onChangeText={setAbw} unit="g" />
            <NumberField label={t('engines.feed.mealsPerDay')} value={meals} onChangeText={setMeals} keyboardType="numeric" />
          </View>

          <Text style={[styles.sectionLabel, styles.mt]}>{t('engines.feed.trayResidue')}</Text>
          <View style={styles.segment}>
            {TRAYS.map((tr) => {
              const active = tray === tr.key;
              return (
                <TouchableOpacity
                  key={tr.key}
                  style={[styles.segBtn, active && styles.segBtnActive]}
                  onPress={() => setTray(active ? null : tr.key)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={tr.icon}
                    size={18}
                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                  />
                  <Text numberOfLines={1} style={[styles.segLabel, active && { color: theme.roles.light.primary }]}>{t(`engines.tray.${tr.tkey}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, styles.mt]}>{t('engines.feed.conditions')}</Text>
          <View style={styles.grid}>
            <NumberField label={t('engines.feed.do')} value={doVal} onChangeText={setDoVal} unit="mg/L" />
            <NumberField label={t('engines.feed.nh3')} value={nh3} onChangeText={setNh3} unit="mg/L" />
            <NumberField label={t('engines.feed.temp')} value={temp} onChangeText={setTemp} unit="°C" />
          </View>

          <View style={styles.toggleRow}>
            <ToggleChip icon="moon-waning-crescent" label={t('engines.feed.moltPeak')} value={molt} onChange={setMolt} />
            <ToggleChip icon="food-off-outline" label={t('engines.feed.fasting')} value={fasting} onChange={setFasting} />
          </View>

          {/* Names what is missing, in the farmer's terms, instead of
              quietly computing from a seeded default. */}
          <MissingInputs missing={missing} />
          <Button
            title={t('engines.feed.calculate')}
            onPress={compute}
            loading={loading}
            // An engine that refuses can be trusted; one that guesses cannot.
            disabled={missing.length > 0}
            style={styles.cta}
          />
        </Card>

        {result && (
          <Card style={[styles.card, styles.hero]}>
            {/* ALWAYS rendered — reads "no data" when there is none. */}
            <ConfidenceChip confidence={ctx?.confidence} showHint />
            {ctx && (
              <FirstUseHint
                flagKey="confidence-chip"
                message={t(
                  'engines.common.confidenceHint',
                  'This score shows how complete and recent your logged readings are — the higher it is, the more this recommendation can be trusted.',
                )}
              />
            )}
            <Text style={styles.heroLabel}>{t('engines.feed.recommended')}</Text>
            {/*
              * A RANGE when the inputs are thin (E2), not a point value with a
              * worried chip beside it. The chip said "low confidence" while the
              * number said "47 kg" in 40pt — and only one of those is what a
              * farmer acts on.
              */}
            {result.range ? (
              <>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>
                    {result.range.lowKg}–{result.range.highKg}
                  </Text>
                  <Text style={styles.heroUnit}>kg</Text>
                </View>
                {/* Says WHY it is a range, and what would narrow it. */}
                <Text style={styles.rangeWhy}>
                  {t('engines.feed.rangeWhy')}
                  {ctx && [...ctx.confidence.missing, ...ctx.confidence.stale].length > 0
                    ? ` ${t('engines.common.improveHint', {
                          items: [...ctx.confidence.missing, ...ctx.confidence.stale]
                              .slice(0, 3)
                              .join(', '),
                      })}`
                    : ''}
                </Text>
              </>
            ) : (
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>{result.recommendedKg}</Text>
                <Text style={styles.heroUnit}>kg</Text>
              </View>
            )}
            <Text style={styles.heroSub}>
              {t('engines.feed.biomassFr', { biomass: result.biomassKg, fr: result.frPct })}
            </Text>

            <View style={styles.meals}>
              {result.perMeal.map((m, i) => (
                <View key={i} style={styles.mealChip}>
                  <MaterialCommunityIcons name="circle-small" size={16} color={theme.roles.light.primary} />
                  <Text style={styles.mealText}>{m} kg</Text>
                </View>
              ))}
            </View>

            {result.reasons.length > 0 && (
              <View style={styles.reasons}>
                {result.reasons.map((r, i) => (
                  <View key={i} style={styles.reasonTag}>
                    <MaterialCommunityIcons name="information-outline" size={13} color={theme.roles.light.textSecondary} />
                    <Text style={styles.reasonText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const ToggleChip = ({ icon, label, value, onChange }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <View style={styles.toggleChip}>
    <MaterialCommunityIcons name={icon} size={18} color={value ? theme.roles.light.primary : theme.roles.light.textSecondary} />
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: theme.roles.light.primary, false: theme.roles.light.borderStrong }}
      thumbColor={theme.roles.light.surface}
    />
  </View>
);

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  mt: { marginTop: theme.spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  segment: { flexDirection: 'row', gap: theme.spacing[2] },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1],
    paddingVertical: theme.spacing[3], borderRadius: theme.radius.sm,
    borderWidth: 1, borderColor: theme.roles.light.borderDefault,
  },
  segBtnActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
  segLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
  toggleRow: { flexDirection: 'row', gap: theme.spacing[3], marginTop: theme.spacing[4] },
  toggleChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2],
    paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.roles.light.borderDefault,
  },
  toggleLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textPrimary, flex: 1 },
  cta: { marginTop: theme.spacing[5] },
  hero: { alignItems: 'center' },
  heroLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[1], marginTop: theme.spacing[1] },
  heroValue: { ...theme.typeScale.numericHero, color: theme.roles.light.primary },
  rangeWhy: {
    ...theme.typeScale.bodySmall,
    color: theme.roles.light.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing[1],
  },
  heroUnit: { ...theme.typeScale.h2, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[2] },
  heroSub: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  meals: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginTop: theme.spacing[4], justifyContent: 'center' },
  mealChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing[1], paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.full, backgroundColor: theme.roles.light.surfaceVariant,
  },
  mealText: { ...theme.typeScale.labelMedium, color: theme.roles.light.textPrimary },
  reasons: { gap: theme.spacing[2], marginTop: theme.spacing[4], alignSelf: 'stretch' },
  reasonTag: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  reasonText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, flex: 1 },
});

export default FeedAdvisorScreen;
