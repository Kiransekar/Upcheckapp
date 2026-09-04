import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { inventoryApi, InventoryItem, InventoryMovement, isLowStock, stockFraction, itemIcon, CATEGORY_LABEL_KEY } from '../../api/inventory';
import { apiErrorMessage } from '../../api/errors';
import { usePermissions } from '../../hooks/usePermissions';
import { confirm } from '../../utils/confirm';
import { formatAge, formatNumber } from '../../utils/formatDate';
import { useFocusEffect } from '@react-navigation/native';

export const InventoryDetailScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { inventoryId, itemName } = route.params;
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Adjust-stock modal state
    const [adjustMode, setAdjustMode] = useState<'add' | 'reduce' | null>(null);
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Editing lives on InventoryForm now — the same screen that creates an item,
    // so the two can never drift into offering different fields again (D4).
    // item.farmId is now nullable (Task 8: an item may be paired to several
    // farms or none) — usePermissions still wants a single farm or undefined.
    const { canManageInventory } = usePermissions(item?.farmId ?? undefined);

    // Refetch on FOCUS, not on mount. React Navigation keeps a screen mounted
    // once opened, so a mount-only effect never ran again — the page kept
    // showing figures from before whatever was just logged elsewhere.
    useFocusEffect(useCallback(() => {
        fetchItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventoryId]));

    const fetchItem = async () => {
        try {
            const { data } = await inventoryApi.getById(inventoryId);
            setItem(data);
        } catch (error) {
            console.error('Failed to fetch inventory item:', error);
            Alert.alert(t('common.error'), t('inventory.loadItemError'));
            setIsLoading(false);
            return;
        }
        // Own call, own failure: a farmer with no ledger permission (or an
        // item created before this shipped) still sees the item itself — the
        // history section just falls back to lastAdjustmentReason below.
        // This is the same focus-refetch/post-adjust choke point that keeps
        // `item` fresh (see submitAdjust and the useFocusEffect above); the
        // TanStack cache in query/client.ts intentionally does not cover
        // /inventory reads (see its URL_ENTITY_MAP comment), so this is where
        // "an adjustment must refresh the list" actually gets satisfied.
        try {
            const { data } = await inventoryApi.listMovements(inventoryId);
            setMovements(data);
        } catch (error) {
            console.error('Failed to fetch inventory movements:', error);
            setMovements([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getStockStatus = () => {
        if (!item) return { color: theme.roles.light.textDisabled, label: t('common.status') };
        if (Number(item.quantity) <= 0) return { color: theme.roles.light.dangerText, label: t('inventory.outOfStock'), icon: 'alert-circle' };
        if (isLowStock(item)) return { color: theme.roles.light.warningText, label: t('inventory.lowStock'), icon: 'alert' };
        return { color: theme.roles.light.successText, label: t('inventory.inStock'), icon: 'check-circle' };
    };

    const handleAdjustStock = () => {
        Alert.alert(
            t('inventory.adjustStock'),
            t('inventory.adjustStockChoose'),
            [
                { text: t('inventory.addStock'), onPress: () => { setAdjustAmount(''); setAdjustReason(''); setAdjustMode('add'); } },
                { text: t('inventory.reduceStock'), onPress: () => { setAdjustAmount(''); setAdjustReason(''); setAdjustMode('reduce'); } },
                { text: t('common.cancel'), style: 'cancel' },
            ]
        );
    };

    const submitAdjust = async () => {
        const amount = parseFloat(adjustAmount);
        if (!adjustAmount.trim() || isNaN(amount) || amount <= 0) {
            Alert.alert(t('common.error'), t('inventory.validAmountRequired', 'Enter a valid quantity greater than 0.'));
            return;
        }
        setIsAdjusting(true);
        try {
            const signedAmount = adjustMode === 'reduce' ? -amount : amount;
            await inventoryApi.adjustStock(inventoryId, signedAmount, adjustReason.trim() || undefined);
            setAdjustMode(null);
            await fetchItem();
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('inventory.adjustFailed', 'Failed to adjust stock.')));
        } finally {
            setIsAdjusting(false);
        }
    };

    const handleDelete = async () => {
        if (!item) return;
        const ok = await confirm({
            title: t('inventory.deleteItem'),
            message: t('inventory.deleteConfirm', { name: item.name }),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            destructive: true,
        });
        if (!ok) return;
        try {
            await inventoryApi.delete(inventoryId);
            navigation.goBack();
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('inventory.deleteFailed')));
        }
    };

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!item) {
        return (
            <ScreenWrapper>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{itemName || t('inventory.inventoryItemFallback')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="database-off" size={64} color={theme.roles.light.textDisabled} />
                    <Text style={styles.errorText}>{t('inventory.itemNotFound')}</Text>
                </View>
            </ScreenWrapper>
        );
    }

    const status = getStockStatus();

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                {canManageInventory ? (
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('InventoryForm', { itemId: inventoryId })}
                            style={styles.editBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.edit')}
                        >
                            <MaterialCommunityIcons name="pencil" size={20} color={theme.roles.light.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => void handleDelete()}
                            style={styles.editBtn}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.delete')}
                        >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.roles.light.dangerText} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.statusBanner, { backgroundColor: status.color + '20' }]}>
                    <MaterialCommunityIcons name={status.icon as any} size={28} color={status.color} />
                    <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                </View>

                <Card style={styles.stockCard}>
                    <Text style={styles.stockLabel}>{t('inventory.currentStock')}</Text>
                    <Text style={styles.stockValue}>{Number(item.quantity)}</Text>
                    <Text style={styles.stockUnit}>{item.unit}</Text>
                    <View style={styles.stockBar}>
                        {/* Was `quantity / (reorderLevel * 2)` — NaN% with no
                            threshold, Infinity% with a threshold of zero, and
                            React Native silently drew nothing either way (D6). */}
                        <View
                            style={[
                                styles.stockBarFill,
                                {
                                    width: `${stockFraction(item.quantity, item.reorderLevel) * 100}%`,
                                    backgroundColor: status.color,
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.thresholdText}>
                        {t('inventory.minimumThreshold', { count: item.reorderLevel ?? 0, unit: item.unit })}
                    </Text>
                </Card>

                <Card style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name={itemIcon(item) as any} size={20} color={theme.roles.light.textSecondary} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>{t('inventory.labelCategory')}</Text>
                            <Text style={styles.infoValue}>
                                {t(CATEGORY_LABEL_KEY[item.category] ?? 'inventory.catOther')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="cube-outline" size={20} color={theme.roles.light.textSecondary} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>{t('inventory.labelUnit')}</Text>
                            <Text style={styles.infoValue}>{item.unit}</Text>
                        </View>
                    </View>

                    {item.expiryDate && (
                        <View style={styles.infoRow}>
                            <MaterialCommunityIcons name="calendar" size={20} color={theme.roles.light.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                {/* This column is `expiry_date` and always was. It
                                    was labelled "Last Purchase" in all six locales
                                    (D3) — telling a farmer their medicine was bought
                                    on the day it in fact goes off. */}
                                <Text style={styles.infoLabel}>{t('inventory.labelExpiryDate')}</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(item.expiryDate).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/*
                        Stock history (Task 15): `inventory_movements` is now the
                        source of truth for "who changed what and when" — D2's
                        `lastAdjustmentReason` only ever held the MOST RECENT
                        reason, overwriting every prior one. Items adjusted before
                        this shipped have a reason but no ledger rows, so that
                        single-value view survives below as the fallback.
                    */}
                    {movements.length > 0 ? (
                        <View style={styles.infoRow}>
                            <MaterialCommunityIcons name="history" size={20} color={theme.roles.light.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>{t('inventory.movementHistory')}</Text>
                                {movements.map((m) => {
                                    const delta = Number(m.delta);
                                    const sign = delta > 0 ? '+' : '';
                                    return (
                                        <View key={m.id} style={styles.movementRow}>
                                            <Text
                                                style={[
                                                    styles.movementDelta,
                                                    { color: delta >= 0 ? theme.roles.light.successText : theme.roles.light.dangerText },
                                                ]}
                                            >
                                                {sign}{formatNumber(delta)} {item.unit}
                                            </Text>
                                            <Text style={styles.movementMeta} numberOfLines={1}>
                                                {m.reason || t('inventory.movementNoReason')} · {formatAge(m.createdAt)}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ) : item.lastAdjustmentReason ? (
                        <View style={styles.infoRow}>
                            <MaterialCommunityIcons name="history" size={20} color={theme.roles.light.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>{t('inventory.labelLastAdjustment')}</Text>
                                <Text style={styles.infoValue}>{item.lastAdjustmentReason}</Text>
                            </View>
                        </View>
                    ) : null}

                    {item.notes && (
                        <View style={[styles.infoRow, styles.noBorder]}>
                            <MaterialCommunityIcons name="note-text" size={20} color={theme.roles.light.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>{t('common.notes')}</Text>
                                <Text style={styles.infoValue}>{item.notes}</Text>
                            </View>
                        </View>
                    )}
                </Card>

                {canManageInventory && (
                    <Button
                        title={t('inventory.adjustStock')}
                        onPress={handleAdjustStock}
                        style={styles.adjustBtn}
                    />
                )}
            </ScrollView>

            <Modal
                visible={adjustMode !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setAdjustMode(null)}
            >
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {adjustMode === 'reduce' ? t('inventory.reduceStock') : t('inventory.addStock')}
                        </Text>
                        <Input
                            label={t('inventory.fieldQuantity', 'Quantity')}
                            value={adjustAmount}
                            onChangeText={setAdjustAmount}
                            placeholder="0"
                            keyboardType="decimal-pad"
                            leftIcon="counter"
                            required
                        />
                        <Input
                            label={t('common.notes')}
                            value={adjustReason}
                            onChangeText={setAdjustReason}
                            placeholder={t('inventory.reasonPlaceholder', 'Optional reason')}
                            leftIcon="note-text-outline"
                        />
                        <View style={styles.modalActions}>
                            <Button
                                title={t('common.cancel')}
                                variant="outlined"
                                onPress={() => setAdjustMode(null)}
                                style={styles.modalBtn}
                                disabled={isAdjusting}
                            />
                            <Button
                                title={t('common.save')}
                                onPress={() => void submitAdjust()}
                                loading={isAdjusting}
                                style={styles.modalBtn}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>

        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    backBtn: {
        padding: theme.spacing[4],
    },
    title: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing[3],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[4],
    },
    content: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[12],
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        marginBottom: theme.spacing[4],
    },
    statusLabel: {
        ...theme.typeScale.h4,
        marginLeft: theme.spacing[2],
    },
    stockCard: {
        alignItems: 'center',
        padding: theme.spacing[6],
        marginBottom: theme.spacing[4],
    },
    stockLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    stockValue: {
        ...theme.typeScale.h1,
        color: theme.roles.light.textPrimary,
    },
    stockUnit: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[4],
    },
    stockBar: {
        width: '100%',
        height: 8,
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: 4,
        marginBottom: theme.spacing[2],
    },
    stockBarFill: {
        height: 8,
        borderRadius: 4,
    },
    thresholdText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textDisabled,
    },
    infoCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    noBorder: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    infoTextContainer: {
        marginLeft: theme.spacing[3],
        flex: 1,
    },
    infoLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: 2,
    },
    infoValue: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
    },
    movementRow: {
        marginTop: theme.spacing[2],
    },
    movementDelta: {
        ...theme.typeScale.bodyMedium,
        fontWeight: '600',
    },
    movementMeta: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    adjustBtn: {
        marginBottom: theme.spacing[6],
    },
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
    modalActions: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    modalBtn: {
        flex: 1,
    },
});
