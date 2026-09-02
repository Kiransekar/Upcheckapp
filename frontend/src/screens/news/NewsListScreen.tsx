import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { newsApi, unwrapNews, NewsArticle } from '../../api/news';
import { readNewsCache, writeNewsCache, NEWS_CACHE_LIMIT } from '../../features/newsCache';
import { formatDate } from '../../utils/formatDate';
import { useFocusEffect } from '@react-navigation/native';
import i18n from '../../i18n';

const ALL_KEY = 'all';

/**
 * The fixed category set from the spec, not whatever happens to be in the
 * current page. Chips that appear and disappear as the feed changes are
 * disorienting, and a farmer looking for "Rules & regulations" should find it
 * even on a day nothing was filed.
 */
const CATEGORIES = ['market', 'regulation', 'disease', 'research', 'production', 'trade'] as const;

const CATEGORY_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    market: 'cash',
    regulation: 'gavel',
    disease: 'bacteria-outline',
    research: 'book-open-variant',
    production: 'sprout',
    trade: 'earth',
};

export const NewsListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    // Set only when we are rendering the cache instead of a live response.
    const [cachedAt, setCachedAt] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_KEY);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    const fadeIn = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    const fetchArticles = useCallback(async () => {
        setError(null);

        try {
            const response = await newsApi.getAll({
                take: NEWS_CACHE_LIMIT,
                locale: i18n.language,
            });
            const items = unwrapNews(response.data);
            setArticles(items);
            setCachedAt(null);
            // Cache on every success so the next no-signal open has something.
            writeNewsCache(items);
            fadeIn();
        } catch (err: any) {
            // Never an empty state when a cache exists — show yesterday's
            // headlines, dated honestly, rather than nothing at all.
            const cache = await readNewsCache();
            if (cache?.items.length) {
                setArticles(cache.items);
                setCachedAt(cache.cachedAt);
                fadeIn();
            } else {
                setError(err);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [fadeIn]);

    // React Navigation keeps this screen mounted — refetch on focus, not mount.
    useFocusEffect(
        useCallback(() => {
            fetchArticles();
        }, [fetchArticles])
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchArticles();
    }, [fetchArticles]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchArticles();
    }, [fetchArticles]);

    const filteredArticles = selectedCategory === ALL_KEY
        ? articles
        : articles.filter(a => a.category === selectedCategory);

    const categoryLabel = (cat: string) =>
        cat === ALL_KEY ? t('content.news.categoryAll') : t(`content.news.categories.${cat}`);

    const renderCategoryChip = (cat: string) => (
        <TouchableOpacity
            key={cat}
            style={[styles.categoryTab, selectedCategory === cat && styles.categoryTabActive]}
            onPress={() => setSelectedCategory(cat)}
        >
            <Text style={[styles.categoryLabel, selectedCategory === cat && styles.categoryLabelActive]}>
                {categoryLabel(cat)}
            </Text>
        </TouchableOpacity>
    );

    const renderArticleItem = useCallback(({ item }: { item: NewsArticle }) => (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                onPress={() => navigation.navigate('NewsDetail', { id: item.id, article: item })}
                activeOpacity={0.7}
            >
                <Card style={styles.articleCard}>
                    <View style={styles.articleHeader}>
                        <View style={styles.articleMeta}>
                            {item.category ? (
                                <View style={styles.categoryBadge}>
                                    {/* §2.4 — a category icon, never the publisher's image. */}
                                    <MaterialCommunityIcons
                                        name={CATEGORY_ICONS[item.category] ?? 'newspaper-variant-outline'}
                                        size={12}
                                        color={theme.roles.light.infoText}
                                    />
                                    <Text style={styles.categoryBadgeText}>
                                        {categoryLabel(item.category)}
                                    </Text>
                                </View>
                            ) : null}
                            <Text style={styles.dateText}>
                                {formatDate(item.publishedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.articleTitle} numberOfLines={3}>
                        {item.title}
                    </Text>
                    {item.summary ? (
                        <Text style={styles.articleExcerpt} numberOfLines={3}>
                            {item.summary}
                        </Text>
                    ) : null}
                    <View style={styles.articleFooter}>
                        {/* Every item is attributed wherever it is rendered. */}
                        <Text style={styles.sourceText} numberOfLines={1}>
                            {item.sourceName ? t('content.news.attribution', { source: item.sourceName }) : ''}
                        </Text>
                        <MaterialCommunityIcons
                            name={item.canonicalUrl ? 'open-in-new' : 'chevron-right'}
                            size={18}
                            color={theme.roles.light.primary}
                        />
                    </View>
                </Card>
            </TouchableOpacity>
        </Animated.View>
    ), [navigation, fadeAnim, scaleAnim, t]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                {navigation.canGoBack?.() ? (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                    </TouchableOpacity>
                ) : null}
                <Text style={styles.headerTitle}>{t('content.news.title')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryBar}
                contentContainerStyle={styles.categoryBarContent}
            >
                {[ALL_KEY, ...CATEGORIES].map(renderCategoryChip)}
            </ScrollView>

            {cachedAt ? (
                <AlertBanner
                    type="warning"
                    icon="cloud-off-outline"
                    title={t('content.news.offlineTitle')}
                    message={t('content.news.offlineMessage', {
                        date: formatDate(cachedAt, { day: 'numeric', month: 'short', year: 'numeric' }),
                    })}
                    style={styles.offlineBanner}
                />
            ) : null}

            {isLoading ? (
                <View style={styles.listContent}>
                    <SkeletonList count={4} />
                </View>
            ) : error && articles.length === 0 ? (
                <ErrorState
                    title={t('content.news.errorLoad')}
                    error={error}
                    onRetry={handleRetry}
                />
            ) : (
                <FlatList
                    data={filteredArticles}
                    keyExtractor={(item) => item.id}
                    renderItem={renderArticleItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            colors={[theme.roles.light.primary]}
                            tintColor={theme.roles.light.primary}
                        />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="newspaper-variant-outline"
                            title={t('content.news.emptyTitle')}
                            subtitle={t('content.news.emptySubtitle')}
                        />
                    }
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    backButton: {
        marginRight: theme.spacing[3],
    },
    headerTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        flex: 1,
    },
    headerSpacer: {
        width: 24,
    },
    categoryBar: {
        flexGrow: 0,
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    categoryBarContent: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        gap: theme.spacing[2],
    },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    categoryTabActive: {
        backgroundColor: theme.roles.light.primary + '20',
    },
    categoryLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    categoryLabelActive: {
        color: theme.roles.light.primary,
    },
    offlineBanner: {
        marginHorizontal: theme.spacing[4],
        marginTop: theme.spacing[3],
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    articleCard: {
        marginBottom: theme.spacing[3],
        padding: 0,
        overflow: 'hidden',
    },
    articleHeader: {
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[4],
    },
    articleMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[2],
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
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
    articleTitle: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        paddingHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[2],
    },
    articleExcerpt: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        paddingHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[3],
        lineHeight: 20,
    },
    articleFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing[2],
        padding: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    sourceText: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        flexShrink: 1,
    },
});
