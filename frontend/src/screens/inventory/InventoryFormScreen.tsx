/**
 * ONE screen for creating AND editing an inventory item.
 *
 * There used to be two forms: a create modal with category chips, and an edit
 * modal with category as a free-text box (D4). A farmer who typed "Feed " with
 * a trailing space on edit lost the item from every filter tab and had no way
 * to see why. Two forms drift; one cannot.
 *
 * `farmId` (single) is fixed on edit — the server no longer accepts it on a
 * PATCH (D14). Task 8 adds `farmIds`: an item may be paired to several farms,
 * or deliberately none. That pairing changes through `setPairing`, a separate
 * call from the rest of the form's fields.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { SelectField } from '../../components/ui/SelectField';
import { Stepper } from '../../components/ui/Stepper';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { ErrorState } from '../../components/ui/ErrorState';
import { IconPicker } from '../../components/inventory/IconPicker';
import { theme } from '../../theme';
import {
    inventoryApi,
    INVENTORY_CATEGORIES,
    INVENTORY_UNITS,
    CATEGORY_ICON,
    unitStep,
} from '../../api/inventory';
import { apiErrorMessage } from '../../api/errors';
import { farmsApi, type Farm } from '../../api/farms';
import { useActiveFarmStore } from '../../store/activeFarmStore';
import { useMembershipStore } from '../../store/membershipStore';
import { roleCan } from '../../permissions/capabilities';
import { usePermissions } from '../../hooks/usePermissions';
import { useUIStore } from '../../store/uiStore';

/** Two farm-id arrays are the same pairing, regardless of order. */
const sameFarmSet = (a: string[], b: string[]): boolean =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

const CATEGORY_LABEL_KEY: Record<string, string> = {
    feed: 'inventory.catFeed',
    chemical: 'inventory.catChemicals',
    equipment: 'inventory.catEquipment',
    medicine: 'inventory.catMedicine',
    other: 'inventory.catOther',
};

/** `2026-09-04T00:00:00.000Z` → a local Date, without the timezone slide. */
const parseDate = (iso?: string | null): Date | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
};

export const InventoryFormScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const showToast = useUIStore((s) => s.showToast);
    const itemId: string | undefined = route.params?.itemId;
    const isEditing = !!itemId;

    const selectedFarm = useActiveFarmStore((s) => s.selectedFarm);
    const activeFarmId = selectedFarm?.id;
    // Gates access to this screen — the farm context the user arrived from
    // (or the item's primary farm once loaded on edit), separate from the
    // (possibly empty, possibly multi-farm) pairing below.
    const [contextFarmId, setContextFarmId] = useState<string | undefined>(route.params?.farmId ?? activeFarmId);
    const { canManageInventory } = usePermissions(contextFarmId);

    const memberships = useMembershipStore((s) => s.memberships);
    const grantForFarm = useMembershipStore((s) => s.grantForFarm);
    const [allFarms, setAllFarms] = useState<Farm[]>([]);
    // Farms this user may pair the item onto/away from — MANAGE_INVENTORY is
    // exactly the capability setPairing asserts server-side.
    const manageableFarms = useMemo(
        () => allFarms.filter((f) => {
            const { role, overrides, policy } = grantForFarm(f.id);
            return roleCan(role, 'MANAGE_INVENTORY', overrides, policy);
        }),
        [allFarms, memberships, grantForFarm],
    );

    // Was a single farmId. An item can now be stocked for several farms, or
    // deliberately for none.
    const [farmIds, setFarmIds] = useState<string[]>([]);
    const [originalFarmIds, setOriginalFarmIds] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [showIcons, setShowIcons] = useState(false);

    const [name, setName] = useState('');
    const [category, setCategory] = useState<string>('feed');
    const [icon, setIcon] = useState<string | null>(null);
    const [unit, setUnit] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(0);
    const [reorderLevel, setReorderLevel] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [supplier, setSupplier] = useState('');
    const [expiry, setExpiry] = useState<Date | null>(null);
    const [notes, setNotes] = useState('');

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const { data: farms } = await farmsApi.getAll();
            if (Array.isArray(farms)) setAllFarms(farms);

            if (itemId) {
                const { data } = await inventoryApi.getById(itemId);
                const pairing = data.farmIds ?? (data.farmId ? [data.farmId] : []);
                setFarmIds(pairing);
                setOriginalFarmIds(pairing);
                setContextFarmId(data.farmId ?? pairing[0]);
                setName(data.name);
                setCategory(data.category);
                setIcon(data.icon ?? null);
                setUnit(data.unit ?? null);
                setQuantity(Number(data.quantity) || 0);
                setReorderLevel(data.reorderLevel != null ? String(data.reorderLevel) : '');
                setUnitPrice(data.unitPrice != null ? String(data.unitPrice) : '');
                setSupplier(data.supplier ?? '');
                setExpiry(parseDate(data.expiryDate));
                setNotes(data.notes ?? '');
            } else if (!contextFarmId && Array.isArray(farms) && farms[0]) {
                // No farm in the params and none active — pick the first one
                // rather than dead-ending the farmer on a form that cannot save.
                setContextFarmId(farms[0].id);
            }
        } catch (err) {
            setLoadError(err);
        } finally {
            setLoading(false);
        }
        // contextFarmId is deliberately not a dependency: this sets it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    useEffect(() => {
        load();
    }, [load]);

    // Default to the farm the user arrived from, then the active farm, then
    // the first they can manage — same precedence the single-farm version used.
    useEffect(() => {
        if (isEditing || farmIds.length || !manageableFarms.length) return;
        const preferred = route?.params?.farmId ?? activeFarmId ?? manageableFarms[0].id;
        setFarmIds(manageableFarms.some((f) => f.id === preferred) ? [preferred] : []);
    }, [isEditing, manageableFarms, activeFarmId, route?.params?.farmId]);

    const step = useMemo(() => unitStep(unit), [unit]);

    const save = async () => {
        if (!name.trim()) {
            Alert.alert(t('common.error'), t('inventory.nameRequired'));
            return;
        }
        // Security fix (coordinator, overrides the original spec): an item
        // paired to zero farms is unreachable by any capability check, so
        // the server now refuses to create/leave one that way. This block
        // mirrors that server-side BadRequestException client-side, reusing
        // the pre-existing "select a farm" copy rather than adding a key.
        if (farmIds.length === 0) {
            Alert.alert(t('common.error'), t('inventory.noFarmSelected'));
            return;
        }
        // The server @Min(0)s all three; catch it here so the farmer gets a
        // sentence in their own language instead of a 400.
        const numbers: [string, string][] = [
            [t('inventory.fieldReorderLevel'), reorderLevel],
            [t('inventory.fieldUnitPrice'), unitPrice],
        ];
        for (const [label, raw] of numbers) {
            if (raw.trim() && !(Number(raw) >= 0)) {
                Alert.alert(t('common.error'), t('inventory.negativeNotAllowed', { field: label }));
                return;
            }
        }

        const payload = {
            name: name.trim(),
            category,
            icon: icon ?? undefined,
            unit: unit ?? undefined,
            quantity,
            reorderLevel: reorderLevel.trim() ? Number(reorderLevel) : undefined,
            unitPrice: unitPrice.trim() ? Number(unitPrice) : undefined,
            supplier: supplier.trim() || undefined,
            expiryDate: expiry ? expiry.toISOString() : undefined,
            notes: notes.trim() || undefined,
        };

        setSaving(true);
        try {
            if (isEditing) {
                await inventoryApi.update(itemId!, payload);
                if (!sameFarmSet(farmIds, originalFarmIds)) {
                    await inventoryApi.setPairing(itemId!, farmIds);
                }
            } else {
                await inventoryApi.create({ farmIds, ...payload });
            }
            showToast({ message: t('common.savedSuccess'), type: 'success' });
            navigation.goBack();
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('inventory.saveFailed')));
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
                {isEditing ? t('inventory.editItem') : t('inventory.addItem')}
            </Text>
            <View style={{ width: 40 }} />
        </View>
    );

    if (loading) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (loadError) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <ErrorState error={loadError} onRetry={() => { setLoading(true); load(); }} />
            </ScreenWrapper>
        );
    }

    if (!canManageInventory) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                {header}
                <View style={styles.center}>
                    <MaterialCommunityIcons name="lock-outline" size={48} color={theme.roles.light.textDisabled} />
                    <Text style={styles.denied}>{t('inventory.noPermission')}</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper scroll={false} padded={false}>
            {header}

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Card style={styles.card}>
                    <Input
                        label={t('inventory.fieldName')}
                        value={name}
                        onChangeText={setName}
                        placeholder={t('inventory.namePlaceholder')}
                        required
                        leftIcon="tag-outline"
                    />

                    <ChipGroup
                        label={t('inventory.fieldCategory')}
                        value={category}
                        onChange={(v) => setCategory(v ?? category)}
                        options={INVENTORY_CATEGORIES.map((c) => ({
                            value: c,
                            label: t(CATEGORY_LABEL_KEY[c]),
                            icon: CATEGORY_ICON[c] as any,
                        }))}
                    />

                    <Text style={styles.fieldLabel}>{t('inventory.fieldIcon')}</Text>
                    <TouchableOpacity
                        style={styles.iconField}
                        onPress={() => setShowIcons(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('inventory.pickIcon')}
                    >
                        <View style={styles.iconPreview}>
                            <MaterialCommunityIcons
                                name={(icon ?? CATEGORY_ICON[category] ?? 'package-variant') as any}
                                size={26}
                                color={theme.roles.light.primary}
                            />
                        </View>
                        <Text style={styles.iconFieldText} numberOfLines={1}>
                            {icon ?? t('inventory.iconFromCategory')}
                        </Text>
                        {icon ? (
                            <TouchableOpacity onPress={() => setIcon(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('inventory.clearIcon')}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={theme.roles.light.textTertiary} />
                            </TouchableOpacity>
                        ) : (
                            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.roles.light.textSecondary} />
                        )}
                    </TouchableOpacity>
                </Card>

                <Card style={styles.card}>
                    <SectionHeader label={t('inventory.pairedFarms')} />
                    <ChipGroup
                        multiple
                        options={manageableFarms.map((f) => ({ value: f.id, label: f.name }))}
                        value={farmIds}
                        onChange={setFarmIds}
                    />
                    {farmIds.length === 0 && (
                        // "critical", not "warning": save() now blocks on this rather
                        // than letting it through (coordinator security fix).
                        <AlertBanner type="critical" title={t('inventory.unpairedTitle')} message={t('inventory.unpairedWarning')} />
                    )}
                </Card>

                <Card style={styles.card}>
                    <SelectField
                        label={t('inventory.fieldUnit')}
                        value={unit}
                        options={INVENTORY_UNITS.map((u) => ({ value: u, label: u }))}
                        onSelect={setUnit}
                        placeholder={t('inventory.unitPlaceholder')}
                        leftIcon="scale-balance"
                    />

                    <Stepper
                        label={t('inventory.fieldQuantity')}
                        value={quantity}
                        onChange={setQuantity}
                        step={step}
                        min={0}
                        unit={unit ?? undefined}
                    />

                    <Input
                        label={t('inventory.fieldReorderLevel')}
                        value={reorderLevel}
                        onChangeText={setReorderLevel}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        leftIcon="alert-outline"
                        hint={t('inventory.reorderHint')}
                    />
                    <Input
                        label={t('inventory.fieldUnitPrice')}
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        leftIcon="currency-inr"
                    />
                </Card>

                <Card style={styles.card}>
                    <Input
                        label={t('inventory.fieldSupplier')}
                        value={supplier}
                        onChangeText={setSupplier}
                        placeholder={t('inventory.supplierPlaceholder')}
                        leftIcon="truck-outline"
                    />

                    {expiry ? (
                        <>
                            <CalendarPicker
                                label={t('inventory.labelExpiryDate')}
                                value={expiry}
                                onChange={setExpiry}
                            />
                            <TouchableOpacity onPress={() => setExpiry(null)} style={styles.linkBtn} accessibilityRole="button">
                                <Text style={styles.linkText}>{t('inventory.clearExpiry')}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={() => setExpiry(new Date())} style={styles.addDateBtn} accessibilityRole="button">
                            <MaterialCommunityIcons name="calendar-plus" size={20} color={theme.roles.light.primary} />
                            <Text style={styles.linkText}>{t('inventory.addExpiry')}</Text>
                        </TouchableOpacity>
                    )}

                    <Input
                        label={t('common.notes')}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={t('inventory.notesPlaceholder')}
                        multiline
                        numberOfLines={3}
                        style={styles.textArea}
                    />
                </Card>

                <Button
                    title={isEditing ? t('common.save') : t('inventory.addItem')}
                    onPress={() => void save()}
                    loading={saving}
                    style={styles.saveBtn}
                />
            </ScrollView>

            <IconPicker
                visible={showIcons}
                value={icon}
                onSelect={setIcon}
                onClose={() => setShowIcons(false)}
            />
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
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary, flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[3], padding: theme.spacing[6] },
    denied: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textSecondary, textAlign: 'center' },
    content: { padding: theme.spacing[4], paddingBottom: theme.spacing[12] },
    card: { marginBottom: theme.spacing[4] },
    fieldLabel: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary, marginBottom: 8 },
    iconField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        minHeight: 56,
    },
    iconPreview: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    iconFieldText: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    addDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        minHeight: 44,
        marginBottom: theme.spacing[4],
    },
    linkBtn: { minHeight: 44, justifyContent: 'center', marginBottom: theme.spacing[2] },
    linkText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary, fontWeight: '600' },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    saveBtn: { marginTop: theme.spacing[2], marginBottom: theme.spacing[8] },
});

export default InventoryFormScreen;
