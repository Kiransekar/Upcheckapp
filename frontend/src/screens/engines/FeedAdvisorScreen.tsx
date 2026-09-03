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
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { useFocusEffect } from '@react-navigation/native';

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
  const [population, setPopulation] = useState('120000');
  const [abw, setAbw] = useState('25');
  const [meals, setMeals] = useState('4');
  const [doVal, setDoVal] = useState('');
  const [nh3, setNh3] = useState('');
  const [temp, setTemp] = useState('');
  const [tray, setTray] = useState<TrayResidue | null>(null);
  const [molt, setMolt] = useState(false);
  const [fasting, setFasting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RationResult | null>(null);
  const [ctx, setCtx] = useState<PondContext | null>(null);

  // Auto-fill from the farmer's latest logs — no re-asking for data already entered.
  // Refetch on FOCUS, not on mount. React Navigation keeps a screen
  // mounted once opened, so a mount-only effect never ran again: log a
  // reading, come back, and this still advised on the older numbers.
  useFocusEffect(useCallback(() => {
    if (!pondId) return;
    pondContextApi.get(pondId).then(({ data }) => {
      setCtx(data);
      fill(data.livePopulation, setPopulation);
      fill(data.abwG, setAbw);
      fill(data.waterQuality?.dissolvedOxygen, setDoVal);
      fill(data.freeAmmoniaMgL, setNh3);
      fill(data.waterQuality?.temperature, setTemp);
      if (data.latestTrayResidue) setTray(data.latestTrayResidue);
    }).catch(() => {});
  }, [pondId]));

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

          <Button title={t('engines.feed.calculate')} onPress={compute} loading={loading} style={styles.cta} />
        </Card>

        {result && (
          <Card style={[styles.card, styles.hero]}>
            {ctx && <ConfidenceChip confidence={ctx.confidence} showHint />}
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
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{result.recommendedKg}</Text>
              <Text style={styles.heroUnit}>kg</Text>
            </View>
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
