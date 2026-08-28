import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';
import { drainRecordQueue } from '../../sync/recordSync';
import { queryClient } from '../../query/client';
import { theme } from '../../theme';

export const OfflineIndicator = () => {
    const { t } = useTranslation();
    const isConnected = useSyncStore((s) => s.isConnected);
    const setConnected = useSyncStore((s) => s.setConnected);
    const pending = useSyncStore((s) => s.queue.length + s.failedOperations.length);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    // Subscribe to NetInfo on mount; keep syncStore in sync and flush pending
    // writes whenever we (re)gain connectivity.
    useEffect(() => {
        const onConnectivity = (connected: boolean) => {
            setConnected(connected);
            if (connected) {
                // Restore a real session first (AUTH-1 reconnect), then flush
                // writes, then refresh whatever the farmer is looking at.
                //
                // The drain invalidates the keys its own ops touched; this
                // catches the other half — signal came back with an empty queue
                // and the screen on display is still showing the cached copy
                // from before the tunnel. Only ACTIVE queries refetch, so this
                // is one screen's worth of requests, not the whole cache.
                useAuthStore
                    .getState()
                    .recoverSession()
                    .catch(() => undefined)
                    .finally(() => {
                        drainRecordQueue().catch(() => undefined);
                        void queryClient.invalidateQueries({ type: 'active' });
                    });
            }
        };

        // Fetch the current state immediately so we don't wait for a change event.
        NetInfo.fetch().then((state) => onConnectivity(state.isConnected ?? true));

        const unsubscribe = NetInfo.addEventListener((state) =>
            onConnectivity(state.isConnected ?? true),
        );

        return unsubscribe;
    }, [setConnected]);

    // Animate the banner in (slide down) when offline, out (slide up) when back online.
    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isConnected ? 0 : 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [isConnected, slideAnim]);

    // Don't render at all when connected (opacity 0 + translated away).
    // Using pointerEvents="none" when connected prevents accidental touch captures.
    return (
        <Animated.View
            pointerEvents={isConnected ? 'none' : 'box-none'}
            style={[
                styles.container,
                {
                    top: insets.top,
                    opacity: slideAnim,
                    transform: [
                        {
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-20, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            <MaterialCommunityIcons
                name="wifi-off"
                size={16}
                color={theme.roles.light.surface}
            />
            <Text style={styles.text}>
                {t('common.offlineBanner', 'Offline — changes will sync')}
                {pending > 0 ? ` (${pending})` : ''}
            </Text>
        </Animated.View>
    );
};

/**
 * Persistent strip shown whenever queued records have permanently failed to sync
 * (SYNC-1/SYNC-3: parked ops must be visible, never silently dropped). Tapping it
 * offers a retry, which re-queues the parked ops with a fresh budget and drains.
 */
// Approximate rendered height of the offline banner (padding + one text line);
// used to stack the attention banner beneath it when both are visible.
const OFFLINE_BANNER_HEIGHT = 30;

export const SyncAttentionBanner = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const failedCount = useSyncStore((s) => s.failedOperations.length);
    const isConnected = useSyncStore((s) => s.isConnected);
    const retryFailed = useSyncStore((s) => s.retryFailed);

    if (failedCount === 0) return null;

    const onPress = () => {
        Alert.alert(
            t('common.syncFailedTitle', 'Some records need attention'),
            t(
                'common.syncFailedBody',
                '{{count}} record(s) could not be synced. Retry now?',
                { count: failedCount },
            ),
            [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('common.retry', 'Retry'),
                    onPress: () => {
                        retryFailed();
                        drainRecordQueue().catch(() => undefined);
                    },
                },
            ],
        );
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('common.syncFailedA11y', '{{count}} records failed to sync, tap to retry', {
                count: failedCount,
            })}
            style={[styles.attention, { top: insets.top + (isConnected ? 0 : OFFLINE_BANNER_HEIGHT) }]}
        >
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.roles.light.surface} />
            <Text style={styles.text}>
                {t('common.syncFailedBanner', 'Records need attention')} ({failedCount})
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: theme.roles.light.dangerText,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing[1.5],
        zIndex: 999,
        elevation: 10,
    },
    text: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.surface,
        marginLeft: theme.spacing[2],
    },
    attention: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: theme.roles.light.warningText,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing[1.5],
        zIndex: 999,
        elevation: 10,
    },
});
