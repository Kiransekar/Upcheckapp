/**
 * Report a problem — the farmer's direct line to the team.
 *
 * The gap this closes: the only way to tell us something was broken was to
 * leave a Play Store review, which is public, one-way, and reaches us days
 * late. Here a farmer picks what kind of thing it is, says what happened,
 * optionally attaches a photo, and sends — and then WATCHES it, because the
 * team's reply lands on this same screen. Being answered is the feature; the
 * form is just how the conversation starts.
 *
 * Two deliberate decisions worth knowing about:
 *
 * OFFLINE. This does NOT go through `saveRecord`/the sync queue, and that is
 * on purpose. The queue exists so a farmer standing at a pond with no signal
 * never loses a water reading — data that is worthless if it waits. A report
 * is a conversation, and a conversation silently spooled to disk is worse than
 * one not started: the farmer walks away believing the team has been told, and
 * the team hears nothing until the app is next opened with signal. The photos
 * settle it — the queue replays a JSON body, and a local `file://` URI in a
 * queued payload is a path to a cache file that may not survive until the
 * drain. So: offline is refused, out loud, with the text preserved on screen.
 *
 * FAILED IS NOT EMPTY. `loadError` is tracked separately from an empty list.
 * Telling a farmer "you have not reported anything" when we simply could not
 * ask is the same lie that had someone checking in over and over on the
 * Attendance screen.
 */
import { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Image,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { formatDate } from '../../utils/formatDate';
import {
    feedbackApi,
    type FeedbackCategory,
    type FeedbackReport,
    type PickedImage,
} from '../../api/feedback';
import { useSyncStore } from '../../store/syncStore';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { statusTone } from './feedbackStatus';

const c = theme.roles.light;

/** Four broad buckets. Every extra choice is a tap that loses a reporter. */
const CATEGORIES: FeedbackCategory[] = ['problem', 'confusing', 'suggestion', 'other'];

export const MAX_PHOTOS = 3;

/** What the list row shows when the farmer did not write a title. */
export const reportHeadline = (report: FeedbackReport): string =>
    report.subject?.trim() || report.message.trim().split('\n')[0];

export const ReportIssueScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const isConnected = useSyncStore((s) => s.isConnected);
    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);

    const [category, setCategory] = useState<FeedbackCategory>('problem');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [photos, setPhotos] = useState<PickedImage[]>([]);
    const [sending, setSending] = useState(false);
    const [messageError, setMessageError] = useState<string | undefined>();

    const [reports, setReports] = useState<FeedbackReport[]>([]);
    const [loadError, setLoadError] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const res = await feedbackApi.mine().then(
            (r) => r.data,
            () => null,
        );
        setLoadError(res === null);
        setReports(res ?? []);
        setLoaded(true);
        setRefreshing(false);
    }, []);

    // React Navigation keeps this screen mounted, and the status a farmer came
    // back to check changes on our side, not theirs.
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const addPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert(t('feedback.photoLimitReached', { count: MAX_PHOTOS }));
            return;
        }
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            // Not a dead end: the report is still sendable without a photo, and
            // saying so is the difference between a refusal and a lost report.
            Alert.alert(t('feedback.permissionTitle'), t('feedback.permissionBody'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            // 0.5 on a modern phone camera is roughly a 300–600 KB JPEG instead
            // of 6 MB. A farmer on rural data is paying for every one of those
            // megabytes, and a screenshot of a bug does not need them.
            quality: 0.5,
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
        });
        if (result.canceled) return;
        setPhotos((prev) =>
            [...prev, ...result.assets.map((a) => ({
                uri: a.uri,
                mimeType: a.mimeType,
                fileName: a.fileName,
            }))].slice(0, MAX_PHOTOS),
        );
    };

    const send = async () => {
        const text = message.trim();
        if (!text) {
            setMessageError(t('feedback.messageRequired'));
            return;
        }
        setMessageError(undefined);

        if (!isConnected) {
            Alert.alert(t('feedback.offlineTitle'), t('feedback.offlineBody'));
            return;
        }

        setSending(true);
        try {
            // Photos upload one at a time and a failure is survivable: the
            // farmer loses that image, not the paragraph they just typed.
            const attachmentPaths: string[] = [];
            let anyPhotoFailed = false;
            for (const photo of photos) {
                try {
                    const { data } = await feedbackApi.uploadAttachment(photo);
                    attachmentPaths.push(data.path);
                } catch {
                    anyPhotoFailed = true;
                }
            }

            await feedbackApi.create({
                category,
                subject: subject.trim() || undefined,
                message: text,
                farmId: selectedFarm?.id,
                attachmentPaths,
            });

            setSubject('');
            setMessage('');
            setPhotos([]);
            await load();
            Alert.alert(
                t('feedback.sentTitle'),
                anyPhotoFailed
                    ? `${t('feedback.sentBody')}\n\n${t('feedback.uploadFailed')}`
                    : t('feedback.sentBody'),
            );
        } catch {
            Alert.alert(t('common.error'), t('feedback.sendFailed'));
        } finally {
            setSending(false);
        }
    };

    const repliedCount = useMemo(
        () => reports.filter((r) => !!r.adminResponse).length,
        [reports],
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={t('feedback.eyebrow')}
                title={t('feedback.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(); }}
                    />
                }
            >
                <Text style={styles.intro}>{t('feedback.intro')}</Text>

                <SectionHeader label={t('feedback.categoryLabel')} />
                <View style={styles.chips}>
                    {CATEGORIES.map((key) => {
                        const active = category === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.chip, active && styles.chipActive]}
                                onPress={() => setCategory(key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                            >
                                <Text
                                    style={[styles.chipLabel, active && styles.chipLabelActive]}
                                    numberOfLines={1}
                                >
                                    {t(`feedback.cat_${key}`)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.form}>
                    <Input
                        label={t('feedback.messageLabel')}
                        required
                        multiline
                        numberOfLines={5}
                        value={message}
                        onChangeText={(v) => { setMessage(v); if (messageError) setMessageError(undefined); }}
                        placeholder={t('feedback.messagePlaceholder')}
                        error={messageError}
                        maxLength={4000}
                        testID="feedback-message"
                    />
                    {/* Optional and second: a farmer in a hurry never has to
                        touch it, and a thorough one gets to name the thing. */}
                    <Input
                        label={t('feedback.subjectLabel')}
                        value={subject}
                        onChangeText={setSubject}
                        placeholder={t('feedback.subjectPlaceholder')}
                        maxLength={160}
                    />
                </View>

                <SectionHeader
                    label={t('feedback.photosLabel')}
                    trailing={`${photos.length}/${MAX_PHOTOS}`}
                />
                <Text style={styles.hint}>{t('feedback.photosHint', { count: MAX_PHOTOS })}</Text>
                <View style={styles.photos}>
                    {photos.map((photo, i) => (
                        <TouchableOpacity
                            key={`${photo.uri}-${i}`}
                            style={styles.thumb}
                            onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                            accessibilityRole="button"
                            accessibilityLabel={t('feedback.removePhoto')}
                        >
                            <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
                            <View style={styles.thumbRemove}>
                                <Icon name="close" size={14} color={c.textInverse} />
                            </View>
                        </TouchableOpacity>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                        <TouchableOpacity
                            style={styles.addPhoto}
                            onPress={addPhoto}
                            accessibilityRole="button"
                            accessibilityLabel={t('feedback.addPhoto')}
                        >
                            <Icon name="add_a_photo" size={22} color={c.textSecondary} />
                            <Text style={styles.addPhotoLabel} numberOfLines={1}>
                                {t('feedback.addPhoto')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.sendRow}>
                    <Button
                        title={t('feedback.send')}
                        onPress={send}
                        loading={sending}
                        disabled={sending}
                    />
                </View>

                <SectionHeader
                    label={t('feedback.myReports')}
                    trailing={loadError ? undefined : String(reports.length)}
                    actionLabel={repliedCount > 0 ? t('feedback.replied') : undefined}
                />

                {/* Failed and empty are different sentences. */}
                {loadError ? (
                    <View style={styles.loadError} testID="feedback-load-error">
                        <Icon name="warning" size={20} color={c.dangerText} />
                        <Text style={styles.loadErrorText}>{t('feedback.loadFailed')}</Text>
                        <TouchableOpacity onPress={load} accessibilityRole="button">
                            <Text style={styles.retry}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : loaded && reports.length === 0 ? (
                    <Text style={styles.empty}>{t('feedback.noReports')}</Text>
                ) : (
                    reports.map((report) => (
                        <TouchableOpacity
                            key={report.id}
                            style={styles.row}
                            onPress={() => navigation.navigate('FeedbackDetail', { id: report.id })}
                            accessibilityRole="button"
                        >
                            <Icon
                                name={report.adminResponse ? 'mark_chat_unread' : 'feedback'}
                                size={22}
                                color={report.adminResponse ? c.successText : c.textSecondary}
                            />
                            <View style={styles.rowText}>
                                <Text style={styles.rowTitle} numberOfLines={1}>
                                    {reportHeadline(report)}
                                </Text>
                                <Text style={styles.rowMeta} numberOfLines={1}>
                                    {[
                                        formatDate(report.createdAt),
                                        t(`feedback.status_${report.status}`),
                                        report.attachmentPaths?.length
                                            ? t('feedback.attachmentCount', {
                                                  count: report.attachmentPaths.length,
                                              })
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: statusTone(report.status) },
                                ]}
                            />
                            <Icon name="chevron_right" size={22} color={c.textDisabled} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    intro: {
        ...theme.typeScale.bodyMedium,
        color: c.textSecondary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
    },
    hint: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },

    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
    },
    chip: {
        borderWidth: 1.5,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        justifyContent: 'center',
        minHeight: 44,
    },
    chipActive: { borderColor: c.borderStrong, backgroundColor: c.surfaceVariant },
    chipLabel: { ...theme.typeScale.labelMedium, color: c.textSecondary },
    chipLabelActive: { color: c.textPrimary },

    form: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3] },

    photos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
    },
    thumb: { width: 72, height: 72, borderRadius: theme.radius.xs, overflow: 'hidden' },
    thumbImage: { width: '100%', height: '100%' },
    thumbRemove: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.textPrimary,
    },
    addPhoto: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 72,
    },
    addPhotoLabel: { ...theme.typeScale.labelMedium, color: c.textSecondary },

    sendRow: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[5] },

    loadError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: c.dangerBg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.dangerBorder,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    loadErrorText: { ...theme.typeScale.bodyMedium, flex: 1, color: c.dangerText },
    retry: { ...theme.typeScale.labelLarge, color: c.dangerText },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    rowMeta: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
});

export default ReportIssueScreen;
