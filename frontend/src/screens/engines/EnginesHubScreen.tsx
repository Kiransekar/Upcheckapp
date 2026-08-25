/**
 * EnginesHubScreen — one entry point to every decision engine for a pond.
 * Clean, icon-driven list (no emoji).
 */
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { theme } from '../../theme';
import { usePermissions } from '../../hooks/usePermissions';

const ENGINES: {
  route: string;
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
}[] = [
  { route: 'FeedAdvisor', key: 'feedAdvisor', icon: 'silo-outline', tint: '#FF9800' },
  { route: 'HarvestTiming', key: 'harvestTiming', icon: 'calendar-clock', tint: '#43A047' },
  { route: 'DiseaseRisk', key: 'diseaseRisk', icon: 'shield-alert-outline', tint: '#9C27B0' },
  { route: 'Aeration', key: 'aeration', icon: 'fan', tint: '#2196F3' },
  { route: 'Lunar', key: 'lunar', icon: 'moon-waning-crescent', tint: '#5C6BC0' },
  { route: 'CropPnl', key: 'cropPnl', icon: 'cash-multiple', tint: '#00897B' },
  { route: 'Measurements', key: 'measurements', icon: 'chart-line', tint: theme.roles.light.primary },
];

export const EnginesHubScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const params = route.params ?? {};
  // Workers don't see economic engines (Crop P&L). Backend also enforces this.
  const perms = usePermissions(params.farmId);
  const engines = ENGINES.filter((e) => e.route !== 'CropPnl' || perms.canViewFinancials);
  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('engines.hub.title')}</Text>
        {params.pondName ? <Text style={styles.subtitle}>{params.pondName}</Text> : null}

        <View style={styles.list}>
          {engines.map((e) => (
            <TouchableOpacity key={e.route} activeOpacity={0.8} onPress={() => navigation.navigate(e.route, params)}>
              <Card style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: e.tint + '1A' }]}>
                  <MaterialCommunityIcons name={e.icon} size={22} color={e.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t(`engines.hub.${e.key}`)}</Text>
                  <Text style={styles.rowDesc}>{t(`engines.hub.${e.key}Desc`)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textTertiary} />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[4] },
  list: { gap: theme.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[4] },
  iconWrap: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary },
  rowDesc: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary },
});

export default EnginesHubScreen;
