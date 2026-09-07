import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { ShrimpLogo } from '../../components/ui/ShrimpLogo';
import { UpdateStatus } from '../../components/ui/UpdateStatus';
import { theme } from '../../theme';
import { appBuild, appVersion } from '../../utils/appVersion';

const FEATURE_KEYS = [
    'settings.featureMultiFarm',
    'settings.featurePondMonitoring',
    'settings.featureWaterQuality',
    'settings.featureFeedManagement',
    'settings.featureGrowthSimulations',
    'settings.featureFinancialReports',
] as const;

export const AboutScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('settings.aboutUpcheck')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.logoContainer}>
                    <View style={styles.logo}>
                        <ShrimpLogo size={80} color={theme.roles.light.primary} eyeColor={theme.roles.light.surface} />
                    </View>
                    <Text style={styles.appName}>{t('common.appName')}</Text>
                    <Text style={styles.tagline}>{t('settings.appTagline')}</Text>
                </View>

                <Card style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{t('settings.versionLabel')}</Text>
                    <Text style={styles.version}>v{appVersion()}</Text>
                    <Text style={styles.buildInfo}>{t('settings.buildInfo', { build: appBuild() })}</Text>
                    <View style={styles.updateStatus}>
                        <UpdateStatus />
                    </View>
                </Card>

                <Card style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{t('settings.descriptionLabel')}</Text>
                    <Text style={styles.description}>{t('settings.descriptionText')}</Text>
                </Card>

                <Card style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{t('settings.featuresLabel')}</Text>
                    <View style={styles.featureList}>
                        {FEATURE_KEYS.map((key) => (
                            <View key={key} style={styles.featureItem}>
                                <MaterialCommunityIcons name="check-circle" size={20} color={theme.roles.light.successText} />
                                <Text style={styles.featureText}>{t(key)}</Text>
                            </View>
                        ))}
                    </View>
                </Card>

                <Card style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{t('settings.developedByLabel')}</Text>
                    <Text style={styles.developer}>{t('settings.developedByTeam')}</Text>
                    <Text style={styles.location}>{t('settings.developedByLocation')}</Text>
                </Card>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>{t('settings.footerCopyright')}</Text>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    backBtn: {
        padding: theme.spacing[4],
    },
    title: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
    },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    logoContainer: {
        alignItems: 'center',
        paddingVertical: theme.spacing[8],
    },
    logo: {
        marginBottom: theme.spacing[3],
    },
    appName: {
        ...theme.typeScale.h1,
        color: theme.roles.light.primary,
        marginBottom: theme.spacing[2],
    },
    tagline: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    infoCard: {
        marginBottom: theme.spacing[4],
        padding: theme.spacing[4],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    version: {
        ...theme.typeScale.h3,
        color: theme.roles.light.primary,
        marginBottom: theme.spacing[1],
    },
    buildInfo: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    updateStatus: {
        marginTop: theme.spacing[3],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    description: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        lineHeight: 22,
    },
    featureList: {
        gap: theme.spacing[2],
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
    },
    featureText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    developer: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '500',
    },
    location: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    footer: {
        alignItems: 'center',
        marginTop: theme.spacing[6],
    },
    footerText: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textDisabled,
    },
});