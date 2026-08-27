/**
 * HarvestTimingScreen — the Harvest-Timing Decision Engine surface
 * (farmer_features_spec §1). Adjustable inputs → verdict hero, net-profit
 * projection chart, and a scenario comparison. Professional, icon-driven UI.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/NumberField';
import { SeverityPill } from '../../components/ui/SeverityPill';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { LineChart } from '../../components/charts/LineChart';
import { theme } from '../../theme';
import { harvestTimingApi, type HarvestTimingResult } from '../../api/harvestTiming';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { useFocusEffect } from '@react-navigation/native';

const fill = (v: number | null | undefined, setter: (s: string) => void) => {
  if (v != null) setter(String(v));
};

const DEFAULT_BANDS = [
  { count: 30, price: 520 },
  { count: 40, price: 430 },
  { count: 50, price: 360 },
];

const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

export const HarvestTimingScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  const [abwNow, setAbwNow] = useState('22');
  const [adgNow, setAdgNow] = useState('0.4');
  const [nNow, setNNow] = useState('80000');
  const [areaM2, setAreaM2] = useState('4000');
  const [carrying, setCarrying] = useState('2');
  const [feedPrice, setFeedPrice] = useState('60');
  const [diseaseRisk, setDiseaseRisk] = useState('5');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HarvestTimingResult | null>(null);
  const [ctx, setCtx] = useState<PondContext | null>(null);

  // Refetch on FOCUS, not on mount. React Navigation keeps a screen
  // mounted once opened, so a mount-only effect never ran again: log a
  // reading, come back, and this still advised on the older numbers.
  useFocusEffect(useCallback(() => {
    if (!pondId) return;
    pondContextApi.get(pondId).then(({ data }) => {
      setCtx(data);
      fill(data.abwG, setAbwNow);
      fill(data.livePopulation, setNNow);
      fill(data.areaM2, setAreaM2);
      fill(data.crop?.carryingCapacityKgM2, setCarrying);
      fill(data.crop?.feedPriceRpPerKg, setFeedPrice);
    }).catch(() => {});
  }, [pondId]));

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await harvestTimingApi.optimize({
        abwNow: Number(abwNow),
        adgNow: Number(adgNow),
        nNow: Number(nNow),
        areaM2: Number(areaM2),
        carryingCapacityKgM2: Number(carrying),
        feedPricePerKg: Number(feedPrice),
        diseaseRisk: Number(diseaseRisk) / 100,
        priceBands: DEFAULT_BANDS,
        horizon: 30,
      });
      setResult(data);
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotCompute'), e?.response?.data?.message ?? t('engines.common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }, [abwNow, adgNow, nNow, areaM2, carrying, feedPrice, diseaseRisk]);

  const chart = useMemo(() => {
    if (!result) return null;
    const pts = result.projections.filter((_, i) => i % 5 === 0);
    return {
      labels: pts.map((p) => `${p.day}`),
      datasets: [{ data: pts.map((p) => Math.round(p.netProfit)) }],
    };
  }, [result]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="calendar-clock" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.harvest.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {ctx && <PrefilledBanner doc={ctx.doc} recordedAt={ctx.waterQuality?.recordedAt} />}

        {/* Inputs */}
        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>{t('engines.harvest.currentCrop')}</Text>
          <View style={styles.grid}>
            <NumberField label={t('engines.harvest.abw')} value={abwNow} onChangeText={setAbwNow} unit="g" />
            <NumberField label={t('engines.harvest.adg')} value={adgNow} onChangeText={setAdgNow} unit="g/d" />
            <NumberField label={t('engines.harvest.population')} value={nNow} onChangeText={setNNow} />
            <NumberField label={t('engines.harvest.area')} value={areaM2} onChangeText={setAreaM2} unit="m²" />
            <NumberField label={t('engines.harvest.carrying')} value={carrying} onChangeText={setCarrying} unit="kg/m²" />
            <NumberField label={t('engines.harvest.feedPrice')} value={feedPrice} onChangeText={setFeedPrice} unit="₹/kg" />
            <NumberField label={t('engines.harvest.diseaseRisk')} value={diseaseRisk} onChangeText={setDiseaseRisk} unit="%" />
          </View>
          <Button title={t('engines.harvest.computeBtn')} onPress={compute} loading={loading} style={styles.cta} />
        </Card>

        {loading && !result && <ActivityIndicator color={theme.roles.light.primary} style={{ marginTop: theme.spacing[6] }} />}

        {result && (
          <>
            {/* Verdict hero */}
            <Card style={[styles.card, styles.hero, result.recommendNow ? styles.heroNow : styles.heroHold]}>
              <SeverityPill
                severity={result.recommendNow ? 'critical' : 'success'}
                label={result.recommendNow ? t('engines.harvest.action') : t('engines.harvest.opportunity')}
                icon={result.recommendNow ? 'alert-octagon-outline' : 'trending-up'}
              />
              <Text style={styles.verdict}>
                {result.recommendNow ? t('engines.harvest.harvestNow') : t('engines.harvest.holdDays', { days: result.optimalDay })}
              </Text>
              {ctx && <ConfidenceChip confidence={ctx.confidence} />}
              {!result.recommendNow && (
                <Text style={styles.gain}>{t('engines.harvest.moreProfit', { amount: inr(result.expectedGain) })}</Text>
              )}
              {result.recommendNow && (
                <Text style={styles.gainMuted}>{t('engines.harvest.declines')}</Text>
              )}
            </Card>

            {/* Projection */}
            {chart && (
              <Card style={styles.card}>
                <Text style={styles.sectionLabel}>{t('engines.harvest.projection')}</Text>
                <LineChart data={chart} />
              </Card>
            )}

            {/* Scenarios */}
            <Card style={styles.card}>
              <Text style={styles.sectionLabel}>{t('engines.harvest.scenarios')}</Text>
              <ScenarioRow
                icon="basket-outline"
                title={t('engines.harvest.harvestToday')}
                value={inr(result.netNow)}
                meta={t('engines.harvest.countBiomass', { count: result.projections[0].count, biomass: result.projections[0].biomassKg })}
                highlight={result.recommendNow}
              />
              <ScenarioRow
                icon="clock-outline"
                title={t('engines.harvest.holdTo', { day: result.optimalDay })}
                value={inr(result.netOptimal)}
                meta={t('engines.harvest.countBiomass', { count: result.projections[result.optimalDay]?.count ?? '-', biomass: result.projections[result.optimalDay]?.biomassKg ?? '-' })}
                highlight={!result.recommendNow}
              />
              {result.partial && (
                <ScenarioRow
                  icon="call-split"
                  title={t('engines.harvest.partial', { pct: Math.round(result.partial.pct * 100) })}
                  value={inr(result.partial.total)}
                  meta={result.partial.betterThanFull ? t('engines.harvest.bestOverstocked') : t('engines.harvest.belowFull')}
                  highlight={result.partial.betterThanFull}
                />
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const ScenarioRow = ({
  icon, title, value, meta, highlight,
}: { icon: any; title: string; value: string; meta: string; highlight?: boolean }) => (
  <View style={[styles.scenario, highlight && styles.scenarioActive]}>
    <MaterialCommunityIcons
      name={icon}
      size={20}
      color={highlight ? theme.roles.light.primary : theme.roles.light.textSecondary}
    />
    <View style={{ flex: 1 }}>
      <Text style={styles.scenarioTitle}>{title}</Text>
      <Text style={styles.scenarioMeta}>{meta}</Text>
    </View>
    <Text style={[styles.scenarioValue, highlight && { color: theme.roles.light.primary }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  cta: { marginTop: theme.spacing[4] },
  hero: { alignItems: 'flex-start', gap: theme.spacing[2], borderLeftWidth: 4 },
  heroHold: { borderLeftColor: theme.roles.light.successBorder },
  heroNow: { borderLeftColor: theme.roles.light.dangerBorder },
  verdict: { ...theme.typeScale.displaySmall, color: theme.roles.light.textPrimary },
  gain: { ...theme.typeScale.bodyLarge, color: theme.roles.light.successText },
  gainMuted: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  scenario: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.roles.light.borderDefault,
  },
  scenarioActive: { backgroundColor: theme.roles.light.surfaceOverlay, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing[2] },
  scenarioTitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
  scenarioMeta: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary },
  scenarioValue: { ...theme.typeScale.numericSmall, color: theme.roles.light.textPrimary },
});

export default HarvestTimingScreen;
