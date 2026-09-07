import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { Icon, type IconName } from './Icon';
import { theme } from '../../theme';
import { formatDate, formatTime } from '../../utils/formatDate';

const c = theme.roles.light;

/**
 * "Am I running the newest app, or is one sitting there waiting for me?"
 *
 * EAS Update applies on the SECOND launch: the download finishes silently while
 * the farmer is using the old bundle, and nothing on screen says so. They keep
 * being told "that's fixed already" while looking at the copy that still has
 * the bug. This block answers the three questions that gap creates — what am I
 * running, is one already downloaded, and is there a newer one on the server —
 * in plain words plus one button.
 */
export type OtaState =
    | 'disabled'
    | 'pending'
    | 'downloading'
    | 'checking'
    | 'available'
    | 'embedded'
    | 'running';

export interface OtaInputs {
    /** `Updates.isEnabled` — false in Expo Go and in dev builds. */
    isEnabled: boolean;
    isUpdatePending: boolean;
    isDownloading: boolean;
    isChecking: boolean;
    isUpdateAvailable: boolean;
    /** Running the bundle baked into the APK — no OTA has been applied yet. */
    isEmbeddedLaunch: boolean;
}

/**
 * Order matters. `pending` outranks `checking`/`downloading` because a finished
 * download that needs a restart is the one thing the user must ACT on, and a
 * background check kicking off must not hide it. `disabled` outranks everything
 * because in a dev build the other flags are meaningless, not false.
 */
export const otaState = (u: OtaInputs): OtaState => {
    if (!u.isEnabled) return 'disabled';
    if (u.isUpdatePending) return 'pending';
    if (u.isDownloading) return 'downloading';
    if (u.isChecking) return 'checking';
    if (u.isUpdateAvailable) return 'available';
    return u.isEmbeddedLaunch ? 'embedded' : 'running';
};

const HEADLINE: Record<OtaState, string> = {
    disabled: 'settings.otaDisabled',
    pending: 'settings.otaPending',
    downloading: 'settings.otaDownloading',
    checking: 'settings.otaChecking',
    available: 'settings.otaAvailable',
    embedded: 'settings.otaEmbedded',
    running: 'settings.otaRunning',
};

const ICON: Record<OtaState, IconName> = {
    disabled: 'warning',
    pending: 'check_circle',
    downloading: 'schedule',
    checking: 'schedule',
    available: 'newspaper',
    embedded: 'schedule',
    running: 'check_circle',
};

export const UpdateStatus: React.FC = () => {
    const { t } = useTranslation();
    const {
        currentlyRunning,
        isUpdatePending,
        isDownloading,
        isChecking,
        isUpdateAvailable,
        lastCheckForUpdateTimeSinceRestart,
        checkError,
    } = Updates.useUpdates();

    const state = otaState({
        isEnabled: Updates.isEnabled,
        isUpdatePending,
        isDownloading,
        isChecking,
        isUpdateAvailable,
        isEmbeddedLaunch: currentlyRunning.isEmbeddedLaunch,
    });

    // createdAt is always set when updates are enabled and we are not on the
    // embedded bundle; formatDate/formatTime render '—' rather than throwing if
    // that ever stops being true.
    const headline =
        state === 'running'
            ? t(HEADLINE.running, {
                  date: formatDate(currentlyRunning.createdAt, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                  }),
                  time: formatTime(currentlyRunning.createdAt),
              })
            : t(HEADLINE[state]);

    const settled = state === 'running' || state === 'embedded';
    const checkedAt = lastCheckForUpdateTimeSinceRestart;
    const secondary = checkError
        ? t('settings.otaCheckFailed')
        : checkedAt
          ? t(settled ? 'settings.otaLatestCheckedAt' : 'settings.otaCheckedAt', {
                time: formatTime(checkedAt),
            })
          : null;

    // Nothing to offer while a check or download is already in flight, and
    // nothing at all in a dev build where updates do not run.
    const action =
        state === 'disabled' || state === 'checking' || state === 'downloading'
            ? null
            : state === 'pending'
              ? { label: t('settings.otaRestart'), run: () => Updates.reloadAsync() }
              : state === 'available'
                ? { label: t('settings.otaDownload'), run: () => Updates.fetchUpdateAsync() }
                : { label: t('settings.otaCheck'), run: () => Updates.checkForUpdateAsync() };

    return (
        <View style={styles.block}>
            <View style={styles.row}>
                <Icon
                    name={ICON[state]}
                    size={18}
                    color={state === 'pending' ? c.successText : c.textSecondary}
                />
                <View style={styles.textCol}>
                    <Text style={[styles.headline, state === 'pending' && styles.headlinePending]}>
                        {headline}
                    </Text>
                    {secondary ? <Text style={styles.secondary}>{secondary}</Text> : null}
                    {currentlyRunning.updateId ? (
                        <Text style={styles.updateId}>
                            {t('settings.otaUpdateId', {
                                id: currentlyRunning.updateId.slice(0, 8),
                            })}
                        </Text>
                    ) : null}
                </View>
            </View>
            {action ? (
                <TouchableOpacity
                    onPress={() => {
                        // Offline or a server hiccup rejects here; the hook
                        // surfaces it as checkError, so swallow the rejection
                        // rather than letting it become an unhandled one.
                        void Promise.resolve(action.run()).catch(() => undefined);
                    }}
                    accessibilityRole="button"
                    style={styles.actionBtn}
                >
                    <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    block: {
        gap: theme.spacing[2],
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
    },
    textCol: {
        flex: 1,
        minWidth: 0,
    },
    headline: {
        ...theme.typeScale.bodySmall,
        color: c.textPrimary,
    },
    headlinePending: {
        color: c.successText,
        fontWeight: '600',
    },
    secondary: {
        ...theme.typeScale.labelSmall,
        color: c.textSecondary,
    },
    updateId: {
        ...theme.typeScale.labelSmall,
        color: c.textDisabled,
    },
    actionBtn: {
        alignSelf: 'flex-start',
        paddingVertical: theme.spacing[1],
    },
    actionLabel: {
        ...theme.typeScale.labelSmall,
        color: c.primary,
        fontWeight: '600',
    },
});
