/**
 * LanguageScreen — artboard 01, the very first screen of the first run.
 *
 * Language is chosen BEFORE anything else, including the welcome copy. The
 * previous flow buried a language chip inside the welcome screen, which meant a
 * brand-new farmer had to read three value propositions in whatever the device
 * locale happened to be before discovering they could switch. One decision,
 * nothing else on the screen.
 *
 * Tapping a language switches immediately rather than on Continue, so the
 * farmer sees the effect of the choice (the Continue button relabels) before
 * committing to it. `i18n.changeLanguage` is patched in src/i18n to persist,
 * and that persisted value is what `hasChosenLanguage()` gates this screen on —
 * so Continue re-asserts the selection to guarantee something is written even
 * when the default (English) was never tapped.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { BrandLockup } from '../../components/ui/ShrimpLogo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { OnboardingProgress } from '../../components/ui/OnboardingProgress';
import { theme } from '../../theme';
import i18n from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';

export const LanguageScreen = ({ navigation }: any) => {
    const { t, i18n: live } = useTranslation();
    const [selected, setSelected] = useState(live.language);

    const choose = (code: string) => {
        setSelected(code);
        // Switch now, not on Continue — the rest of this screen and the next
        // one then render in the chosen language immediately.
        i18n.changeLanguage(code);
    };

    const onContinue = async () => {
        // Re-assert so the preference is definitely persisted even if the
        // farmer accepted the pre-selected language without tapping a row.
        await i18n.changeLanguage(selected);
        // navigate, not replace: Welcome needs Language on the back stack so
        // its back arrow has somewhere to go (see WelcomeScreen).
        navigation.navigate('Welcome');
    };

    return (
        <ScreenWrapper scroll={false}>
            <View style={styles.brandRow}>
                <BrandLockup size={30} />
            </View>

            <OnboardingProgress step={1} />

            <View style={styles.titleRow}>
                <Icon name="translate" size={22} color={theme.roles.light.textSecondary} />
                <Text style={styles.title}>{t('onboarding.languageTitle')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                {LANGUAGES.map((lang) => {
                    const active = lang.code === selected;
                    return (
                        <TouchableOpacity
                            key={lang.code}
                            style={[styles.row, active && styles.rowActive]}
                            onPress={() => choose(lang.code)}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${lang.nativeLabel} (${lang.label})`}
                        >
                            <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                                {lang.nativeLabel}
                            </Text>
                            {/* Selection is a tick AND a colour AND a border, never
                                colour alone — the same status rule the rest of the
                                app follows. */}
                            {active && (
                                <Icon name="check_circle" size={22} color={theme.roles.light.primary} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Button title={t('common.continue')} onPress={onContinue} style={styles.cta} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    brandRow: { paddingTop: theme.spacing[4], paddingBottom: theme.spacing[8] },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[5],
    },
    title: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary, flex: 1 },
    list: { gap: theme.spacing[3], paddingBottom: theme.spacing[4] },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing[3],
        minHeight: 56,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    rowActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.infoBg,
    },
    rowLabel: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary, flex: 1 },
    rowLabelActive: { color: theme.roles.light.infoText, fontFamily: 'DMSans-SemiBold' },
    cta: { alignSelf: 'stretch', marginTop: theme.spacing[4] },
});

export default LanguageScreen;
