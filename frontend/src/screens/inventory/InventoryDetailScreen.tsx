import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { inventoryApi, InventoryItem } from '../../api/inventory';
import { useFocusEffect } from '@react-navigation/native';

export const InventoryDetailScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { inventoryId, itemName } = route.params;
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Adjust-stock modal state
    const [adjustMode, setAdjustMode] = useState<'add' | 'reduce' | null>(null);
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Edit-item modal state
    const [showEdit, setShowEdit] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', category: '', unit: '', reorderLevel: '', unitPrice: '', supplier: '' });
    const [isEditSaving, setIsEditSaving] = useState(false);

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
        } finally {
            setIsLoading(false);
        }
    };

    const getStockStatus = () => {
        if (!item) return { color: theme.roles.light.textDisabled, label: t('common.status') };
        if (item.quantity <= 0) return { color: theme.roles.light.dangerText, label: t('inventory.outOfStock'), icon: 'alert-circle' };
        if (item.quantity <= (item.reorderLevel ?? 0)) return { color: theme.roles.light.warningText, label: t('inventory.lowStock'), icon: 'alert' };
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
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('inventory.adjustFailed', 'Failed to adjust stock.'));
        } finally {
            setIsAdjusting(false);
        }
    };

    const handleEdit = () => {
        if (!item) return;
        setEditForm({
            name: item.name,
            category: item.category,
            unit: item.unit ?? '',
            reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
            supplier: item.supplier ?? '',
        });
        setShowEdit(true);
    };

    const submitEdit = async () => {
        if (!editForm.name.trim()) {
            Alert.alert(t('common.error'), t('inventory.nameRequired', 'Item name is required.'));
            return;
        }
        setIsEditSaving(true);
        try {
            await inventoryApi.update(inventoryId, {
                name: editForm.name.trim(),
                category: editForm.category.trim() || undefined,
                unit: editForm.unit.trim() || undefined,
                reorderLevel: editForm.reorderLevel ? Number(editForm.reorderLevel) : undefined,
                unitPrice: editForm.unitPrice ? Number(editForm.unitPrice) : undefined,
                supplier: editForm.supplier.trim() || undefined,
            });
            setShowEdit(false);
            await fetchItem();
        } catch (err: any) {
            Alert.alert(t('common.error'), err?.response?.data?.message ?? t('inventory.editFailed', 'Failed to update item.'));
        } finally {
            setIsEditSaving(false);
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
                <Text style={styles.title}>{item.name}</Text>
                <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
                    <MaterialCommunityIcons name="pencil" size={20} color={theme.roles.light.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.statusBanner, { backgroundColor: status.color + '20' }]}>
                    <MaterialCommunityIcons name={status.icon as any} size={28} color={status.color} />
                    <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                </View>

                <Card style={styles.stockCard}>
                    <Text style={styles.stockLabel}>{t('inventory.currentStock')}</Text>
                    <Text style={styles.stockValue}>{item.quantity}</Text>
                    <Text style={styles.stockUnit}>{item.unit}</Text>
                    <View style={styles.stockBar}>
                        <View
                            style={[
                                styles.stockBarFill,
                                {
                                    width: `${Math.min(100, (item.quantity / ((item.reorderLevel ?? 0) * 2)) * 100)}%`,
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
                        <MaterialCommunityIcons name="shape" size={20} color={theme.roles.light.textSecondary} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>{t('inventory.labelCategory')}</Text>
                            <Text style={styles.infoValue}>{item.category}</Text>
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
                                <Text style={styles.infoLabel}>{t('inventory.labelLastPurchase')}</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(item.expiryDate).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    )}

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

                <Button
                    title={t('inventory.adjustStock')}
                    onPress={handleAdjustStock}
                    style={styles.adjustBtn}
                    icon="package-variant-closed"
                />

                <Text style={styles.sectionTitle}>{t('inventory.stockHistory')}</Text>
                <Card style={styles.historyCard}>
                    <View style={styles.historyPlaceholder}>
                        <MaterialCommunityIcons name="history" size={32} color={theme.roles.light.textDisabled} />
                        <Text style={styles.historyPlaceholderText}>
                            {t('inventory.stockHistoryComingSoon')}
                        </Text>
                    </View>
                </Card>
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

            <Modal
                visible={showEdit}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEdit(false)}
            >
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>{t('inventory.editItem', 'Edit item')}</Text>
                            <Input
                                label={t('inventory.fieldName', 'Item name')}
                                value={editForm.name}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                                required
                                leftIcon="tag-outline"
                            />
                            <Input
                                label={t('inventory.fieldCategory', 'Category')}
                                value={editForm.category}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, category: v }))}
                                leftIcon="shape"
                            />
                            <Input
                                label={t('inventory.fieldUnit', 'Unit')}
                                value={editForm.unit}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, unit: v }))}
                                leftIcon="scale-balance"
                            />
                            <Input
                                label={t('inventory.fieldReorderLevel', 'Reorder level')}
                                value={editForm.reorderLevel}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, reorderLevel: v }))}
                                keyboardType="decimal-pad"
                                leftIcon="alert-outline"
                            />
                            <Input
                                label={t('inventory.fieldUnitPrice', 'Unit price (₹)')}
                                value={editForm.unitPrice}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, unitPrice: v }))}
                                keyboardType="decimal-pad"
                                leftIcon="currency-inr"
                            />
                            <Input
                                label={t('inventory.fieldSupplier', 'Supplier')}
                                value={editForm.supplier}
                                onChangeText={(v) => setEditForm((f) => ({ ...f, supplier: v }))}
                                leftIcon="truck-outline"
                            />
                            <View style={styles.modalActions}>
                                <Button
                                    title={t('common.cancel')}
                                    variant="outlined"
                                    onPress={() => setShowEdit(false)}
                                    style={styles.modalBtn}
                                    disabled={isEditSaving}
                                />
                                <Button
                                    title={t('common.save')}
                                    onPress={() => void submitEdit()}
                                    loading={isEditSaving}
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
    editBtn: {
        padding: theme.spacing[4],
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
    adjustBtn: {
        marginBottom: theme.spacing[6],
    },
    sectionTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    historyCard: {
        padding: theme.spacing[4],
    },
    historyPlaceholder: {
        alignItems: 'center',
        padding: theme.spacing[4],
    },
    historyPlaceholderText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textDisabled,
        marginTop: theme.spacing[2],
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
