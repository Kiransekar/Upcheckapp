import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { FAB } from '../../components/ui/FAB';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { Skeleton, SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { farmsApi, Farm } from '../../api/farms';
import { useFocusEffect } from '@react-navigation/native';

export const FarmsListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    // Farm creation is open to every account — the creator becomes that farm's
    // owner in farm_members. The old owner-only gate read a global account flag
    // that no longer exists.
    const [farms, setFarms] = useState<Farm[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    // Simple in-memory cache (session-level, not stale)
    const cacheRef = useRef<{ data: Farm[]; timestamp: number } | null>(null);
    const CACHE_TTL = 30000; // 30 seconds - short to avoid staleness

    const fadeIn = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    const fetchFarms = useCallback(async (forceRefresh = false) => {
        // Check cache first (unless forcing refresh)
        if (!forceRefresh && cacheRef.current) {
            const { data, timestamp } = cacheRef.current;
            const now = Date.now();
            if (now - timestamp < CACHE_TTL) {
                setFarms(data);
                setIsLoading(false);
                fadeIn();
                return;
            }
        }

        setError(null);
        setIsOffline(false);

        try {
            const { data } = await farmsApi.getAll();
            setFarms(data);
            // Update cache
            cacheRef.current = { data, timestamp: Date.now() };
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

    useFocusEffect(
        useCallback(() => {
            fetchFarms();
        }, [fetchFarms])
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchFarms(true);
    }, [fetchFarms]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchFarms(true);
    }, [fetchFarms]);

    const renderSkeleton = () => (
        <View style={styles.listContent}>
            <SkeletonList count={3} />
        </View>
    );

    const renderFarmCard = useCallback(({ item, index }: { item: Farm; index: number }) => {
        const animStyle = {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
        };

        const areaHectares = Number(item.areaHectares) || 0;
        const pondCount = item.ponds?.length || 0;

        return (
            <Animated.View style={animStyle}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('FarmDetail', { farmId: item.id, farmName: item.name })}
                >
                    <Card style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.iconContainer}>
                                <MaterialCommunityIcons name="barn" size={24} color={theme.roles.light.primary} />
                            </View>
                            <View style={styles.cardTitleContainer}>
                                <Text style={styles.farmName}>{item.name}</Text>
                                {item.address ? (
                                    <View style={styles.locationRow}>
                                        <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.roles.light.textSecondary} />
                                        <Text style={styles.farmLocation}>{item.address}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.roles.light.textDisabled} />
                        </View>
                        <View style={styles.cardFooter}>
                            <View style={styles.statItem}>
                                <MaterialCommunityIcons name="water-outline" size={16} color={theme.roles.light.textSecondary} />
                                <Text style={styles.statsText}>
                                    <Text style={styles.statsValue}>{pondCount}</Text> {t('farms.ponds')}
                                </Text>
                            </View>
                            {areaHectares > 0 && (
                                <View style={styles.statItem}>
                                    <MaterialCommunityIcons name="ruler-square" size={16} color={theme.roles.light.textSecondary} />
                                    <Text style={styles.statsText}>
                                        <Text style={styles.statsValue}>{areaHectares.toFixed(1)}</Text> ha
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Card>
                </TouchableOpacity>
            </Animated.View>
        );
    }, [navigation, fadeAnim, scaleAnim]);

    if (isLoading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('farms.title')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CreateFarm')}>
                        <MaterialCommunityIcons name="plus" size={24} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                </View>
                {renderSkeleton()}
                <FAB icon="plus" onPress={() => navigation.navigate('CreateFarm')} />
            </ScreenWrapper>
        );
    }

    if (isOffline) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('farms.title')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CreateFarm')}>
                        <MaterialCommunityIcons name="plus" size={24} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                </View>
                <NetworkError onRetry={handleRetry} />
                <FAB icon="plus" onPress={() => navigation.navigate('CreateFarm')} />
            </ScreenWrapper>
        );
    }

    if (error && farms.length === 0) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('farms.title')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CreateFarm')}>
                        <MaterialCommunityIcons name="plus" size={24} color={theme.roles.light.primary} />
                    </TouchableOpacity>
                </View>
                <ErrorState
                    title={t('farms.errorTitle')}
                    error={error}
                    onRetry={handleRetry}
                />
                <FAB icon="plus" onPress={() => navigation.navigate('CreateFarm')} />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={1}>{t('farms.title')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CreateFarm')}>
                    <MaterialCommunityIcons name="plus" size={24} color={theme.roles.light.primary} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={farms}
                keyExtractor={(item) => item.id}
                renderItem={renderFarmCard}
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
                    // Nudge the other way in the empty state rather than hiding
                    // the action: someone here to join a farm needs the code path
                    // to be visible, and someone here to run one needs to create.
                    <EmptyState
                        icon="barn"
                        title={t('farms.emptyTitle')}
                        subtitle={t('farms.emptySubtitleEither')}
                        actionLabel={t('farms.addFarm')}
                        onAction={() => navigation.navigate('CreateFarm')}
                    />
                }
            />
            <FAB icon="plus" onPress={() => navigation.navigate('CreateFarm')} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[4],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    headerTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    card: {
        marginBottom: theme.spacing[4],
        padding: 0,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.roles.light.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing[4],
    },
    cardTitleContainer: {
        flex: 1,
    },
    farmName: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        marginBottom: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    farmLocation: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    cardFooter: {
        flexDirection: 'row',
        padding: theme.spacing[4],
        backgroundColor: theme.roles.light.surfaceVariant,
        gap: theme.spacing[6],
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statsText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    statsValue: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
    },
});