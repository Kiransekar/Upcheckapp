import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import * as Crypto from 'expo-crypto';
import { inventoryApi, InventoryItem, InventoryMovement, InventoryPurchase, isLowStock, stockFraction, itemIcon, CATEGORY_LABEL_KEY } from '../../api/inventory';
import { farmsApi } from '../../api/farms';
import { apiErrorMessage } from '../../api/errors';
import { usePermissions } from '../../hooks/usePermissions';
import { confirm } from '../../utils/confirm';
import { formatAge, formatNumber } from '../../utils/formatDate';
import { useFocusEffect } from '@react-navigation/native';

/** Same shape the finance screens use — one rupee formatter, no new util. */
const formatMoney = (value: number) => `₹${Number(value).toFixed(2)}`;

export const InventoryDetailScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { inventoryId, itemName } = route.params;
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);

    // Adjust-stock modal state
    const [adjustMode, setAdjustMode] = useState<'add' | 'reduce' | null>(null);
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Purchase capture, ADD path only. Unit price and total are two views of
    // one number: typing either fills the other, so the farmer uses whichever
    // the invoice actually shows.
    const [unitPrice, setUnitPrice] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [billToFarmId, setBillToFarmId] = useState<string | null>(null);
    const [farmNames, setFarmNames] = useState<Record<string, string>>({});

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
        }
        // Purchases are the money half of the link. Own call, own failure, and
        // an empty list for a farmer with no financial access — the server
        // filters by VIEW_FINANCIALS per farm, so the section simply does not
        // render rather than 403ing the whole screen.
        try {
            const { data } = await inventoryApi.listPurchases(inventoryId);
            setPurchases(data);
        } catch (error) {
            console.error('Failed to fetch inventory purchases:', error);
            setPurchases([]);
        }
        setIsLoading(false);
    };

    // Farm names are only ever used to label the bill-to choice and the
    // "expense recorded for X" confirmation, so they are fetched when the add
    // modal opens, not on every visit to the screen.
    const farmIds = item?.farmIds ?? (item?.farmId ? [item.farmId] : []);
    const needsFarmChoice = farmIds.length > 1;
    useEffect(() => {
        if (adjustMode !== 'add' || Object.keys(farmNames).length) return;
        farmsApi.getAll()
            .then(({ data }) => setFarmNames(Object.fromEntries((data ?? []).map((f: any) => [f.id, f.name]))))
            .catch(() => { /* names are a nicety; the ids still work */ });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adjustMode]);

    const getStockStatus = () => {
        if (!item) return { color: theme.roles.light.textDisabled, label: t('common.status') };
        if (Number(item.quantity) <= 0) return { color: theme.roles.light.dangerText, label: t('inventory.outOfStock'), icon: 'alert-circle' };
        if (isLowStock(item)) return { color: theme.roles.light.warningText, label: t('inventory.lowStock'), icon: 'alert' };
        return { color: theme.roles.light.successText, label: t('inventory.inStock'), icon: 'check-circle' };
    };

    const openAdjust = (mode: 'add' | 'reduce') => {
        setAdjustAmount('');
        setAdjustReason('');
        setUnitPrice('');
        setTotalCost('');
        setBillToFarmId(farmIds.length === 1 ? farmIds[0] : null);
        setAdjustMode(mode);
    };

    const handleAdjustStock = () => {
        Alert.alert(
            t('inventory.adjustStock'),
            t('inventory.adjustStockChoose'),
            [
                { text: t('inventory.addStock'), onPress: () => openAdjust('add') },
                { text: t('inventory.reduceStock'), onPress: () => openAdjust('reduce') },
                { text: t('common.cancel'), style: 'cancel' },
            ]
        );
    };

    /** Typing either price fills the other from the quantity. */
    const onUnitPriceChange = (text: string) => {
        setUnitPrice(text);
        const qty = parseFloat(adjustAmount);
        const price = parseFloat(text);
        setTotalCost(qty > 0 && price > 0 ? String(Number((qty * price).toFixed(2))) : '');
    };
    const onTotalCostChange = (text: string) => {
        setTotalCost(text);
        const qty = parseFloat(adjustAmount);
        const total = parseFloat(text);
        setUnitPrice(qty > 0 && total > 0 ? String(Number((total / qty).toFixed(2))) : '');
    };
    const onQuantityChange = (text: string) => {
        setAdjustAmount(text);
        const qty = parseFloat(text);
        const price = parseFloat(unitPrice);
        // The unit price is what the farmer read off the invoice, so it is the
        // one that survives a quantity edit; the total follows it.
        if (qty > 0 && price > 0) setTotalCost(String(Number((qty * price).toFixed(2))));
    };

    const submitAdjust = async () => {
        const amount = parseFloat(adjustAmount);
        if (!adjustAmount.trim() || isNaN(amount) || amount <= 0) {
            Alert.alert(t('common.error'), t('inventory.validAmountRequired', 'Enter a valid quantity greater than 0.'));
            return;
        }
        // Cost only ever rides on stock coming IN (D2): consuming feed is
        // attribution, not a second rupee, and the server rejects an amount on
        // a reduction rather than dropping it.
        const cost = adjustMode === 'add' ? parseFloat(totalCost) : NaN;
        const isPurchase = Number.isFinite(cost) && cost > 0;
        if (isPurchase && !billToFarmId) {
            Alert.alert(t('common.error'), t('inventory.billToFarmRequired'));
            return;
        }
        setIsAdjusting(true);
        try {
            const signedAmount = adjustMode === 'reduce' ? -amount : amount;
            // One key per attempt, reused by every retry underneath: the server
            // makes the replay a no-op instead of buying the feed twice (F1).
            await inventoryApi.adjustStock(inventoryId, signedAmount, adjustReason.trim() || undefined, {
                idempotencyKey: Crypto.randomUUID(),
                ...(isPurchase ? { amount: cost, billToFarmId: billToFarmId! } : {}),
            });
            setAdjustMode(null);
            await fetchItem();
            if (isPurchase) {
                // Name the money row that was just written, so the expense is
                // never a surprise the farmer finds later on the Money screen.
                Alert.alert(
                    t('inventory.purchaseSection'),
                    t('inventory.purchaseRecorded', {
                        quantity: amount,
                        unit: item?.unit ?? '',
                        amount: formatMoney(cost),
                        farm: farmNames[billToFarmId!] ?? '',
                    }),
                );
            }
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
                                            {/* The pond a consumption fed, joined server-side
                                                through feed_record_id — this is where "where
                                                did my feed go" becomes readable. */}
                                            <Text style={styles.movementMeta} numberOfLines={1}>
                                                {m.reason || t('inventory.movementNoReason')}
                                                {m.pondName ? ` ${t('inventory.movementToPond', { pond: m.pondName })}` : ''}
                                                {' · '}{formatAge(m.createdAt)}
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

                {/* The money half of the link. Hidden entirely when the server
                    returns nothing — either no purchases, or no financial
                    access — so a storekeeper never sees an empty "Purchases"
                    heading they are not allowed to fill. */}
                {purchases.length > 0 && (
                    <Card style={styles.infoCard}>
                        <View style={[styles.infoRow, styles.noBorder]}>
                            <MaterialCommunityIcons name="cash-multiple" size={20} color={theme.roles.light.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>{t('inventory.purchaseSection')}</Text>
                                {purchases.map((p) => (
                                    <View key={p.id} style={styles.movementRow}>
                                        <Text style={styles.infoValue}>{formatMoney(p.amount)}</Text>
                                        <Text style={styles.movementMeta} numberOfLines={1}>
                                            {new Date(p.transactionDate).toLocaleDateString()}
                                            {farmNames[p.farmId] ? ` · ${farmNames[p.farmId]}` : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </Card>
                )}

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
                    <ScrollView keyboardShouldPersistTaps="handled">
                        <Input
                            label={t('inventory.fieldQuantity', 'Quantity')}
                            value={adjustAmount}
                            onChangeText={onQuantityChange}
                            placeholder="0"
                            keyboardType="decimal-pad"
                            leftIcon="counter"
                            required
                        />

                        {/* Cost capture, ADD path only (D2). Optional: an
                            opening balance the farmer already owns must not
                            book an expense today. */}
                        {adjustMode === 'add' && (
                            <>
                                <Text style={styles.sectionHint}>{t('inventory.purchaseCostHint')}</Text>
                                <Input
                                    label={t('inventory.fieldUnitPrice')}
                                    value={unitPrice}
                                    onChangeText={onUnitPriceChange}
                                    placeholder="0"
                                    keyboardType="decimal-pad"
                                    leftIcon="tag-outline"
                                />
                                <Input
                                    label={t('inventory.fieldTotalCost')}
                                    value={totalCost}
                                    onChangeText={onTotalCostChange}
                                    placeholder="0"
                                    keyboardType="decimal-pad"
                                    leftIcon="cash"
                                />
                                {/* One purchase bills exactly one farm. With a
                                    shared item the server refuses to guess, so
                                    neither do we. */}
                                {needsFarmChoice && (
                                    <>
                                        <Text style={styles.sectionHint}>{t('inventory.billToFarm')}</Text>
                                        <View style={styles.farmChoices}>
                                            {farmIds.map((fid) => (
                                                <TouchableOpacity
                                                    key={fid}
                                                    onPress={() => setBillToFarmId(fid)}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: billToFarmId === fid }}
                                                    style={[styles.farmChip, billToFarmId === fid && styles.farmChipActive]}
                                                >
                                                    <Text style={billToFarmId === fid ? styles.farmChipTextActive : styles.farmChipText}>
                                                        {farmNames[fid] ?? fid.slice(0, 8)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                            </>
                        )}

                        <Input
                            label={t('common.notes')}
                            value={adjustReason}
                            onChangeText={setAdjustReason}
                            placeholder={t('inventory.reasonPlaceholder', 'Optional reason')}
                            leftIcon="note-text-outline"
                        />
                    </ScrollView>
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
    sectionHint: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    farmChoices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    farmChip: {
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        minHeight: 44,
        justifyContent: 'center',
    },
    farmChipActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.primary + '20',
    },
    farmChipText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    farmChipTextActive: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.primary,
        fontWeight: '600',
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
