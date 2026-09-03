/**
 * WeeklyChemistryScreen — the periodic (≈weekly) test-kit / lab entry for the
 * chemistry parameters a farmer can't measure daily: ammonia, nitrite, nitrate,
 * alkalinity, hardness and water transparency (Secchi).
 *
 * Posts a water-quality record with just these fields; pond-context resolves
 * the latest non-null value per parameter, so these carry forward to every
 * engine until the next test — and raise the data-confidence score.
 */
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
// The same input the DAILY water-quality form uses: it reads the shared band
// table, tints its border and prints the target range. These six parameters
// are in that table already; only this screen was not asking it.
import { ParameterInput } from '../../components/forms/ParameterInput';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { apiErrorMessage } from '../../api/errors';

const num = (s: string) => (s.trim() ? Number(s) : undefined);

export const WeeklyChemistryScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const { pondId, pondName } = route.params ?? {};
  const [ammonia, setAmmonia] = useState('');
  const [nitrite, setNitrite] = useState('');
  const [nitrate, setNitrate] = useState('');
  const [alkalinity, setAlkalinity] = useState('');
  const [hardness, setHardness] = useState('');
  const [transparency, setTransparency] = useState('');
  const [saving, setSaving] = useState(false);

  const anyValue = [ammonia, nitrite, nitrate, alkalinity, hardness, transparency].some((v) => v.trim() !== '');

  const save = useCallback(async () => {
    if (!anyValue) {
      Alert.alert(t('engines.weeklyChem.nothing'), t('engines.weeklyChem.nothingSub'));
      return;
    }
    setSaving(true);
    try {
      await saveRecord({
        entity: 'water_quality',
        endpoint: '/water-quality',
        payload: {
          pondId,
          recordedAt: new Date().toISOString(),
          ammonia: num(ammonia),
          nitrite: num(nitrite),
          nitrate: num(nitrate),
          alkalinity: num(alkalinity),
          hardness: num(hardness),
          transparency: num(transparency),
        },
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t('engines.common.couldNotSave'), apiErrorMessage(e, t('engines.common.tryAgain')));
    } finally {
      setSaving(false);
    }
  }, [anyValue, pondId, ammonia, nitrite, nitrate, alkalinity, hardness, transparency, navigation]);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="flask-outline" size={26} color={theme.roles.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('engines.weeklyChem.title')}</Text>
            {pondName ? <Text style={styles.subtitle}>{pondName}</Text> : null}
          </View>
        </View>

        <View style={styles.note}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.roles.light.infoText} />
          <Text style={styles.noteText}>{t('engines.weeklyChem.note')}</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.grid}>
            <ParameterInput label={t('engines.weeklyChem.ammonia')} value={ammonia} onChangeText={setAmmonia} unit="mg/L" parameterKey="ammonia" />
            <ParameterInput label={t('engines.weeklyChem.nitrite')} value={nitrite} onChangeText={setNitrite} unit="mg/L" parameterKey="nitrite" />
            <ParameterInput label={t('engines.weeklyChem.nitrate')} value={nitrate} onChangeText={setNitrate} unit="mg/L" parameterKey="nitrate" />
            <ParameterInput label={t('engines.weeklyChem.alkalinity')} value={alkalinity} onChangeText={setAlkalinity} unit="mg/L" parameterKey="alkalinity" />
            <ParameterInput label={t('engines.weeklyChem.hardness')} value={hardness} onChangeText={setHardness} unit="mg/L" parameterKey="hardness" />
            <ParameterInput label={t('engines.weeklyChem.transparency')} value={transparency} onChangeText={setTransparency} unit="cm" parameterKey="transparency" />
          </View>
          <Button title={t('engines.weeklyChem.save')} onPress={save} loading={saving} disabled={!anyValue} style={styles.cta} />
        </Card>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing[10] },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
  subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2],
    backgroundColor: theme.roles.light.infoBg, borderRadius: theme.radius.sm,
    padding: theme.spacing[3], marginBottom: theme.spacing[4],
  },
  noteText: { ...theme.typeScale.bodySmall, color: theme.roles.light.infoText, flex: 1 },
  card: { padding: theme.spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  cta: { marginTop: theme.spacing[5] },
});

export default WeeklyChemistryScreen;
