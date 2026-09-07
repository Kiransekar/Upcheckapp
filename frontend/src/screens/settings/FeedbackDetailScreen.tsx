/**
 * One report, and the team's reply.
 *
 * This screen is the reason the whole feature exists. A farmer who reports
 * something and hears nothing has learned that reporting is pointless, and the
 * next thing that goes wrong becomes a one-star review instead. So the reply
 * gets the top of the screen and the farmer's own message sits under it — by
 * the time they come back here, they know what they wrote; what they came for
 * is the answer.
 *
 * The attachments are signed here rather than in the list read: signing every
 * report's photos on every pull-to-refresh would be a round trip to Storage
 * for pixels nobody has asked to see yet.
 */
import { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { formatDate, formatTime } from '../../utils/formatDate';
import { feedbackApi, type FeedbackReport } from '../../api/feedback';
import { statusTone } from './feedbackStatus';

const c = theme.roles.light;

export const FeedbackDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { id } = route.params ?? {};

    const [report, setReport] = useState<FeedbackReport | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const res = await feedbackApi.one(id).then(
            (r) => r.data,
            () => null,
        );
        // Same rule as the list: a failed read renders as a failure, never as
        // "there is nothing here".
        setLoadError(res === null);
        if (res) setReport(res);
        setLoaded(true);
        setRefreshing(false);
    }, [id]);

    // The status and the reply both change on our side while this screen stays
    // mounted — refetch on focus, not just on mount.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const body = () => {
        if (loadError && !report) {
            return (
                <View style={styles.loadError}>
                    <Icon name="warning" size={20} color={c.dangerText} />
                    <Text style={styles.loadErrorText}>{t('feedback.detailLoadFailed')}</Text>
                    <TouchableOpacity onPress={load} accessibilityRole="button">
                        <Text style={styles.retry}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        if (!report) {
            return (
                <View style={styles.skeletons}>
                    <Skeleton height={18} />
                    <Skeleton height={18} />
                    <Skeleton height={64} />
                </View>
            );
        }

        return (
            <>
                <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusTone(report.status) }]} />
                    <Text style={styles.statusLabel}>{t(`feedback.status_${report.status}`)}</Text>
                    <Text style={styles.statusDate}>{formatDate(report.createdAt)}</Text>
                </View>

                <SectionHeader label={t('feedback.teamResponse')} />
                {report.adminResponse ? (
                    <View style={styles.response}>
                        <Text style={styles.responseText}>{report.adminResponse}</Text>
                        {!!report.respondedAt && (
                            <Text style={styles.responseMeta}>
                                {t('feedback.respondedBy', {
                                    // The byline is free text a staffer typed; a
                                    // blank one falls back to the team's name
                                    // rather than printing "· 24 Aug".
                                    name: report.respondedBy || t('feedback.eyebrow'),
                                    date: `${formatDate(report.respondedAt)} ${formatTime(report.respondedAt)}`,
                                })}
                            </Text>
                        )}
                    </View>
                ) : (
                    <Text style={styles.empty}>{t('feedback.noResponseYet')}</Text>
                )}

                <SectionHeader label={t('feedback.yourMessage')} />
                {!!report.subject && <Text style={styles.subject}>{report.subject}</Text>}
                <Text style={styles.message}>{report.message}</Text>
                <Text style={styles.category}>{t(`feedback.cat_${report.category}`)}</Text>

                {report.attachmentPaths?.length > 0 && (
                    <>
                        <SectionHeader
                            label={t('feedback.photos')}
                            trailing={String(report.attachmentPaths.length)}
                        />
                        {report.attachmentUrls.length === 0 ? (
                            // The signed URLs are the one part of this read that
                            // is allowed to fail on its own — losing thumbnails
                            // must not cost the farmer the reply.
                            <Text style={styles.empty}>{t('feedback.photosUnavailable')}</Text>
                        ) : (
                            <View style={styles.photos}>
                                {/* Adding photos is temporarily off (see
                                    PHOTO_ATTACH_ENABLED in ReportIssueScreen);
                                    reports that already have them still show
                                    them here. */}
                                {report.attachmentUrls.map((url) => (
                                    <Image
                                        key={url}
                                        source={{ uri: url }}
                                        style={styles.photo}
                                        testID="feedback-photo"
                                    />
                                ))}
                            </View>
                        )}
                    </>
                )}
            </>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={report ? t(`feedback.cat_${report.category}`) : null}
                title={t('feedback.detailTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                    />
                }
            >
                {/* A stale copy plus a warning beats replacing what the farmer
                    is reading with an error. */}
                {loadError && loaded && !!report && (
                    <View style={styles.loadError}>
                        <Icon name="warning" size={20} color={c.dangerText} />
                        <Text style={styles.loadErrorText}>{t('feedback.detailLoadFailed')}</Text>
                        <TouchableOpacity onPress={load} accessibilityRole="button">
                            <Text style={styles.retry}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {body()}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    skeletons: { gap: theme.spacing[3], padding: theme.spacing[5] },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusLabel: { ...theme.typeScale.labelLarge, flex: 1, color: c.textPrimary },
    statusDate: { fontFamily: 'DMMono-Regular', fontSize: 13, color: c.textTertiary },

    response: {
        marginHorizontal: theme.spacing[5],
        marginTop: theme.spacing[1],
        padding: theme.spacing[3],
        borderRadius: theme.radius.xs,
        backgroundColor: c.successBg,
        borderWidth: 1,
        borderColor: c.successBorder,
    },
    responseText: { ...theme.typeScale.bodyMedium, color: c.textPrimary },
    responseMeta: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: c.textTertiary,
        marginTop: theme.spacing[2],
    },

    subject: {
        ...theme.typeScale.labelLarge,
        color: c.textPrimary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[1],
    },
    message: {
        ...theme.typeScale.bodyMedium,
        color: c.textSecondary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[1],
    },
    category: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2],
    },

    photos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[1],
    },
    photo: { width: 104, height: 104, borderRadius: theme.radius.xs },

    loadError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: c.dangerBg,
        borderBottomWidth: 1,
        borderBottomColor: c.dangerBorder,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    loadErrorText: { ...theme.typeScale.bodyMedium, flex: 1, color: c.dangerText },
    retry: { ...theme.typeScale.labelLarge, color: c.dangerText },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
    },
});

export default FeedbackDetailScreen;
