/**
 * AddWorkerScreen — owner adds a worker to a farm. Two ways to find the person:
 *   1. Scan their profile QR (expo-camera), which encodes `upcheck-worker:<id>`.
 *   2. Enter their unique id / phone / email manually (camera-free fallback).
 * Either way we resolve the user, show a confirm card, then POST the membership.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { theme } from '../../theme';
import { farmMembersApi, WORKER_QR_PREFIX, type PublicUser, type AssignableRole } from '../../api/farmMembers';
import { apiErrorMessage } from '../../api/errors';
import { usePermissions } from '../../hooks/usePermissions';
import { canAssignRole } from '../../permissions/capabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Build a lookup query by guessing the identifier's kind. */
const lookupParams = (value: string) => {
    const v = value.trim();
    if (v.includes('@')) return { email: v };
    if (UUID_RE.test(v)) return { userId: v };
    return { phone: v };
};

const displayName = (u: PublicUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || u.id.slice(0, 8);

export const AddWorkerScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};
    const [mode, setMode] = useState<'scan' | 'manual'>('scan');
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [found, setFound] = useState<PublicUser | null>(null);
    const [busy, setBusy] = useState(false);
    const [role, setRole] = useState<AssignableRole>('worker');

    // Roles the caller may assign here: owner → manager/worker/viewer, manager → worker.
    const perms = usePermissions(farmId);
    const roleOptions = (['manager', 'worker', 'viewer'] as AssignableRole[]).filter((r) =>
        canAssignRole(perms.role, r),
    );

    const resolveUser = useCallback(async (params: { userId?: string; phone?: string; email?: string }) => {
        setBusy(true);
        try {
            const { data } = await farmMembersApi.lookupUser(params);
            setFound(data);
        } catch (e: any) {
            setFound(null);
            // #35: a failed lookup used to dead-end here — alert and re-arm,
            // with no way forward for someone who simply has no account yet.
            // Now the alert offers a real next step. The scanner only re-arms
            // on Cancel: re-arming unconditionally (the old behaviour) is what
            // made this a loop with no exit, because "send an invite" also
            // navigates away, and a QR scan mid-navigation is not useful.
            Alert.alert(
                t('members.notFoundTitle'),
                apiErrorMessage(e, t('members.inviteInsteadBody')),
                [
                    {
                        text: t('common.cancel'),
                        style: 'cancel',
                        onPress: () => {
                            // `onBarcode` sets `scanned` before calling us and bails
                            // out early while it is true, so without this a
                            // valid-prefix QR whose lookup fails wedges the camera
                            // until the user toggles modes. Same 1200ms debounce as
                            // the invalid-prefix path below, so dismissing the alert
                            // doesn't immediately re-scan the same failing code.
                            setTimeout(() => setScanned(false), 1200);
                        },
                    },
                    {
                        text: t('members.inviteInstead'),
                        onPress: () => navigation.navigate('FarmMembers', { farmId, farmName, autoShare: true }),
                    },
                ],
            );
        } finally {
            setBusy(false);
        }
    }, [t]);

    const onBarcode = useCallback(({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        if (!data.startsWith(WORKER_QR_PREFIX)) {
            Alert.alert(t('members.invalidQrTitle'), t('members.invalidQrSub'));
            setTimeout(() => setScanned(false), 1200);
            return;
        }
        const userId = data.slice(WORKER_QR_PREFIX.length).trim();
        resolveUser({ userId });
    }, [scanned, resolveUser, t]);

    const confirmAdd = useCallback(async () => {
        if (!found) return;
        setBusy(true);
        try {
            await farmMembersApi.addMember(farmId, found.id, role);
            Alert.alert(t('members.addedTitle'), t('members.addedSub', { name: displayName(found) }));
            navigation.goBack();
        } catch (e: any) {
            Alert.alert(t('common.error'), apiErrorMessage(e, t('members.addError')));
        } finally {
            setBusy(false);
        }
    }, [found, farmId, navigation, role, t]);

    const reset = () => { setFound(null); setScanned(false); setIdentifier(''); };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{t('members.addWorker')}</Text>
                    {farmName ? <Text style={styles.subtitle} numberOfLines={1}>{farmName}</Text> : null}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Mode toggle */}
                <View style={styles.segment}>
                    {(['scan', 'manual'] as const).map((m) => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.segBtn, mode === m && styles.segBtnActive]}
                            onPress={() => { setMode(m); reset(); }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons
                                name={m === 'scan' ? 'qrcode-scan' : 'form-textbox'}
                                size={18}
                                color={mode === m ? theme.roles.light.primary : theme.roles.light.textSecondary}
                            />
                            <Text numberOfLines={1} style={[styles.segLabel, mode === m && { color: theme.roles.light.primary }]}>
                                {t(m === 'scan' ? 'members.scanTab' : 'members.manualTab')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Found user confirm card takes precedence */}
                {found ? (
                    <Card style={styles.confirmCard}>
                        <View style={styles.avatar}>
                            <MaterialCommunityIcons name="account-check" size={28} color={theme.roles.light.primary} />
                        </View>
                        <Text style={styles.foundName}>{displayName(found)}</Text>
                        {found.username ? <Text style={styles.foundMeta}>@{found.username}</Text> : null}
                        {roleOptions.length > 1 ? (
                            <View style={styles.rolePicker}>
                                <ChipGroup
                                    label={t('members.roleLabel', 'Role')}
                                    value={role}
                                    onChange={(v) => v && setRole(v as AssignableRole)}
                                    options={roleOptions.map((r) => ({ value: r, label: t(`members.role_${r}`, r) }))}
                                />
                            </View>
                        ) : null}
                        <Button title={t('members.confirmAdd')} onPress={confirmAdd} loading={busy} style={styles.confirmBtn} />
                        <Button title={t('common.cancel')} variant="text" onPress={reset} />
                    </Card>
                ) : mode === 'scan' ? (
                    <Card style={styles.scanCard}>
                        {!permission ? (
                            <Text style={styles.scanHint}>{t('members.cameraChecking')}</Text>
                        ) : !permission.granted ? (
                            <View style={styles.permBox}>
                                <MaterialCommunityIcons name="camera-off-outline" size={32} color={theme.roles.light.textSecondary} />
                                <Text style={styles.scanHint}>{t('members.cameraDenied')}</Text>
                                <Button title={t('members.grantCamera')} onPress={requestPermission} variant="outlined" />
                                <Button title={t('members.enterManually')} variant="text" onPress={() => setMode('manual')} />
                            </View>
                        ) : (
                            <>
                                <View style={styles.cameraWrap}>
                                    <CameraView
                                        style={styles.camera}
                                        facing="back"
                                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                                        onBarcodeScanned={busy ? undefined : onBarcode}
                                    />
                                </View>
                                <Text style={styles.scanHint}>{t('members.scanHint')}</Text>
                            </>
                        )}
                    </Card>
                ) : (
                    <Card style={styles.manualCard}>
                        <Input
                            label={t('members.identifierLabel')}
                            value={identifier}
                            onChangeText={setIdentifier}
                            placeholder={t('members.identifierPlaceholder')}
                            autoCapitalize="none"
                            leftIcon="account-search-outline"
                        />
                        <Button
                            title={t('members.findUser')}
                            onPress={() => resolveUser(lookupParams(identifier))}
                            loading={busy}
                            disabled={!identifier.trim()}
                            style={styles.findBtn}
                        />
                    </Card>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    backBtn: { padding: theme.spacing[1] },
    title: { ...theme.typeScale.h1, color: theme.roles.light.textPrimary },
    subtitle: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    segment: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    segBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2],
        paddingVertical: theme.spacing[3], borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.roles.light.borderDefault,
    },
    segBtnActive: { borderColor: theme.roles.light.primary, backgroundColor: theme.roles.light.surfaceOverlay },
    segLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
    scanCard: { padding: theme.spacing[4], alignItems: 'center', gap: theme.spacing[3] },
    cameraWrap: {
        width: '100%', aspectRatio: 1, borderRadius: theme.radius.lg, overflow: 'hidden',
        backgroundColor: theme.roles.light.surfaceVariant,
    },
    camera: { flex: 1 },
    scanHint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, textAlign: 'center' },
    permBox: { alignItems: 'center', gap: theme.spacing[3], paddingVertical: theme.spacing[6] },
    manualCard: { padding: theme.spacing[4] },
    findBtn: { marginTop: theme.spacing[4] },
    confirmCard: { padding: theme.spacing[6], alignItems: 'center', gap: theme.spacing[2] },
    avatar: {
        width: 56, height: 56, borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceOverlay, alignItems: 'center', justifyContent: 'center',
        marginBottom: theme.spacing[2],
    },
    foundName: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    foundMeta: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    rolePicker: { alignSelf: 'stretch', marginTop: theme.spacing[3] },
    confirmBtn: { marginTop: theme.spacing[4], alignSelf: 'stretch' },
});

export default AddWorkerScreen;
