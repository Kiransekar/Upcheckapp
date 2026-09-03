import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { diseaseApi, DiseaseLibrary } from '../../api/diseases';

type Severity = 'low' | 'medium' | 'high';

export const DiseaseDetailScreen = ({ route, navigation }: any) => {
    const { diseaseId } = route.params;
    const { t } = useTranslation();

    const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
        low: { label: t('content.diseases.severityLow'), color: theme.roles.light.successText, bg: theme.roles.light.successBg, border: theme.roles.light.successBorder },
        medium: { label: t('content.diseases.severityMedium'), color: theme.roles.light.warningText, bg: theme.roles.light.warningBg, border: theme.roles.light.warningBorder },
        high: { label: t('content.diseases.severityHigh'), color: theme.roles.light.dangerText, bg: theme.roles.light.dangerBg, border: theme.roles.light.dangerBorder },
    };

    const [disease, setDisease] = useState<DiseaseLibrary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDisease = async () => {
        try {
            setError(null);
            const { data } = await diseaseApi.getDiseaseById(diseaseId);
            setDisease(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load disease details');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // React Navigation keeps this screen mounted, so a mount-only effect never
    // re-ran on return — logging against this disease and coming back showed
    // whatever was loaded the first time.
    useFocusEffect(useCallback(() => { fetchDisease(); }, [diseaseId]));

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchDisease();
    };

    const handleLogDisease = () => {
        navigation.navigate('DiseaseLog', {
            pondId: '',
            pondName: '',
            cropId: '',
            prefillDiseaseId: disease?.id,
            prefillDiseaseName: disease?.name,
            prefillSeverity: disease?.severityLevel,
        });
    };

    const getSeverityConfig = (severity?: string): (typeof SEVERITY_CONFIG)[Severity] | null => {
        if (!severity) return null;
        const key = severity.toLowerCase() as Severity;
        return SEVERITY_CONFIG[key] || null;
    };

    const renderSection = (
        title: string,
        icon: string,
        items: string[] | undefined,
    ) => {
        if (!items || items.length === 0) return null;
        return (
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons
                        name={icon as any}
                        size={20}
                        color={theme.roles.light.primary}
                    />
                    <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                {items.map((item, index) => (
                    <View key={index} style={styles.bulletItem}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.bulletText}>{item}</Text>
                    </View>
                ))}
            </Card>
        );
    };

    if (isLoading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={theme.roles.light.textPrimary}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('content.diseases.detailTitle')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (error || !disease) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={theme.roles.light.textPrimary}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('content.diseases.detailTitle')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.errorState}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={theme.roles.light.dangerText}
                    />
                    <Text style={styles.errorTitle}>{t('content.diseases.detailErrorTitle')}</Text>
                    <Text style={styles.errorMessage}>{error || t('content.diseases.detailErrorFallback')}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={fetchDisease}>
                        <Text style={styles.retryText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    const sevConfig = getSeverityConfig(disease.severityLevel);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={theme.roles.light.textPrimary}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {disease.name}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
            >
                {/* Hero Card */}
                <Card style={styles.heroCard}>
                    <View style={styles.heroTop}>
                        <View style={styles.heroIcon}>
                            <MaterialCommunityIcons
                                name="bacteria"
                                size={36}
                                color={sevConfig?.color || theme.roles.light.primary}
                            />
                        </View>
                        <View style={styles.heroInfo}>
                            <Text style={styles.diseaseName}>{disease.name}</Text>
                            {disease.scientificName ? (
                                <Text style={styles.scientificName}>{disease.scientificName}</Text>
                            ) : null}
                            {disease.commonNames && disease.commonNames.length > 0 ? (
                                <Text style={styles.commonNames}>
                                    {t('content.diseases.alsoKnownAs', { names: disease.commonNames.join(', ') })}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    {sevConfig ? (
                        <View style={[styles.severityRow, { backgroundColor: sevConfig.bg, borderColor: sevConfig.border }]}>
                            <MaterialCommunityIcons
                                name="alert-circle"
                                size={18}
                                color={sevConfig.color}
                            />
                            <Text style={[styles.severityLabel, { color: sevConfig.color }]}>
                                {t('content.diseases.severityLabel', { level: sevConfig.label })}
                            </Text>
                        </View>
                    ) : null}
                </Card>

                {/* Description */}
                {disease.description ? (
                    <Card style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons
                                name="text-box-outline"
                                size={20}
                                color={theme.roles.light.primary}
                            />
                            <Text style={styles.sectionTitle}>{t('content.diseases.sectionDescription')}</Text>
                        </View>
                        <Text style={styles.descriptionText}>{disease.description}</Text>
                    </Card>
                ) : null}

                {/* Image Gallery Placeholder */}
                <Card style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons
                            name="image-multiple-outline"
                            size={20}
                            color={theme.roles.light.primary}
                        />
                        <Text style={styles.sectionTitle}>{t('content.diseases.sectionImages')}</Text>
                    </View>
                    <View style={styles.galleryPlaceholder}>
                        <MaterialCommunityIcons
                            name="image-outline"
                            size={40}
                            color={theme.roles.light.textDisabled}
                        />
                        <Text style={styles.galleryText}>
                            {disease.imageUrls && disease.imageUrls.length > 0
                                ? (disease.imageUrls.length !== 1
                                    ? t('content.diseases.imagesAvailableOther', { count: disease.imageUrls.length })
                                    : t('content.diseases.imagesAvailable', { count: disease.imageUrls.length }))
                                : t('content.diseases.noImages')}
                        </Text>
                    </View>
                </Card>

                {/* Symptoms */}
                {renderSection(t('content.diseases.sectionSymptoms'), 'stethoscope', disease.symptoms)}

                {/* Prevention Measures */}
                {renderSection(t('content.diseases.sectionPrevention'), 'shield-check', disease.preventionMeasures)}

                {/* Treatment Recommendations */}
                {renderSection(t('content.diseases.sectionTreatment'), 'medical-bag', disease.treatmentRecommendations)}

                {/* Log Disease Button */}
                <Button
                    title={t('content.diseases.logButton')}
                    onPress={handleLogDisease}
                    icon={
                        <MaterialCommunityIcons
                            name="plus-circle-outline"
                            size={20}
                            color={theme.roles.light.textInverse}
                        />
                    }
                    style={styles.logBtn}
                />
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
    headerTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        flex: 1,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: theme.spacing[16],
        paddingHorizontal: theme.spacing[4],
    },
    errorTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.dangerText,
        marginTop: theme.spacing[4],
    },
    errorMessage: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: theme.spacing[4],
        paddingHorizontal: theme.spacing[6],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.primary,
    },
    retryText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.primary,
    },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    heroCard: {
        marginBottom: theme.spacing[4],
        padding: theme.spacing[4],
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: theme.spacing[4],
    },
    heroIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.roles.light.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing[4],
    },
    heroInfo: {
        flex: 1,
    },
    diseaseName: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[1],
    },
    scientificName: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        fontStyle: 'italic',
        marginBottom: theme.spacing[1],
    },
    commonNames: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
    },
    severityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        gap: theme.spacing[2],
    },
    severityLabel: {
        ...theme.typeScale.labelLarge,
        fontWeight: '600',
    },
    sectionCard: {
        marginBottom: theme.spacing[4],
        padding: theme.spacing[4],
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: theme.spacing[2],
    },
    bulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.roles.light.primary,
        marginTop: 7,
        marginRight: theme.spacing[3],
    },
    bulletText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        flex: 1,
        lineHeight: 20,
    },
    descriptionText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        lineHeight: 22,
    },
    galleryPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing[6],
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.md,
    },
    galleryText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[2],
    },
    logBtn: {
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[8],
    },
});
