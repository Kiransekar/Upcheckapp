import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { theme } from '../../theme';
import { diseaseApi, DiseaseLibrary } from '../../api/diseases';
import { apiErrorMessage } from '../../api/errors';
import { isFeatureEnabled } from '../../config/features';

type Severity = 'low' | 'medium' | 'high';

export const DiseaseListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
        low: { label: t('content.diseases.severityLow'), color: theme.roles.light.successText, bg: theme.roles.light.successBg },
        medium: { label: t('content.diseases.severityMedium'), color: theme.roles.light.warningText, bg: theme.roles.light.warningBg },
        high: { label: t('content.diseases.severityHigh'), color: theme.roles.light.dangerText, bg: theme.roles.light.dangerBg },
    };
    const [diseases, setDiseases] = useState<DiseaseLibrary[]>([]);
    const [filteredDiseases, setFilteredDiseases] = useState<DiseaseLibrary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDiseases = useCallback(async () => {
        try {
            setError(null);
            const { data } = await diseaseApi.getAllDiseases();
            setDiseases(data);
            setFilteredDiseases(data);
        } catch (err: any) {
            setError(apiErrorMessage(err, 'Failed to load diseases'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // React Navigation keeps this screen mounted, so a mount-only effect never
    // re-ran on return — navigating away and back showed whatever was loaded
    // the first time, including a disease detail edited/logged elsewhere.
    useFocusEffect(useCallback(() => { fetchDiseases(); }, [fetchDiseases]));

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchDiseases();
    }, [fetchDiseases]);

    const handleSearch = useCallback(
        async (query: string) => {
            setSearchQuery(query);
            if (!query.trim()) {
                setFilteredDiseases(diseases);
                return;
            }

            if (diseases.length > 0) {
                const q = query.toLowerCase();
                const local = diseases.filter(
                    (d) =>
                        d.name.toLowerCase().includes(q) ||
                        d.scientificName?.toLowerCase().includes(q) ||
                        d.commonNames?.some((n) => n.toLowerCase().includes(q)),
                );
                setFilteredDiseases(local);
                return;
            }

            try {
                const { data } = await diseaseApi.searchDiseases(query.trim());
                setFilteredDiseases(data);
            } catch {
                setFilteredDiseases([]);
            }
        },
        [diseases],
    );

    const getSeverityConfig = (severity?: string): (typeof SEVERITY_CONFIG)[Severity] | null => {
        if (!severity) return null;
        const key = severity.toLowerCase() as Severity;
        return SEVERITY_CONFIG[key] || null;
    };

    const renderDiseaseItem = ({ item }: { item: DiseaseLibrary }) => {
        const sevConfig = getSeverityConfig(item.severityLevel);

        return (
            <TouchableOpacity
                style={styles.diseaseItem}
                onPress={() => navigation.navigate('DiseaseDetail', { diseaseId: item.id })}
                activeOpacity={0.7}
            >
                <View style={styles.diseaseIcon}>
                    <MaterialCommunityIcons
                        name="bacteria"
                        size={24}
                        color={sevConfig?.color || theme.roles.light.textSecondary}
                    />
                </View>
                <View style={styles.diseaseInfo}>
                    <Text style={styles.diseaseName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.scientificName ? (
                        <Text style={styles.scientificName} numberOfLines={1}>
                            {item.scientificName}
                        </Text>
                    ) : null}
                    {item.symptoms ? (
                        <Text style={styles.symptomCount}>
                            {item.symptoms.length !== 1
                                ? t('content.diseases.symptomOther', { count: item.symptoms.length })
                                : t('content.diseases.symptomOne', { count: item.symptoms.length })}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.diseaseRight}>
                    {sevConfig ? (
                        <View style={[styles.severityBadge, { backgroundColor: sevConfig.bg }]}>
                            <Text style={[styles.severityText, { color: sevConfig.color }]}>
                                {sevConfig.label}
                            </Text>
                        </View>
                    ) : null}
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.roles.light.textDisabled}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (isLoading) return null;
        return (
            <View style={styles.emptyState}>
                <MaterialCommunityIcons
                    name="bacteria"
                    size={64}
                    color={theme.roles.light.textDisabled}
                />
                <Text style={styles.emptyTitle}>
                    {searchQuery ? t('content.diseases.emptySearchTitle') : t('content.diseases.emptyTitle')}
                </Text>
                <Text style={styles.emptySubtitle}>
                    {searchQuery
                        ? t('content.diseases.emptySearchSubtitle')
                        : t('content.diseases.emptySubtitle')}
                </Text>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={theme.roles.light.textPrimary}
                />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('content.diseases.title')}</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    const renderSearchBar = () => (
        <View>
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={20}
                        color={theme.roles.light.textSecondary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('content.diseases.searchPlaceholder')}
                        placeholderTextColor={theme.roles.light.textTertiary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                    />
                </View>
            </View>
            {isFeatureEnabled('diseaseDiagnosis') && (
                <TouchableOpacity style={styles.diagnoseCta} onPress={() => navigation.navigate('Diagnose')} activeOpacity={0.85}>
                    <MaterialCommunityIcons name="stethoscope" size={20} color={theme.roles.light.primary} />
                    <Text style={styles.diagnoseText}>{t('diagnose.cta', 'Diagnose from symptoms')}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.roles.light.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );

    if (isLoading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {renderHeader()}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (error && diseases.length === 0) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {renderHeader()}
                {renderSearchBar()}
                <View style={styles.errorState}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={theme.roles.light.dangerText}
                    />
                    <Text style={styles.errorTitle}>{t('content.diseases.errorTitle')}</Text>
                    <Text style={styles.errorMessage}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={fetchDiseases}>
                        <Text style={styles.retryText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {renderHeader()}
            {renderSearchBar()}
            <FlatList
                data={filteredDiseases}
                keyExtractor={(item) => item.id}
                renderItem={renderDiseaseItem}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.roles.light.primary]}
                        tintColor={theme.roles.light.primary}
                    />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
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
    },
    searchContainer: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
    },
    diagnoseCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        marginHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[3],
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surface,
    },
    diagnoseText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        flex: 1,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing[3],
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: theme.spacing[2],
        fontFamily: theme.tokens.input.fontFamily,
        fontSize: theme.tokens.input.fontSize,
        color: theme.tokens.input.textColor,
    },
    listContent: {
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    diseaseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.roles.light.surface,
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        ...theme.shadows.sm,
    },
    diseaseIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.roles.light.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing[3],
    },
    diseaseInfo: {
        flex: 1,
    },
    diseaseName: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    scientificName: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        fontStyle: 'italic',
        marginTop: 2,
    },
    symptomCount: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textTertiary,
        marginTop: 2,
    },
    diseaseRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
    },
    severityBadge: {
        paddingHorizontal: theme.spacing[2],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.sm,
    },
    severityText: {
        ...theme.typeScale.labelSmall,
        fontWeight: '600',
    },
    separator: {
        height: theme.spacing[2],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: theme.spacing[16],
    },
    emptyTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[4],
    },
    emptySubtitle: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        marginTop: theme.spacing[2],
        textAlign: 'center',
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
});
