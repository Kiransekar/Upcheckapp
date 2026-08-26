/**
 * JoinFarmScreen — artboard 07 ("Join your farm") plus the three states
 * artboard 10 specifies for it: loading, error and expired invite.
 *
 * Eight character boxes rather than one text field, because the code IS eight
 * characters and a worker reading it off a phone screen needs to see which one
 * they are on. A single hidden TextInput drives all eight, so paste, autofill
 * and the OS keyboard all keep working — eight real inputs would break every
 * one of them.
 *
 * The two failure states are deliberately NOT the same. A code that never
 * existed is a typo: the boxes turn red and the message says check it. A code
 * that existed and is no longer usable — expired, revoked, all its uses spent —
 * is not the worker's mistake and retyping it will never help, so it gets the
 * warning tone and a message that points at the person who can issue a new one.
 * Collapsing the two sends the worker round in circles retyping a dead code.
 */
import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { theme } from '../../theme';
import { farmMembersApi, inviteRejectionOf, type InviteRejection } from '../../api/farmMembers';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';

const CODE_LENGTH = 8;
const c = theme.roles.light;

/**
 * Which failure tone a rejection deserves. "Dead" codes are the farm owner's
 * to fix; only a code that matched nothing is worth retyping.
 */
const isDeadCode = (r: InviteRejection | null) =>
    r === 'expired' || r === 'revoked' || r === 'exhausted';

const DEAD_CODE_KEY: Record<'expired' | 'revoked' | 'exhausted', string> = {
    expired: 'members.joinExpired',
    revoked: 'members.joinRevoked',
    exhausted: 'members.joinExhausted',
};

export const JoinFarmScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const pendingFarmJoin = useAuthStore((s) => s.pendingFarmJoin);
    const completeFarmJoin = useAuthStore((s) => s.completeFarmJoin);
    const loadMemberships = useMembershipStore((s) => s.load);

    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    /** null = no failure yet. Split into two shapes; see the header. */
    const [failure, setFailure] = useState<{ dead: boolean; message: string } | null>(null);
    const [scanning, setScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const inputRef = useRef<TextInput>(null);

    const chars = code.padEnd(CODE_LENGTH).split('').slice(0, CODE_LENGTH);
    const complete = code.length === CODE_LENGTH;

    const skip = () => {
        if (pendingFarmJoin) completeFarmJoin();
        navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
    };

    const setCodeFrom = (raw: string) => {
        setCode(raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH));
        // Any edit clears the previous failure — leaving a red box under a
        // freshly typed code reads as though the new one is wrong too.
        setFailure(null);
    };

    const join = async (value = code) => {
        if (value.length !== CODE_LENGTH) return;
        setBusy(true);
        setFailure(null);
        try {
            const { data } = await farmMembersApi.joinFarm(value);
            await loadMemberships();
            if (pendingFarmJoin) completeFarmJoin();
            navigation.replace('JoinedFarm', {
                farmName: data.farm?.name ?? '',
                role: data.role,
                status: data.status,
            });
        } catch (e: any) {
            const reason = inviteRejectionOf(e);
            // Everything that is not a dead code gets the design's one line.
            // The server's own message is deliberately not surfaced: it is
            // English-only and phrased for a developer, and this screen is the
            // one place a farmer is most likely to be reading in Telugu.
            setFailure(
                isDeadCode(reason)
                    ? { dead: true, message: t(DEAD_CODE_KEY[reason as 'expired']) }
                    : { dead: false, message: t('onboarding.joinFarmError') },
            );
        } finally {
            setBusy(false);
        }
    };

    const openScanner = async () => {
        const granted = permission?.granted ? permission : await requestPermission();
        if (!granted?.granted) {
            setFailure({ dead: false, message: t('onboarding.joinFarmCameraDenied') });
            return;
        }
        setScanning(true);
    };

    /** The owner's invite QR encodes the bare code (see FarmMembersScreen). */
    const onScanned = ({ data }: { data: string }) => {
        if (!scanning) return;
        setScanning(false);
        const scanned = data.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
        setCode(scanned);
        setFailure(null);
        if (scanned.length === CODE_LENGTH) join(scanned);
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                title={t('onboarding.joinFarmTitle')}
                // During the first-run gate there is nothing behind this screen;
                // "I'll do this later" below is the exit instead of a dead arrow.
                onBack={pendingFarmJoin ? undefined : () => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
            />

            <View style={styles.body}>
                <Text style={styles.subtitle}>{t('onboarding.joinFarmSubtitle')}</Text>

                {busy ? (
                    /* Artboard 10, "Loading". The whole form goes, rather than a
                       spinner bolted onto a form that is no longer editable. */
                    <View style={styles.loadingCard} accessibilityLabel={t('common.loading')}>
                        <Skeleton width="45%" height={16} />
                        <Skeleton width="70%" height={12} />
                        <View style={styles.loadingBoxes}>
                            {[0, 1, 2, 3].map((i) => (
                                <Skeleton key={i} width={40} height={44} borderRadius={theme.radius.sm} />
                            ))}
                        </View>
                        <Skeleton width="100%" height={44} borderRadius={theme.radius.md} />
                    </View>
                ) : (
                    <>
                        {/* Purely a tap target that returns focus to the real
                            input below — the input carries the label, so this
                            must not announce itself as a second control. */}
                        <Pressable
                            style={styles.boxes}
                            onPress={() => inputRef.current?.focus()}
                            accessible={false}
                            importantForAccessibility="no-hide-descendants"
                        >
                            {chars.map((ch, i) => {
                                const filled = ch.trim().length > 0;
                                const isCursor = i === code.length;
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.box,
                                            filled && styles.boxFilled,
                                            isCursor && styles.boxCursor,
                                            // Artboard 10, "Error" — a wrong code marks the
                                            // characters themselves, next to the message.
                                            failure && !failure.dead && filled && styles.boxError,
                                        ]}
                                    >
                                        <Text style={styles.boxText}>{ch.trim()}</Text>
                                    </View>
                                );
                            })}
                        </Pressable>

                        {/* One real input behind the boxes: keeps paste, autofill
                            and the keyboard working. */}
                        <TextInput
                            ref={inputRef}
                            value={code}
                            onChangeText={setCodeFrom}
                            maxLength={CODE_LENGTH}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            autoFocus
                            style={styles.hiddenInput}
                            accessibilityLabel={t('onboarding.joinFarmCodeLabel')}
                        />

                        {failure ? (
                            failure.dead ? (
                                /* Artboard 10, "Expired invite". */
                                <View style={styles.warnBanner}>
                                    <Icon name="warning" size={20} color={c.warningText} />
                                    <Text style={styles.warnText}>{failure.message}</Text>
                                </View>
                            ) : (
                                <View style={styles.errorRow}>
                                    <Icon name="warning" size={20} color={c.dangerText} />
                                    <Text style={styles.errorText}>{failure.message}</Text>
                                </View>
                            )
                        ) : (
                            <Text style={styles.hint}>{t('onboarding.joinFarmCodeHint')}</Text>
                        )}

                        <TouchableOpacity
                            style={styles.scanBtn}
                            onPress={openScanner}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={t('onboarding.joinFarmScanQr')}
                        >
                            <Icon name="qr_code_scanner" size={22} color={c.textSecondary} />
                            <Text style={styles.scanText}>{t('onboarding.joinFarmScanQr')}</Text>
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.spacer} />

                {/* Hidden until the code is the right length — a button that
                    cannot work should be absent, not greyed out. */}
                {complete && !busy && (
                    <Button title={t('onboarding.joinFarmCta')} onPress={() => join()} style={styles.cta} />
                )}
                <TouchableOpacity
                    onPress={skip}
                    style={styles.skip}
                    accessibilityRole="button"
                    accessibilityLabel={t('onboarding.joinFarmSkip')}
                >
                    <Text style={styles.skipText}>{t('onboarding.joinFarmSkip')}</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
                <View style={styles.scanner}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={onScanned}
                    />
                    <TouchableOpacity
                        style={styles.scanClose}
                        onPress={() => setScanning(false)}
                        accessibilityRole="button"
                        accessibilityLabel={t('onboarding.joinFarmScanClose')}
                    >
                        <Text style={styles.scanCloseText}>{t('onboarding.joinFarmScanClose')}</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    body: { flex: 1, paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[2] },
    subtitle: { ...theme.typeScale.bodyMedium, color: c.textSecondary, marginBottom: theme.spacing[6] },
    boxes: { flexDirection: 'row', gap: theme.spacing[2] },
    box: {
        flex: 1,
        height: 52,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: c.borderDefault,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxFilled: { borderColor: c.borderStrong },
    boxCursor: { borderWidth: 1.5, borderColor: c.primary },
    boxError: { borderColor: c.dangerBorder },
    boxText: { ...theme.typeScale.h3, color: c.textPrimary },
    // Off-screen rather than display:none — a hidden input keeps focus and the
    // keyboard, an unmounted one does not.
    hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
    hint: { ...theme.typeScale.bodySmall, color: c.textTertiary, marginTop: theme.spacing[3] },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        marginTop: theme.spacing[3],
    },
    errorText: { ...theme.typeScale.bodySmall, color: c.dangerText, flex: 1 },
    warnBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        backgroundColor: c.warningBg,
        marginTop: theme.spacing[3],
    },
    warnText: { ...theme.typeScale.bodySmall, color: c.warningText, flex: 1 },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        minHeight: 48,
        marginTop: theme.spacing[5],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: c.borderStrong,
        backgroundColor: c.surface,
    },
    scanText: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    loadingCard: {
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: c.borderDefault,
        backgroundColor: c.surface,
    },
    loadingBoxes: { flexDirection: 'row', gap: theme.spacing[2] },
    spacer: { flex: 1, minHeight: theme.spacing[6] },
    cta: { alignSelf: 'stretch' },
    skip: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing[2],
        marginBottom: theme.spacing[4],
    },
    skipText: { ...theme.typeScale.labelLarge, color: c.textTertiary },
    scanner: { flex: 1, backgroundColor: c.textPrimary },
    scanClose: {
        position: 'absolute',
        bottom: 48,
        alignSelf: 'center',
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing[6],
        borderRadius: theme.radius.full,
        backgroundColor: c.surface,
    },
    scanCloseText: { ...theme.typeScale.labelLarge, color: c.textPrimary },
});

export default JoinFarmScreen;
