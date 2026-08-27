/**
 * CropPnlScreen — Crop P&L + Break-Even (farmer_features_spec §5). Headline
 * cost-of-production and profit, with a cost-breakdown bar list.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { theme } from '../../theme';
import { pnlApi, type CropPnl } from '../../api/pnl';
import { useFocusEffect } from '@react-navigation/native';

const inr = (n: number | null | undefined) => '₹' + Math.round(n ?? 0).toLocaleString('en-IN');

export const CropPnlScreen = ({ route }: any) => {
  const { t } = useTranslation();
  const { cropId, pondName } = route.params ?? {};
  const [pnl, setPnl] = useState<CropPnl | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!cropId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await pnlApi.cropPnl(cropId);
      setPnl(data);
    } catch {
      setPnl(null);
    } finally {
      setLoading(false);
    }
  }, [cropId]);

  // Refetch on FOCUS, not on mount. React Navigation keeps a screen mounted
  // once it has been opened, so a mount-only effect never ran again: log
  // something in a pond, come back here, and the page still showed the
  // figures from before the log until the app was force-refreshed.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const profitable = (pnl?.profit ?? 0) >= 0;
  const breakdown = pnl ? Object.entries(pnl.costBreakdown) : [];
  const maxCost = breakdown.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="cash-multiple" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.pnl.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.roles.light.primary} style={{ marginTop: theme.spacing[8] }} />
        ) : !cropId || !pnl ? (
          <EmptyState icon="cash-remove" title={t('engines.pnl.noPnl')} subtitle={t('engines.pnl.noPnlSub')} />
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.headlineRow}>
                <View style={styles.headline}>
                  <Text style={styles.headlineLabel}>{t('engines.pnl.cop')}</Text>
                  <Text style={styles.headlineValue}>{inr(pnl.coPerKg)}<Text style={styles.perKg}>/kg</Text></Text>
                </View>
                <View style={styles.headline}>
                  <Text style={styles.headlineLabel}>{t('engines.pnl.breakEven')}</Text>
                  <Text style={styles.headlineValue}>{pnl.breakEvenCount ? Math.round(pnl.breakEvenCount) : '—'}</Text>
                </View>
              </View>
            </Card>

            <Card style={[styles.card, styles.profitCard, { borderLeftColor: profitable ? theme.roles.light.successBorder : theme.roles.light.dangerBorder }]}>
              <Text style={styles.headlineLabel}>{profitable ? t('engines.pnl.profit') : t('engines.pnl.loss')}</Text>
              <Text style={[styles.profitValue, { color: profitable ? theme.roles.light.successText : theme.roles.light.dangerText }]}>
                {inr(pnl.profit)}
              </Text>
              <Text style={styles.profitMeta}>
                {t('engines.pnl.revenueCostMargin', { revenue: inr(pnl.revenue), cost: inr(pnl.totalCost), margin: pnl.marginPct ?? 0 })}
              </Text>
            </Card>

            {breakdown.length > 0 && (
              <Card style={styles.card}>
                <Text style={styles.sectionLabel}>{t('engines.pnl.breakdown')}</Text>
                {breakdown.sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <View key={cat} style={styles.costRow}>
                    <View style={styles.costHeader}>
                      <Text style={styles.costCat} numberOfLines={1}>{cat}</Text>
                      <Text style={styles.costAmt} numberOfLines={1}>{inr(amt)}</Text>
                    </View>
                    <View style={styles.costTrack}>
                      <View style={[styles.costFill, { width: `${(amt / maxCost) * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
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
  headlineRow: { flexDirection: 'row', gap: theme.spacing[4] },
  headline: { flex: 1 },
  headlineLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[1] },
  headlineValue: { ...theme.typeScale.numericLarge, color: theme.roles.light.textPrimary },
  perKg: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  profitCard: { borderLeftWidth: 4 },
  profitValue: { ...theme.typeScale.numericHero, marginVertical: theme.spacing[1] },
  profitMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
  costRow: { marginBottom: theme.spacing[3] },
  costHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing[1], gap: theme.spacing[2] },
  costCat: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
  costAmt: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary, flexShrink: 0 },
  costTrack: { height: 8, borderRadius: 4, backgroundColor: theme.roles.light.surfaceVariant, overflow: 'hidden' },
  costFill: { height: 8, borderRadius: 4, backgroundColor: theme.roles.light.primary },
});

export default CropPnlScreen;
