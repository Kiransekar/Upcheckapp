import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { SkeletonList } from '../../components/ui/Skeleton';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { alertsApi, AlertData } from '../../api/alerts';
import { useNotificationStore } from '../../store/notificationStore';

export const NotificationsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<AlertData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Cache ref
    const cacheRef = useRef<{ data: AlertData[]; timestamp: number } | null>(null);
    const CACHE_TTL = 60000; // 1 minute for notifications

    const fadeIn = useCallback(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    const fetchAlerts = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && cacheRef.current) {
            const { data, timestamp } = cacheRef.current;
            if (Date.now() - timestamp < CACHE_TTL) {
                setNotifications(data);
                setIsLoading(false);
                fadeIn();
                return;
            }
        }

        setError(null);
        setIsOffline(false);

        try {
            const { data } = await alertsApi.findMine();
            setNotifications(data || []);
            cacheRef.current = { data: data || [], timestamp: Date.now() };
            // Mirror into the global notification store so the unread badge /
            // other surfaces stay in sync.
            useNotificationStore.getState().setNotifications(
                (data || []).map((a) => ({
                    id: a.id,
                    title: a.title,
                    message: a.message,
                    level: a.severity,
                    isRead: a.isRead,
                    createdAt: a.createdAt,
                })) as any,
            );
            fadeIn();
        } catch (err: any) {
            const statusCode = err?.response?.status;
            if (statusCode === 0 || err?.code === 'NETWORK_ERROR' || !err?.response) {
                setIsOffline(true);
            }
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [fadeIn]);

    // React Navigation keeps this screen mounted, so a mount-only fetch never
    // re-ran on return — marking read/deleting elsewhere and coming back
    // showed the stale list. fetchAlerts' own CACHE_TTL still caps how often
    // this actually hits the network.
    useFocusEffect(useCallback(() => { fetchAlerts(); }, [fetchAlerts]));

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchAlerts(true);
    }, [fetchAlerts]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchAlerts(true);
    }, [fetchAlerts]);

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return 'alert-circle';
            case 'info': return 'information';
            case 'warning': return 'alert';
            default: return 'bell';
        }
    };

    const getIconColor = (severity: string) => {
        switch (severity) {
            case 'critical': return theme.roles.light.dangerText;
            case 'info': return theme.roles.light.infoBorder;
            case 'warning': return theme.roles.light.warningText;
            default: return theme.roles.light.primary;
        }
    };

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        try {
            await alertsApi.markAsRead(id);
        } catch(e) {
            console.error('Failed to mark alert read', e);
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try {
            await alertsApi.markAllAsRead();
        } catch (e) {
            console.error('Failed to mark all read', e);
        }
    };

    const deleteAlert = async (id: string) => {
        const previous = notifications;
        setNotifications(prev => prev.filter(n => n.id !== id));
        cacheRef.current = null;
        useNotificationStore.getState().removeNotification(id);
        try {
            await alertsApi.remove(id);
        } catch (e) {
            console.error('Failed to delete alert', e);
            setNotifications(previous);
        }
    };

    const renderSkeleton = () => (
        <View style={styles.listContent}>
            <SkeletonList count={4} />
        </View>
    );

    const renderItem = useCallback(({ item, index }: { item: AlertData; index: number }) => {
        const animStyle = {
            opacity: fadeAnim,
        };

        return (
            <Animated.View style={animStyle}>
                <TouchableOpacity onPress={() => markAsRead(item.id)} activeOpacity={0.7}>
                    <Card style={[styles.card, !item.isRead && styles.unreadCard]}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name={getIcon(item.severity)} size={24} color={getIconColor(item.severity)} />
                        </View>
                        <View style={styles.contentContainer}>
                            <Text style={[styles.titleText, !item.isRead && styles.unreadText]}>{item.title}</Text>
                            <Text style={styles.messageText}>{item.message}</Text>
                            <Text style={styles.dateText}>
                                {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                        {!item.isRead && <View style={styles.unreadDot} />}
                        <TouchableOpacity
                            onPress={() => deleteAlert(item.id)}
                            style={styles.deleteBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.roles.light.textDisabled} />
                        </TouchableOpacity>
                    </Card>
                </TouchableOpacity>
            </Animated.View>
        );
    }, [fadeAnim, notifications]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('settings.notificationsTitle')}</Text>
                <TouchableOpacity onPress={markAllAsRead} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="check-all" size={24} color={theme.roles.light.primary} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                renderSkeleton()
            ) : isOffline ? (
                <NetworkError onRetry={handleRetry} />
            ) : error && notifications.length === 0 ? (
                <ErrorState
                    title={t('settings.notificationsLoadError')}
                    error={error}
                    onRetry={handleRetry}
                />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
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
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="bell-outline" size={64} color={theme.roles.light.borderDefault} />
                            <Text style={styles.emptyTitle}>{t('settings.notificationsEmpty')}</Text>
                            <Text style={styles.emptyText}>{t('settings.notificationsEmptyDesc')}</Text>
                        </View>
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
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    backBtn: { padding: theme.spacing[4] },
    actionBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    listContent: {
        padding: theme.spacing[4],
    },
    card: {
        flexDirection: 'row',
        padding: theme.spacing[4],
        marginBottom: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
    },
    unreadCard: {
        backgroundColor: theme.roles.light.primary + '05',
    },
    iconContainer: {
        marginRight: theme.spacing[4],
        marginTop: 2,
    },
    contentContainer: {
        flex: 1,
    },
    titleText: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        marginBottom: 4,
    },
    unreadText: {
        fontWeight: 'bold',
    },
    messageText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    dateText: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textDisabled,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.roles.light.primary,
        marginTop: theme.spacing[3],
    },
    deleteBtn: {
        marginLeft: theme.spacing[2],
        alignSelf: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[4],
        marginBottom: theme.spacing[2],
    },
    emptyText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
});