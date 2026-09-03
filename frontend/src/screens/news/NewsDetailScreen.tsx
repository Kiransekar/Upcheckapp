import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Share, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { newsApi, NewsArticle } from '../../api/news';
import { readNewsCache } from '../../features/newsCache';
import { buildTranslatePrompt } from '../../features/newsTranslatePrompt';
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

    // Fallback for when the OS share sheet itself fails (rare, but a farmer
    // stuck with a dead button is worse than an extra modal). The clipboard
    // copy below is the real safety net — this modal is the backstop for the
    // backstop, and its own Copy button re-does that same write.
    const [translateModalVisible, setTranslateModalVisible] = useState(false);
    const [translatePrompt, setTranslatePrompt] = useState('');

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

    /**
     * "Translate & explain" — no in-app translator, and detecting installed
     * AI apps needs a native `<queries>` manifest declaration this OTA-shipped
     * build can't add (Android 11+ `canOpenURL` scoping). So instead: build a
     * prompt written IN the farmer's language, copy it to the clipboard
     * (works even for apps that don't prefill from a share), and hand it to
     * the OS share sheet, which shows only whatever the farmer actually has
     * installed. If the share sheet itself throws, the fallback modal keeps
     * the action from being a dead end.
     */
    const handleTranslate = useCallback(async () => {
        if (!article) return;
        const prompt = buildTranslatePrompt(
            { title: article.title, summary: article.summary, sourceName: article.sourceName },
            i18n.language,
        );
        setTranslatePrompt(prompt);
        await Clipboard.setStringAsync(prompt);
        showToast({ message: t('content.news.translate.copied'), type: 'success' });
        try {
            await Share.share({ message: prompt });
        } catch {
            setTranslateModalVisible(true);
        }
    }, [article, showToast, t]);

    const handleCopyFromModal = useCallback(async () => {
        await Clipboard.setStringAsync(translatePrompt);
        showToast({ message: t('content.news.translate.copied'), type: 'success' });
    }, [translatePrompt, showToast, t]);

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

                        <TouchableOpacity
                            style={styles.translateButton}
                            onPress={handleTranslate}
                            accessibilityRole="button"
                            accessibilityLabel={t('content.news.translate.action')}
                        >
                            <MaterialCommunityIcons
                                name="translate"
                                size={18}
                                color={theme.roles.light.primary}
                            />
                            <Text style={styles.translateButtonText}>
                                {t('content.news.translate.action')}
                            </Text>
                        </TouchableOpacity>

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

            <Modal
                visible={translateModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setTranslateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {t('content.news.translate.modalTitle')}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setTranslateModalVisible(false)}
                                accessibilityRole="button"
                                accessibilityLabel={t('content.news.translate.close')}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                style={styles.modalCloseBtn}
                            >
                                <MaterialCommunityIcons
                                    name="close"
                                    size={20}
                                    color={theme.roles.light.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalBody}>
                            {t('content.news.translate.modalBody')}
                        </Text>
                        <ScrollView style={styles.modalPromptBox}>
                            <Text style={styles.modalPromptText}>{translatePrompt}</Text>
                        </ScrollView>
                        <Button
                            title={t('content.news.translate.copyButton')}
                            onPress={handleCopyFromModal}
                            style={styles.modalCopyButton}
                        />
                    </View>
                </View>
            </Modal>
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
    translateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing[2],
        marginHorizontal: theme.spacing[4],
        marginTop: theme.spacing[3],
        paddingHorizontal: theme.spacing[3],
        minHeight: 48,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceOverlay,
    },
    translateButtonText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: theme.spacing[5],
    },
    modalCard: {
        backgroundColor: theme.roles.light.surface,
        borderRadius: theme.radius.xl,
        padding: theme.spacing[5],
        gap: theme.spacing[3],
        maxHeight: '80%',
        ...theme.shadows.md,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalCloseBtn: {
        minWidth: 48,
        minHeight: 48,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    modalTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        flexShrink: 1,
    },
    modalBody: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    modalPromptBox: {
        maxHeight: 220,
        padding: theme.spacing[3],
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.md,
    },
    modalPromptText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textPrimary,
    },
    modalCopyButton: {
        alignSelf: 'stretch',
    },
});
