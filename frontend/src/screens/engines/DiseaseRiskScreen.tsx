/**
 * DiseaseRiskScreen — Disease Early-Warning (farmer_features_spec §2).
 * The farmer taps the signs/conditions they observe; the engine returns ranked
 * per-disease risk with transparent triggers and corrective steps.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SeverityPill, type Severity } from '../../components/ui/SeverityPill';
import { PrefilledBanner } from '../../components/ui/PrefilledBanner';
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
import { theme } from '../../theme';
import { diseaseWarningApi, type DiseaseIndicators, type DiseaseRisk } from '../../api/diseaseWarning';
import { apiErrorMessage } from '../../api/errors';
import { usePondContext } from '../../hooks/usePondContext';
import { MissingInputs } from '../../components/ui/MissingInputs';
import { EngineUnavailable } from '../../components/ui/EngineUnavailable';
import { missingInputs, type RequiredInput } from '../../features/engineInputs';

const INDICATORS: { key: keyof DiseaseIndicators; tkey: string }[] = [
  { key: 'tempDrop3in48h', tkey: 'ind_tempDrop' },
  { key: 'doBelow4', tkey: 'ind_lowDo' },
  { key: 'seasonWinter', tkey: 'ind_winter' },
  { key: 'redBody', tkey: 'ind_redBody' },
  { key: 'emptyGut', tkey: 'ind_emptyGut' },
  { key: 'paleHp', tkey: 'ind_paleHp' },
  { key: 'yellowVibrioUp', tkey: 'ind_yellowVibrio' },
  { key: 'whiteFecesTray', tkey: 'ind_whiteFeces' },
  { key: 'sizeCvUp', tkey: 'ind_sizeCv' },
  { key: 'adgBelowExpected', tkey: 'ind_slowGrowth' },
  { key: 'luminousVibrioUp', tkey: 'ind_luminousVibrio' },
  { key: 'nightGlow', tkey: 'ind_nightGlow' },
  { key: 'chronicDailyMortality', tkey: 'ind_chronicMortality' },
  { key: 'looseShellObs', tkey: 'ind_looseShell' },
  { key: 'mineralDeficit', tkey: 'ind_mineralDeficit' },
  { key: 'multiStress', tkey: 'ind_multiStress' },
];

const bandSeverity = (band: string): Severity =>
  band === 'Critical' ? 'critical' : band === 'Watch' ? 'watch' : 'low';

export const DiseaseRiskScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [risks, setRisks] = useState<DiseaseRisk[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  /**
   * Through the shared hook: a failure is a state the screen must render, not
   * a `.catch(() => {})` that leaves seeded defaults standing in for data.
   */
  const { ctx, error: ctxError, refetch } = usePondContext(pondId);

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  // Pre-flag measurable indicators from the latest water-quality log.
  // Refetch on FOCUS, not on mount. React Navigation keeps a screen
  // mounted once opened, so a mount-only effect never ran again: log a
  // reading, come back, and this still advised on the older numbers.
  // Auto-fill from the farmer's own logs. Only ever from a REAL value —
  // there is nothing to fall back to any more, which is the point (E1).
  useEffect(() => {
    if (!ctx) return;
      const wq = ctx.waterQuality;
      setSelected((s) => ({
        ...s,
        doBelow4: wq?.dissolvedOxygen != null ? wq.dissolvedOxygen < 4 : s.doBelow4,
      }));
  }, [ctx]);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const indicators: DiseaseIndicators = {};
      for (const i of INDICATORS) if (selected[i.key]) (indicators as any)[i.key] = true;
      const { data } = await diseaseWarningApi.compute(indicators);
      setRisks(data);
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotCompute'), apiErrorMessage(e, t('engines.common.tryAgain')));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const top = useMemo(() => risks?.[0], [risks]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="shield-alert-outline" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.disease.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {/* A failure is a state now, not a swallowed catch (E1). */}
        {ctxError ? <EngineUnavailable onRetry={refetch} /> : null}
        {ctx && ctx.waterQuality && <PrefilledBanner doc={ctx.doc} recordedAt={ctx.waterQuality.recordedAt} />}

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>{t('engines.disease.whatSeeing')}</Text>
          <View style={styles.chips}>
            {INDICATORS.map((i) => {
              const active = !!selected[i.key];
              return (
                <TouchableOpacity
                  key={i.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggle(i.key)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={active ? 'check-circle' : 'circle-outline'}
                    size={15}
                    color={active ? theme.roles.light.primary : theme.roles.light.textTertiary}
                  />
                  <Text style={[styles.chipText, active && { color: theme.roles.light.primary }]}>{t(`engines.disease.${i.tkey}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button title={t('engines.disease.assess')} onPress={compute} loading={loading} style={styles.cta} />
        </Card>

        {top && (
          <Card style={[styles.card, styles.topCard, { borderLeftColor: bandColor(top.band) }]}>
            <ConfidenceChip confidence={ctx?.confidence} />
            <Text style={styles.sectionLabel}>{t('engines.disease.highestRisk')}</Text>
            <View style={styles.topRow}>
              <Text style={styles.topName} numberOfLines={1}>{top.disease}</Text>
              <SeverityPill severity={bandSeverity(top.band)} label={`${top.band} · ${top.score}`} />
            </View>
          </Card>
        )}

        {risks && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>{t('engines.disease.allRanked')}</Text>
            {risks.map((r) => (
              <View key={r.disease} style={styles.riskRow}>
                <TouchableOpacity
                  style={styles.riskHeader}
                  onPress={() => setExpanded(expanded === r.disease ? null : r.disease)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.riskName}>{r.disease}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${r.score}%`, backgroundColor: bandColor(r.band) }]} />
                    </View>
                  </View>
                  <Text style={[styles.riskScore, { color: bandColor(r.band) }]}>{r.score}</Text>
                  <MaterialCommunityIcons
                    name={expanded === r.disease ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.roles.light.textTertiary}
                  />
                </TouchableOpacity>
                {expanded === r.disease && (
                  <View style={styles.detail}>
                    {r.triggers.length > 0 && (
                      <Text style={styles.triggers}>{t('engines.disease.triggers', { list: r.triggers.join(', ') })}</Text>
                    )}
                    {r.steps.map((s, i) => (
                      <View key={i} style={styles.step}>
                        <MaterialCommunityIcons name="arrow-right-thin" size={16} color={theme.roles.light.primary} />
                        <Text style={styles.stepText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const bandColor = (band: string) =>
  band === 'Critical' ? theme.roles.light.dangerBorder
    : band === 'Watch' ? theme.roles.light.warningBorder
      : theme.roles.light.successBorder;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  card: { marginBottom: theme.spacing[4], padding: theme.spacing[4] },
  sectionLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1],
    paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.roles.light.borderDefault,
  },
  chipActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
  chipText: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
  cta: { marginTop: theme.spacing[4] },
  topCard: { borderLeftWidth: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] },
  topName: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary, flex: 1 },
  riskRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.roles.light.borderDefault },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], paddingVertical: theme.spacing[3] },
  riskName: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600', marginBottom: theme.spacing[1] },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.roles.light.surfaceVariant, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  riskScore: { ...theme.typeScale.numericSmall },
  detail: { paddingBottom: theme.spacing[3], paddingLeft: theme.spacing[1], gap: theme.spacing[1] },
  triggers: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[1] },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[1] },
  stepText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textPrimary, flex: 1 },
});

export default DiseaseRiskScreen;
