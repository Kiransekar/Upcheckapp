/**
 * AerationScreen — Aeration & Power Optimizer (farmer_features_spec §4).
 * Adequacy gauge (installed vs required HP), pre-dawn DO-min forecast with a
 * recommended run-time, and a power-cost readout.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/NumberField';
import { GaugeArc } from '../../components/charts/GaugeArc';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { aerationApi, type AerationAdequacy } from '../../api/aeration';
import { apiErrorMessage } from '../../api/errors';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { useFocusEffect } from '@react-navigation/native';

const fill = (v: number | null | undefined, setter: (s: string) => void) => {
  if (v != null) setter(String(v));
};

export const AerationScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  const [biomass, setBiomass] = useState('2000');
  const [installedHp, setInstalledHp] = useState('4');
  const [currentDo, setCurrentDo] = useState('6');
  const [area, setArea] = useState('4000');
  const [runHours, setRunHours] = useState('6');
  const [ratePerKwh, setRatePerKwh] = useState('8');

  const [loading, setLoading] = useState(false);
  const [adq, setAdq] = useState<AerationAdequacy | null>(null);
  const [night, setNight] = useState<{ predicted: number; recommendedRunHours: number } | null>(null);
  const [power, setPower] = useState<{ cost: number; costPerKg: number | null } | null>(null);
  const [ctx, setCtx] = useState<PondContext | null>(null);

  // Refetch on FOCUS, not on mount. React Navigation keeps a screen
  // mounted once opened, so a mount-only effect never ran again: log a
  // reading, come back, and this still advised on the older numbers.
  useFocusEffect(useCallback(() => {
    if (!pondId) return;
    pondContextApi.get(pondId).then(({ data }) => {
      setCtx(data);
      fill(data.biomassKg, setBiomass);
      fill(data.waterQuality?.dissolvedOxygen, setCurrentDo);
      fill(data.areaM2, setArea);
      fill(data.installedAeratorHp, setInstalledHp);
    }).catch(() => {});
  }, [pondId]));

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const [a, n, p] = await Promise.all([
        aerationApi.adequacy(Number(biomass), Number(installedHp)),
        aerationApi.nightDo({
          currentDo: Number(currentDo),
          biomassKg: Number(biomass),
          areaM2: Number(area),
          installedHp: Number(installedHp),
          runHours: Number(runHours),
          doTarget: 4,
        }),
        aerationApi.powerCost({
          mode: 'grid',
          totalHp: Number(installedHp),
          ratePerKwh: Number(ratePerKwh),
          runHours: Number(runHours),
        }),
      ]);
      setAdq(a.data);
      setNight(n.data);
      setPower(p.data);
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotCompute'), apiErrorMessage(e, t('engines.common.tryAgain')));
    } finally {
      setLoading(false);
    }
  }, [biomass, installedHp, currentDo, area, runHours, ratePerKwh]);

  const ratio = adq ? Math.min(1, adq.adequacyRatio) : 0;
  const gaugeColor = adq?.underAerated ? theme.roles.light.dangerBorder : theme.roles.light.successBorder;
  const doColor =
    night && night.predicted < 4 ? theme.roles.light.dangerText : theme.roles.light.successText;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="fan" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.aeration.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {ctx && <PrefilledBanner doc={ctx.doc} recordedAt={ctx.waterQuality?.recordedAt} />}

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>{t('engines.aeration.inputs')}</Text>
          <View style={styles.grid}>
            <NumberField label={t('engines.aeration.biomass')} value={biomass} onChangeText={setBiomass} unit="kg" />
            <NumberField label={t('engines.aeration.installed')} value={installedHp} onChangeText={setInstalledHp} unit="HP" />
            <NumberField label={t('engines.aeration.currentDo')} value={currentDo} onChangeText={setCurrentDo} unit="mg/L" />
            <NumberField label={t('engines.aeration.area')} value={area} onChangeText={setArea} unit="m²" />
            <NumberField label={t('engines.aeration.runHours')} value={runHours} onChangeText={setRunHours} unit="h" />
            <NumberField label={t('engines.aeration.tariff')} value={ratePerKwh} onChangeText={setRatePerKwh} unit="₹/kWh" />
          </View>
          <Button title={t('engines.aeration.analyze')} onPress={compute} loading={loading} style={styles.cta} />
        </Card>

        {adq && (
          <Card style={[styles.card, { alignItems: 'center' }]}>
            {ctx && <ConfidenceChip confidence={ctx.confidence} />}
            <Text style={styles.sectionLabel}>{t('engines.aeration.adequacy')}</Text>
            <GaugeArc
              value={ratio}
              color={gaugeColor}
              centerLabel={`${Math.round(ratio * 100)}%`}
              caption={`${adq.installedHp} / ${adq.requiredHp} HP`}
            />
            <Text style={[styles.gaugeNote, { color: gaugeColor }]}>
              {adq.underAerated ? t('engines.aeration.addHp', { hp: adq.deficitHp }) : t('engines.aeration.adequate')}
            </Text>
          </Card>
        )}

        {night && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>{t('engines.aeration.doForecast')}</Text>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('engines.aeration.predictedMin')}</Text>
                <Text style={[styles.statValue, { color: doColor }]}>{night.predicted} mg/L</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('engines.aeration.runToHold')}</Text>
                <Text style={styles.statValue}>{night.recommendedRunHours} h</Text>
              </View>
            </View>
          </Card>
        )}

        {power && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>{t('engines.aeration.powerCost')}</Text>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('engines.aeration.perNight')}</Text>
                <Text style={styles.statValue}>₹{power.cost.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  cta: { marginTop: theme.spacing[4] },
  gaugeNote: { ...theme.typeScale.bodyMedium, marginTop: theme.spacing[3], textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: theme.spacing[6] },
  stat: { flex: 1 },
  statLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[1] },
  statValue: { ...theme.typeScale.numericMedium, color: theme.roles.light.textPrimary },
});

export default AerationScreen;
