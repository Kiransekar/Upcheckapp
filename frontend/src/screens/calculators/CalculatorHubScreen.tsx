/**
 * Calculators — artboard p2.
 *
 * The change is the pond picker at the top. Every one of these five tools used
 * to open on an empty form asking for MBW, survival and stocking count — three
 * numbers the app already holds for every stocked pond. Choose a pond here and
 * they arrive filled in, leaving only what you are actually testing to type.
 *
 * The tools themselves become rows rather than a grid of coloured tiles: five
 * items with real descriptions read faster as a list, and the colours were
 * decoration, not meaning.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PondPicker } from '../../components/ui/PondPicker';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';

interface Calculator {
    id: string;
    icon: IconName;
    route: string;
}

const CALCULATORS: Calculator[] = [
    { id: 'performance', icon: 'insights', route: 'CultivationPerformance' },
    { id: 'dailyFeed', icon: 'grain', route: 'DailyFeedCalculator' },
    { id: 'productAmount', icon: 'science', route: 'ProductAmount' },
    { id: 'freeAmmonia', icon: 'warning', route: 'FreeAmmonia' },
    { id: 'growthHarvest', icon: 'set_meal', route: 'GrowthAndHarvest' },
];

export const CalculatorHubScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    // A pond may arrive from the pond screen; otherwise the picker starts empty.
    const [pondId, setPondId] = useState<string | null>(route?.params?.pondId ?? null);

    // The picker re-reports the pond when its context lands; only the id is
    // passed on, and each calculator fetches the snapshot it needs itself.
    const handlePond = useCallback((id: string) => setPondId(id), []);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('calculators.hub.eyebrow')}
                title={t('calculators.hub.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <Text style={styles.intro}>{t('calculators.hub.prefillNote')}</Text>

                <PondPicker pondId={pondId} onChange={handlePond} stockedOnly />

                <SectionHeader label={t('calculators.hub.title')} />
                {CALCULATORS.map((calc) => (
                    <TouchableOpacity
                        key={calc.id}
                        style={styles.row}
                        onPress={() =>
                            navigation.navigate(calc.route, pondId ? { pondId } : undefined)
                        }
                        accessibilityRole="button"
                    >
                        <Icon name={calc.icon} size={22} color={theme.roles.light.textSecondary} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.rowTitle}>{t(`calculators.hub.${calc.id}.title`)}</Text>
                            <Text style={styles.rowDesc}>{t(`calculators.hub.${calc.id}.description`)}</Text>
                        </View>
                        <Icon name="chevron_right" size={22} color={theme.roles.light.textDisabled} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: theme.roles.light.surface },
    intro: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        minHeight: 56,
    },
    rowTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    rowDesc: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
});

export default CalculatorHubScreen;
