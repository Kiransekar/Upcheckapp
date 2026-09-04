import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { FAB } from '../../components/ui/FAB';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import {
    inventoryApi,
    InventoryItem,
    INVENTORY_CATEGORIES,
    CATEGORY_ICON,
    isLowStock,
    itemIcon,
} from '../../api/inventory';
import { farmsApi } from '../../api/farms';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useFocusEffect } from '@react-navigation/native';

const CATEGORY_LABEL_KEY: Record<string, string> = {
    feed: 'inventory.catFeed',
    chemical: 'inventory.catChemicals',
    equipment: 'inventory.catEquipment',
    medicine: 'inventory.catMedicine',
    other: 'inventory.catOther',
};

export const InventoryListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    // ONE list, from the same five the backend @IsIn's — `medicine` used to be
    // missing here (D12), so medicine rows fell out of every tab, and the tab
    // icons came from a second map that disagreed with the row icons (D5).
    const CATEGORIES = [
        { key: 'all', label: t('inventory.catAll'), icon: 'database' },
        ...INVENTORY_CATEGORIES.map((c) => ({
            key: c as string,
            label: t(CATEGORY_LABEL_KEY[c]),
            icon: CATEGORY_ICON[c],
        })),
    ];

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [farmNames, setFarmNames] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');

    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);

    const cacheRef = useRef<{ data: InventoryItem[]; timestamp: number } | null>(null);
    const CACHE_TTL = 30000;

    const fetchInventory = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
            setInventory(cacheRef.current.data);
            setIsLoading(false);
            return;
        }

        setError(null);
        setIsOffline(false);

        try {
            // No farmId: since D7 the server answers with every farm the caller
            // may VIEW_INVENTORY on, so a manager of two farms sees both — and
            // a member of somebody else's farm stops getting an empty list.
            const { data } = await inventoryApi.getAll();
            setInventory(data);
            cacheRef.current = { data, timestamp: Date.now() };

            // Farm captions only matter once there are two farms to tell apart.
            if (new Set(data.map((i) => i.farmId)).size > 1) {
                try {
                    const { data: farms } = await farmsApi.getAll();
                    setFarmNames(Object.fromEntries(farms.map((f) => [f.id, f.name])));
                } catch {
                    // A missing caption is not worth failing the screen over.
                }
            }
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
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Force past the cache on focus: coming back from the form must show
            // what was just saved.
            fetchInventory(true);
        }, [fetchInventory])
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchInventory(true);
    }, [fetchInventory]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchInventory(true);
    }, [fetchInventory]);

    /** Which farm a new item goes to: the active one, else the only one on screen. */
    const farmIds = useMemo(() => [...new Set(inventory.map((i) => i.farmId))], [inventory]);
    const addFarmId = selectedFarm?.id ?? (farmIds.length === 1 ? farmIds[0] : undefined);
    const { canManageInventory } = usePermissions(addFarmId);

    const openForm = useCallback(() => {
        navigation.navigate('InventoryForm', { farmId: addFarmId });
    }, [navigation, addFarmId]);

    const filtered = useMemo(
        () => (selectedCategory === 'all' ? inventory : inventory.filter((i) => i.category === selectedCategory)),
        [inventory, selectedCategory],
    );

    /** One section per farm when the list spans several; one unlabelled otherwise. */
    const sections = useMemo(() => {
        if (farmIds.length <= 1) {
            return filtered.length ? [{ title: '', data: filtered }] : [];
        }
        return farmIds
            .map((id) => ({
                title: farmNames[id] ?? t('inventory.farmFallback'),
                data: filtered.filter((i) => i.farmId === id),
            }))
            .filter((s) => s.data.length > 0);
    }, [filtered, farmIds, farmNames, t]);

    const lowStockCount = inventory.filter(isLowStock).length;

    const getStockStatus = useCallback((item: InventoryItem) => {
        if (Number(item.quantity) <= 0) return { color: theme.roles.light.dangerText, label: t('inventory.outOfStock') };
        if (isLowStock(item)) return { color: theme.roles.light.warningText, label: t('inventory.lowStock') };
        return { color: theme.roles.light.successText, label: t('inventory.inStock') };
    }, [t]);

    const renderCategoryTab = (category: { key: string; label: string; icon: string }) => {
        const active = selectedCategory === category.key;
        return (
            <TouchableOpacity
                key={category.key}
                style={[styles.categoryTab, active && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(category.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={category.label}
            >
                <MaterialCommunityIcons
                    name={category.icon as any}
                    size={18}
                    color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                />
                <Text numberOfLines={1} style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {category.label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderInventoryItem = useCallback(({ item }: { item: InventoryItem }) => {
        const status = getStockStatus(item);
        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('InventoryDetail', { inventoryId: item.id, itemName: item.name })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${status.label}`}
            >
                <Card style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                        <View style={[styles.categoryIcon, { backgroundColor: status.color + '20' }]}>
                            <MaterialCommunityIcons name={itemIcon(item) as any} size={20} color={status.color} />
                        </View>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                            <Text style={styles.itemCategory} numberOfLines={1}>
                                {t(CATEGORY_LABEL_KEY[item.category] ?? 'inventory.catOther')}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                            <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>{status.label}</Text>
                        </View>
                    </View>
                    <View style={styles.itemFooter}>
                        <Text style={styles.stockText}>
                            <Text style={styles.stockValue}>{Number(item.quantity)}</Text> {item.unit ?? ''}
                        </Text>
                        <Text style={styles.thresholdText}>
                            {t('inventory.minLabel')} {Number(item.reorderLevel ?? 0)} {item.unit ?? ''}
                        </Text>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    }, [navigation, t, getStockStatus]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
                {lowStockCount > 0 && (
                    <View style={styles.alertBadge} accessibilityLabel={t('inventory.lowStockCount', { count: lowStockCount })}>
                        <MaterialCommunityIcons name="alert-circle" size={20} color={theme.roles.light.warningText} />
                        <Text style={styles.alertText}>{lowStockCount}</Text>
                    </View>
                )}
            </View>

            <View style={styles.categoryBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBarContent}>
                    {CATEGORIES.map(renderCategoryTab)}
                </ScrollView>
            </View>

            {isLoading ? (
                <View style={styles.listContent}>
                    <SkeletonList count={4} />
                </View>
            ) : isOffline ? (
                <NetworkError onRetry={handleRetry} />
            ) : error && inventory.length === 0 ? (
                <ErrorState title={t('inventory.errorTitle')} error={error} onRetry={handleRetry} />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderInventoryItem}
                    renderSectionHeader={({ section }) =>
                        section.title ? <Text style={styles.sectionHeader}>{section.title}</Text> : null
                    }
                    stickySectionHeadersEnabled={false}
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
                            icon="database"
                            title={t('inventory.emptyTitle')}
                            subtitle={t('inventory.emptySubtitle')}
                            actionLabel={canManageInventory ? t('inventory.addItem') : undefined}
                            onAction={canManageInventory ? openForm : undefined}
                        />
                    }
                />
            )}

            {/* Adding stock is MANAGE_INVENTORY, not owner-only any more (D13) —
                but a worker with read-only inventory must not see the button. */}
            {canManageInventory && <FAB icon="plus" onPress={openForm} />}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    headerTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
    },
    alertBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.roles.light.warningBg,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.md,
        minHeight: 32,
    },
    alertText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.warningText,
        marginLeft: theme.spacing[1],
    },
    categoryBar: {
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    categoryBarContent: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        gap: theme.spacing[2],
    },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    categoryTabActive: {
        backgroundColor: theme.roles.light.primary + '20',
    },
    categoryLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginLeft: theme.spacing[1],
    },
    categoryLabelActive: {
        color: theme.roles.light.primary,
    },
    sectionHeader: {
        ...theme.typeScale.overline,
        color: theme.roles.light.textTertiary,
        marginBottom: theme.spacing[2],
    },
    listContent: {
        padding: theme.spacing[4],
        paddingBottom: 100,
    },
    itemCard: {
        marginBottom: theme.spacing[3],
        padding: 0,
        overflow: 'hidden',
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[4],
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        marginLeft: theme.spacing[3],
        marginRight: theme.spacing[2],
        minWidth: 0,
    },
    itemName: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '500',
    },
    itemCategory: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: theme.spacing[2],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radius.sm,
        maxWidth: 110,
    },
    statusText: {
        ...theme.typeScale.labelSmall,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: theme.spacing[4],
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    stockText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    stockValue: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
    },
    thresholdText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textDisabled,
    },
});
