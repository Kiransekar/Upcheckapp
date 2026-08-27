import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { theme } from '../../theme';

interface HelpItem {
    icon: string;
    titleKey: string;
    descKey: string;
}

const HELP_TOPICS: HelpItem[] = [
    { icon: 'water',                  titleKey: 'settings.helpTopicWaterTitle',        descKey: 'settings.helpTopicWaterDesc' },
    { icon: 'corn',                   titleKey: 'settings.helpTopicFeedTitle',         descKey: 'settings.helpTopicFeedDesc' },
    { icon: 'scale',                  titleKey: 'settings.helpTopicSamplingTitle',     descKey: 'settings.helpTopicSamplingDesc' },
    { icon: 'calculator-variant',     titleKey: 'settings.helpTopicCalculatorsTitle',  descKey: 'settings.helpTopicCalculatorsDesc' },
    { icon: 'chart-timeline-variant', titleKey: 'settings.helpTopicSimulationsTitle',  descKey: 'settings.helpTopicSimulationsDesc' },
    { icon: 'barn',                   titleKey: 'settings.helpTopicFarmTitle',         descKey: 'settings.helpTopicFarmDesc' },
];

export const HelpScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('settings.helpAndSupport')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.introCard}>
                    <MaterialCommunityIcons name="help-circle" size={48} color={theme.roles.light.primary} />
                    <Text style={styles.introTitle}>{t('settings.helpIntroTitle')}</Text>
                    <Text style={styles.introText}>{t('settings.helpIntroText')}</Text>
                </Card>

                {/*
                  * Above the guides, not buried under "Contact us" with the
                  * mailto link. Someone who opened Help is already stuck, and
                  * the fastest thing we can offer them is a person — the
                  * guides are for the ones who are merely curious.
                  */}
                <TouchableOpacity
                    style={styles.reportCta}
                    onPress={() => navigation.navigate('ReportIssue')}
                    accessibilityRole="button"
                >
                    <MaterialCommunityIcons
                        name="message-alert"
                        size={24}
                        color={theme.roles.light.primary}
                    />
                    <View style={styles.reportCtaText}>
                        <Text style={styles.reportCtaTitle}>{t('feedback.tileLabel')}</Text>
                        <Text style={styles.reportCtaSub}>{t('feedback.tileSub')}</Text>
                    </View>
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={24}
                        color={theme.roles.light.textTertiary}
                    />
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>{t('settings.quickGuides')}</Text>
                {HELP_TOPICS.map((topic, index) => (
                    <Card key={index} style={styles.helpCard}>
                        <View style={styles.helpRow}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.roles.light.primary + '15' }]}>
                                <MaterialCommunityIcons name={topic.icon as any} size={24} color={theme.roles.light.primary} />
                            </View>
                            <View style={styles.helpContent}>
                                <Text style={styles.helpTitle}>{t(topic.titleKey)}</Text>
                                <Text style={styles.helpDescription}>{t(topic.descKey)}</Text>
                            </View>
                        </View>
                    </Card>
                ))}

                <Text style={styles.sectionTitle}>{t('settings.contactUs')}</Text>
                <Card style={styles.contactCard}>
                    <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL('mailto:support@upcheck.in')}>
                        <MaterialCommunityIcons name="email" size={24} color={theme.roles.light.primary} />
                        <Text style={styles.contactText}>support@upcheck.in</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL('https://upcheck.in')}>
                        <MaterialCommunityIcons name="web" size={24} color={theme.roles.light.infoBorder} />
                        <Text style={styles.contactText}>upcheck.in</Text>
                    </TouchableOpacity>
                </Card>
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
    introCard: {
        alignItems: 'center',
        padding: theme.spacing[6],
        marginBottom: theme.spacing[6],
    },
    introTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[2],
    },
    introText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    reportCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[4],
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
        borderRadius: theme.radius.sm,
        borderWidth: 1.5,
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surface,
        minHeight: 44,
    },
    reportCtaText: { flex: 1, minWidth: 0 },
    reportCtaTitle: {
        ...theme.typeScale.bodyLarge,
        fontWeight: '600',
        color: theme.roles.light.textPrimary,
    },
    reportCtaSub: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    helpCard: {
        marginBottom: theme.spacing[3],
        padding: theme.spacing[4],
    },
    helpRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing[4],
    },
    helpContent: {
        flex: 1,
    },
    helpTitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        marginBottom: theme.spacing[1],
    },
    helpDescription: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        lineHeight: 18,
    },
    contactCard: {
        padding: theme.spacing[4],
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    contactText: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        marginLeft: theme.spacing[4],
    },
});