import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated, Alert, ScrollView, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { FAB } from '../../components/ui/FAB';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { inventoryApi, InventoryItem } from '../../api/inventory';
import { apiErrorMessage } from '../../api/errors';
import { farmsApi } from '../../api/farms';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useFocusEffect } from '@react-navigation/native';

export const InventoryListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();

    const CATEGORIES = [
        { key: 'all', label: t('inventory.catAll'), icon: 'database' },
        { key: 'feed', label: t('inventory.catFeed'), icon: 'corn' },
        { key: 'chemical', label: t('inventory.catChemicals'), icon: 'flask' },
        { key: 'equipment', label: t('inventory.catEquipment'), icon: 'tools' },
        { key: 'other', label: t('inventory.catOther'), icon: 'package-variant' },
    ];

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Add-item form state
    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);
    const setSelectedFarm = useActiveFarmStore((s) => s.setSelectedFarm);
    const [showAdd, setShowAdd] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: 'feed',
        quantity: '',
        unit: '',
        unitPrice: '',
        reorderLevel: '',
        supplier: '',
    });

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    // Cache ref
    const cacheRef = useRef<{ data: InventoryItem[]; timestamp: number } | null>(null);
    const CACHE_TTL = 30000;

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

    const fetchInventory = useCallback(async (forceRefresh = false) => {
        // This screen used to call getAll('') whenever no farm was selected —
        // an empty farmId never matches anything, so the list silently came
        // back empty and "Add Item" just alerted "select a farm" with no
        // actual picker anywhere to do that. Resolve a real farm first,
        // same fallback HomeScreen already uses (auto-pick the first one).
        let farmId = selectedFarm?.id;
        if (!farmId) {
            try {
                const { data: farms } = await farmsApi.getAll();
                const first = Array.isArray(farms) ? farms[0] : undefined;
                if (first) {
                    farmId = first.id;
                    setSelectedFarm({ id: first.id, name: first.name, location: (first as any).location });
                }
            } catch {
                // fall through — handled as "no farm" below
            }
        }
        if (!farmId) {
            setInventory([]);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }

        if (!forceRefresh && cacheRef.current) {
            const { data, timestamp } = cacheRef.current;
            if (Date.now() - timestamp < CACHE_TTL) {
                setInventory(data);
                setIsLoading(false);
                fadeIn();
                return;
            }
        }

        setError(null);
        setIsOffline(false);

        try {
            const { data } = await inventoryApi.getAll(farmId);
            setInventory(data);
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
    }, [fadeIn, selectedFarm?.id, setSelectedFarm]);

    useFocusEffect(
        useCallback(() => {
            fetchInventory();
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

    const openAdd = useCallback(() => {
        setForm({
            name: '',
            // default to the category the user is currently viewing (not 'all')
            category: selectedCategory !== 'all' ? selectedCategory : 'feed',
            quantity: '',
            unit: '',
            unitPrice: '',
            reorderLevel: '',
            supplier: '',
        });
        setShowAdd(true);
    }, [selectedCategory]);

    const submitAdd = useCallback(async () => {
        const farmId = selectedFarm?.id;
        if (!farmId) {
            Alert.alert(t('common.error'), t('inventory.noFarmSelected', 'Select a farm before adding inventory.'));
            return;
        }
        if (!form.name.trim()) {
            Alert.alert(t('common.error'), t('inventory.nameRequired', 'Item name is required.'));
            return;
        }
        setAddSubmitting(true);
        try {
            await inventoryApi.create({
                farmId,
                name: form.name.trim(),
                category: form.category,
                unit: form.unit.trim() || undefined,
                quantity: form.quantity ? Number(form.quantity) : undefined,
                reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined,
                unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
                supplier: form.supplier.trim() || undefined,
            });
            setShowAdd(false);
            await fetchInventory(true); // force refresh past the 30s cache
        } catch (err: any) {
            Alert.alert(
                t('common.error'),
                apiErrorMessage(err, t('inventory.addFailed', 'Failed to add inventory item.')),
            );
        } finally {
            setAddSubmitting(false);
        }
    }, [selectedFarm, form, fetchInventory, t]);

    const filteredInventory = selectedCategory === 'all'
        ? inventory
        : inventory.filter(item => item.category === selectedCategory);

    const lowStockItems = inventory.filter(item => item.quantity <= (item.reorderLevel ?? 0));

    const getStockStatus = (item: InventoryItem) => {
        if (item.quantity <= 0) return { color: theme.roles.light.dangerText, label: t('inventory.outOfStock') };
        if (item.quantity <= (item.reorderLevel ?? 0)) return { color: theme.roles.light.warningText, label: t('inventory.lowStock') };
        return { color: theme.roles.light.successText, label: t('inventory.inStock') };
    };

    const renderSkeleton = () => (
        <View style={styles.listContent}>
            <SkeletonList count={4} />
        </View>
    );

    const renderCategoryTab = (category: { key: string; label: string; icon: string }) => (
        <TouchableOpacity
            key={category.key}
            style={[
                styles.categoryTab,
                selectedCategory === category.key && styles.categoryTabActive
            ]}
            onPress={() => setSelectedCategory(category.key)}
        >
            <MaterialCommunityIcons
                name={category.icon as any}
                size={18}
                color={selectedCategory === category.key ? theme.roles.light.primary : theme.roles.light.textSecondary}
            />
            <Text numberOfLines={1} style={[
                styles.categoryLabel,
                selectedCategory === category.key && styles.categoryLabelActive
            ]}>
                {category.label}
            </Text>
        </TouchableOpacity>
    );

    const renderInventoryItem = useCallback(({ item, index }: { item: InventoryItem; index: number }) => {
        const status = getStockStatus(item);
        const animStyle = {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
        };

        return (
            <Animated.View style={animStyle}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('InventoryDetail', { inventoryId: item.id, itemName: item.name })}
                    activeOpacity={0.7}
                >
                    <Card style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                            <View style={[styles.categoryIcon, { backgroundColor: status.color + '20' }]}>
                                <MaterialCommunityIcons
                                    name={item.category === 'feed' ? 'corn' : item.category === 'chemical' ? 'flask' : 'package-variant'}
                                    size={20}
                                    color={status.color}
                                />
                            </View>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemCategory}>{item.category}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                            </View>
                        </View>
                        <View style={styles.itemFooter}>
                            <Text style={styles.stockText}>
                                <Text style={styles.stockValue}>{item.quantity}</Text> {item.unit}
                            </Text>
                            <Text style={styles.thresholdText}>
                                {t('inventory.minLabel')} {(item.reorderLevel ?? 0)} {item.unit}
                            </Text>
                        </View>
                    </Card>
                </TouchableOpacity>
            </Animated.View>
        );
    }, [navigation, fadeAnim, scaleAnim, t]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
                {lowStockItems.length > 0 && (
                    <TouchableOpacity style={styles.alertBadge}>
                        <MaterialCommunityIcons name="alert-circle" size={20} color={theme.roles.light.warningText} />
                        <Text style={styles.alertText}>{lowStockItems.length}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.categoryBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBarContent}>
                    {CATEGORIES.map(renderCategoryTab)}
                </ScrollView>
            </View>

            {isLoading ? (
                renderSkeleton()
            ) : isOffline ? (
                <NetworkError onRetry={handleRetry} />
            ) : error && inventory.length === 0 ? (
                <ErrorState
                    title={t('inventory.errorTitle')}
                    error={error}
                    onRetry={handleRetry}
                />
            ) : (
                <FlatList
                    data={filteredInventory}
                    keyExtractor={(item) => item.id}
                    renderItem={renderInventoryItem}
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
                            actionLabel={t('inventory.addItem')}
                            onAction={openAdd}
                        />
                    }
                />
            )}

            <FAB icon="plus" onPress={openAdd} />

            {/* Add-item modal — real create form (was a comingSoon stub). */}
            <Modal
                visible={showAdd}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAdd(false)}
            >
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>{t('inventory.addItem')}</Text>

                            <Input
                                label={t('inventory.fieldName', 'Item name')}
                                value={form.name}
                                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                                placeholder={t('inventory.namePlaceholder', 'e.g. Starter feed')}
                                required
                                leftIcon="tag-outline"
                            />

                            <Text style={styles.fieldLabel}>{t('inventory.fieldCategory', 'Category')}</Text>
                            <View style={styles.catChips}>
                                {CATEGORIES.filter((c) => c.key !== 'all').map((c) => {
                                    const active = form.category === c.key;
                                    return (
                                        <TouchableOpacity
                                            key={c.key}
                                            style={[styles.catChip, active && styles.catChipActive]}
                                            onPress={() => setForm((f) => ({ ...f, category: c.key }))}
                                        >
                                            <MaterialCommunityIcons
                                                name={c.icon as any}
                                                size={16}
                                                color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                                            />
                                            <Text style={[styles.catChipLabel, active && styles.catChipLabelActive]}>
                                                {c.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Input
                                label={t('inventory.fieldQuantity', 'Quantity')}
                                value={form.quantity}
                                onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                leftIcon="counter"
                            />
                            <Input
                                label={t('inventory.fieldUnit', 'Unit')}
                                value={form.unit}
                                onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))}
                                placeholder={t('inventory.unitPlaceholder', 'e.g. kg, bag')}
                                leftIcon="scale-balance"
                            />
                            <Input
                                label={t('inventory.fieldReorderLevel', 'Reorder level')}
                                value={form.reorderLevel}
                                onChangeText={(v) => setForm((f) => ({ ...f, reorderLevel: v }))}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                leftIcon="alert-outline"
                            />
                            <Input
                                label={t('inventory.fieldUnitPrice', 'Unit price (₹)')}
                                value={form.unitPrice}
                                onChangeText={(v) => setForm((f) => ({ ...f, unitPrice: v }))}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                leftIcon="currency-inr"
                            />
                            <Input
                                label={t('inventory.fieldSupplier', 'Supplier')}
                                value={form.supplier}
                                onChangeText={(v) => setForm((f) => ({ ...f, supplier: v }))}
                                placeholder={t('inventory.supplierPlaceholder', 'Optional')}
                                leftIcon="truck-outline"
                            />

                            <View style={styles.modalActions}>
                                <Button
                                    title={t('common.cancel', 'Cancel')}
                                    variant="outlined"
                                    onPress={() => setShowAdd(false)}
                                    style={styles.modalBtn}
                                    disabled={addSubmitting}
                                />
                                <Button
                                    title={t('inventory.addItem')}
                                    onPress={() => void submitAdd()}
                                    loading={addSubmitting}
                                    style={styles.modalBtn}
                                />
                            </View>
                        </ScrollView>
                    </Card>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    // Add-item modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: theme.spacing[4],
    },
    modalCard: {
        width: '100%',
        maxHeight: '85%',
    },
    modalTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    fieldLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    catChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4],
    },
    catChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
    },
    catChipActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.infoBg,
    },
    catChipLabel: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    catChipLabelActive: {
        color: theme.roles.light.primary,
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    modalBtn: {
        flex: 1,
    },
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
        marginLeft: theme.spacing[1],
    },
    categoryLabelActive: {
        color: theme.roles.light.primary,
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
