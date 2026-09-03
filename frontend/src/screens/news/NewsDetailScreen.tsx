import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { newsApi, NewsArticle } from '../../api/news';
import { readNewsCache } from '../../features/newsCache';
import { formatDate } from '../../utils/formatDate';
import { useUIStore } from '../../store/uiStore';
import { useSyncStore } from '../../store/syncStore';
import { useFocusEffect } from '@react-navigation/native';
import i18n from '../../i18n';

export const NewsDetailScreen = ({ route, navigation }: any) => {
    const { id, article: seeded } = (route.params ?? {}) as {
        id: string;
        article?: NewsArticle;
    };
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const isConnected = useSyncStore((s) => s.isConnected);

    // Seeded from the list so an offline tap opens instantly on cached data.
    const [article, setArticle] = useState<NewsArticle | null>(seeded ?? null);
    const [isLoading, setIsLoading] = useState(!seeded);
    const [error, setError] = useState<any>(null);

    const fetchArticle = useCallback(async () => {
        setError(null);
        try {
            const response = await newsApi.getById(id, i18n.language);
            setArticle(response.data);
        } catch (err: any) {
            const cached = (await readNewsCache())?.items.find((a) => a.id === id);
            if (cached) setArticle(cached);
            else if (!seeded) setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [id, seeded]);

    useFocusEffect(
        useCallback(() => {
            fetchArticle();
        }, [fetchArticle])
    );

    /**
     * §2.5 — the article itself is the publisher's, so it opens on the
     * publisher's page. We never render their body inside Upcheck chrome that
     * would imply we wrote it.
     */
    const openSource = useCallback(() => {
        const url = article?.canonicalUrl;
        if (!url) return;
        if (isConnected === false) {
            // A dead browser tab is a worse answer than a plain sentence.
            showToast({ message: t('content.news.offlineLink'), type: 'info' });
            return;
        }
        Linking.openURL(url).catch(() =>
            showToast({ message: t('content.news.offlineLink'), type: 'error' }),
        );
    }, [article, isConnected, showToast, t]);

    const sourceHost = (() => {
        try {
            return article?.canonicalUrl
                ? new URL(article.canonicalUrl).hostname.replace(/^www\./, '')
                : null;
        } catch {
            return null;
        }
    })();

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                title={article?.title ?? t('content.news.fallbackTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            {isLoading && !article ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            ) : error && !article ? (
                <ErrorState
                    title={t('content.news.errorLoadArticle')}
                    error={error}
                    onRetry={fetchArticle}
                />
            ) : article ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Card style={styles.articleCard}>
                        <View style={styles.metaRow}>
                            {article.category ? (
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryBadgeText}>
                                        {t(`content.news.categories.${article.category}`, {
                                            defaultValue: article.category,
                                        })}
                                    </Text>
                                </View>
                            ) : null}
                            <Text style={styles.dateText}>
                                {formatDate(article.publishedAt, {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </Text>
                        </View>

                        <Text style={styles.title}>{article.title}</Text>

                        {article.sourceName ? (
                            <Text style={styles.attribution}>
                                {t('content.news.attribution', { source: article.sourceName })}
                            </Text>
                        ) : null}

                        {article.summary ? (
                            <View style={styles.summaryContainer}>
                                <Text style={styles.summaryText}>{article.summary}</Text>
                            </View>
                        ) : null}

                        {/* Upcheck's own editorial only — an aggregated item has
                            no body here, by design. See news-article.entity.ts. */}
                        {article.content ? (
                            <>
                                <View style={styles.divider} />
                                <Text style={styles.contentText}>{article.content}</Text>
                            </>
                        ) : null}

                        {article.canonicalUrl ? (
                            <TouchableOpacity
                                style={styles.sourceButton}
                                onPress={openSource}
                                accessibilityRole="link"
                                accessibilityLabel={t('content.news.readFullArticle')}
                            >
                                <MaterialCommunityIcons
                                    name="open-in-new"
                                    size={18}
                                    color={theme.roles.light.primary}
                                />
                                <Text style={styles.sourceButtonText}>
                                    {article.sourceName
                                        ? t('content.news.readAtSource', { source: article.sourceName })
                                        : t('content.news.readFullArticle')}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        {/* The domain is shown plainly so it is never in doubt
                            whose page the reader is about to open. */}
                        {sourceHost ? <Text style={styles.hostText}>{sourceHost}</Text> : null}
                    </Card>
                </ScrollView>
            ) : null}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    articleCard: {
        padding: 0,
        overflow: 'hidden',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[2],
    },
    categoryBadge: {
        backgroundColor: theme.roles.light.infoBg,
        paddingHorizontal: theme.spacing[2],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.sm,
    },
    categoryBadgeText: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.infoText,
    },
    dateText: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
    },
    title: {
        ...theme.typeScale.h1,
        color: theme.roles.light.textPrimary,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[3],
    },
    attribution: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[2],
    },
    summaryContainer: {
        marginHorizontal: theme.spacing[4],
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[3],
        padding: theme.spacing[3],
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.md,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.primary,
    },
    summaryText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: theme.roles.light.borderDefault,
        marginHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    contentText: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        paddingHorizontal: theme.spacing[4],
        paddingBottom: theme.spacing[4],
        lineHeight: 28,
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        marginTop: theme.spacing[4],
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[4],
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    sourceButtonText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
    },
    hostText: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
        paddingBottom: theme.spacing[4],
        backgroundColor: theme.roles.light.surfaceVariant,
    },
});
