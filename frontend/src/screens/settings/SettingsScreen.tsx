/**
 * Settings — artboard p6, and the sixth tab.
 *
 * The tab used to open a hub of fourteen coloured cards ("More"), which is an
 * index, not a destination. p6 makes it the actual settings page: who you are,
 * what language the app speaks, alerts, security, about, and the two account
 * actions.
 *
 * ONE deliberate addition to the artboard. p6 shows no tools list, because the
 * design assumes calculators, inventory, reference and the rest are reachable
 * elsewhere. In this app they are not — eleven routes had "More" as their only
 * entry point. Stranding them to match a drawing would be a worse app, so they
 * are kept as plain rows under "Tools" and "Farm", in the same one-line style
 * as the rest of the page rather than as the old card grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Modal, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import i18n from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import {
    registerForPushNotificationsAsync,
    syncReminders,
    getReminderStatus,
    DEFAULT_REMINDER_TIMES,
    type ReminderTimes,
    type ReminderStatus,
    type HM,
} from '../../utils/notifications';
import { loadReminderTimes, saveReminderTimes } from '../../features/reminderTimes';
import {
    DEFAULT_TELEMETRY_PREFS,
    loadTelemetryPrefs,
    saveTelemetryPrefs,
    type TelemetryPrefs,
} from '../../features/telemetryPrefs';
import { syncAnalyticsConsent } from '../../features/analytics';
import { setCrashReportingEnabled } from '../../utils/sentry';
import { alertCenterApi } from '../../api/alertCenter';
import { pondsApi } from '../../api/ponds';
import type { PondContext } from '../../api/pondContext';
import { pushApi } from '../../api/push';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
type ReminderSlot = keyof ReminderTimes;

/** "06:30" — 24-hour, matching formatTime's "how a shift is written on a farm". */
const formatHM = (v: HM) => `${String(v.hour).padStart(2, '0')}:${String(v.minute).padStart(2, '0')}`;

const c = theme.roles.light;

interface LinkRow {
    key: string;
    icon: IconName;
    label: string;
    route: string;
}

export const SettingsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const memberships = useMembershipStore((s) => s.memberships);
    const loadMemberships = useMembershipStore((s) => s.load);

    // ponytail: offlineSync + emailAlerts toggles removed (nothing reads them —
    // offline queueing always runs via saveRecord, and there is no weekly-email
    // feature to switch). pushNotifications is the one toggle with a real effect.
    const [pushNotifications, setPushNotifications] = useState(true);
    const [togglingPush, setTogglingPush] = useState(false);
    // Re-render on language change; i18n.language is read, not stored in state.
    const [, setLanguageTick] = useState(0);

    // The farmer's chosen reminder times (defaults to DEFAULT_REMINDER_TIMES
    // until loadReminderTimes resolves). Pond contexts are fetched once so a
    // picker change can re-arm syncReminders immediately without a second
    // round trip per tap.
    const [reminderTimes, setReminderTimes] = useState<ReminderTimes>(DEFAULT_REMINDER_TIMES);
    const pondContextsRef = useRef<PondContext[]>([]);
    // Ponds, not pond CONTEXTS: `/alert-center/today` only returns ponds with a
    // running crop, so it cannot answer "does this farmer have a pond".
    const hasPondsRef = useRef(false);
    // What the OS actually holds, read back rather than assumed — the whole
    // point of the readout below.
    const [reminderStatus, setReminderStatus] = useState<ReminderStatus | null>(null);
    const refreshReminderStatus = useCallback(() => {
        getReminderStatus().then(setReminderStatus).catch(() => undefined);
    }, []);
    // Which slot's picker sheet is open — null means closed. One shared modal
    // rather than one per row: the four rows already show their current value
    // at a glance, the modal is only needed while actually changing it.
    const [openSlot, setOpenSlot] = useState<ReminderSlot | null>(null);

    // Crash reports (on) and product analytics (off unless granted) — the two
    // switches Privacy Policy section 6 promises. Both take effect the moment
    // they are flipped, not at the next launch.
    const [telemetry, setTelemetry] = useState<TelemetryPrefs>(DEFAULT_TELEMETRY_PREFS);

    const updateTelemetry = useCallback((next: TelemetryPrefs) => {
        setTelemetry(next);
        saveTelemetryPrefs(next)
            .then(() => {
                setCrashReportingEnabled(next.crashReports);
                return syncAnalyticsConsent();
            })
            .catch((e) => console.warn('[Settings] Could not save telemetry preference', e));
    }, []);

    useEffect(() => {
        AsyncStorage.getItem('pushNotifications')
            .then((stored) => {
                if (stored !== null) setPushNotifications(JSON.parse(stored));
            })
            .catch(() => undefined);
        loadReminderTimes().then(setReminderTimes);
        loadTelemetryPrefs().then(setTelemetry).catch(() => undefined);
        alertCenterApi
            .today()
            .then((r) => { pondContextsRef.current = r.data.contexts ?? []; })
            .catch(() => undefined);
        pondsApi
            .getMine()
            .then((r) => { hasPondsRef.current = (r.data?.length ?? 0) > 0; })
            .catch(() => undefined);
    }, []);

    useFocusEffect(refreshReminderStatus);

    const updateReminderTime = useCallback(
        (slot: ReminderSlot, field: keyof HM, value: number) => {
            setReminderTimes((prev) => {
                const next: ReminderTimes = { ...prev, [slot]: { ...prev[slot], [field]: value } };
                saveReminderTimes(next)
                    .then(() =>
                        syncReminders(pondContextsRef.current, next, new Date(), hasPondsRef.current),
                    )
                    .then(refreshReminderStatus)
                    .catch((e) => console.warn('[Settings] Could not re-arm reminders', e));
                return next;
            });
        },
        [refreshReminderStatus],
    );

    useFocusEffect(useCallback(() => { loadMemberships(); }, [loadMemberships]));

    const ownedCount = useMemo(
        () => memberships.filter((m) => m.role === 'owner').length,
        [memberships],
    );

    const displayName = user?.name || user?.email || '';
    const initials = useMemo(() => {
        const words = displayName.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return '?';
        return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
    }, [displayName]);

    const handlePushToggle = async (value: boolean) => {
        setTogglingPush(true);
        try {
            if (value) {
                const token = await registerForPushNotificationsAsync();
                if (!token) {
                    Alert.alert(
                        t('common.error'),
                        t('settings.pushPermissionDenied', 'Push notifications need permission in your device settings.'),
                    );
                    return;
                }
                await pushApi.registerToken(token);
            } else {
                await pushApi.unregister();
            }
            setPushNotifications(value);
            await AsyncStorage.setItem('pushNotifications', JSON.stringify(value));
        } catch {
            Alert.alert(
                t('common.error'),
                t('settings.pushToggleError', 'Could not update push notification setting. Please try again.'),
            );
        } finally {
            setTogglingPush(false);
        }
    };

    const confirmSignOut = () => {
        Alert.alert(t('common.signOut'), t('settings.signOutConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.signOut'), style: 'destructive', onPress: () => logout() },
        ]);
    };

    const tools: LinkRow[] = [
        { key: 'calculators', icon: 'insights', label: t('home.moreCalculators'), route: 'CalculatorHub' },
        { key: 'simulations', icon: 'show_chart', label: t('home.moreSimulations'), route: 'SimulationList' },
        { key: 'diseases', icon: 'science', label: t('home.moreDiseaseEncyclopedia'), route: 'DiseaseList' },
        { key: 'reference', icon: 'assessment', label: t('home.moreReference'), route: 'Reference' },
        { key: 'news', icon: 'receipt_long', label: t('home.moreNews'), route: 'NewsList' },
    ];

    const farmLinks: LinkRow[] = [
        { key: 'workers', icon: 'groups', label: t('home.moreAllWorkers'), route: 'AllWorkers' },
        { key: 'inventory', icon: 'warehouse', label: t('home.moreInventory'), route: 'Inventory' },
        { key: 'feedProducts', icon: 'set_meal', label: t('home.moreFeedProducts'), route: 'FeedProducts' },
        { key: 'shop', icon: 'workspace_premium', label: t('home.moreShop'), route: 'Shop' },
    ];

    // The four reminder slots, paired with their translated labels — a single
    // list so the row and the sheet title always agree on what "morning"
    // etc. means.
    const REMINDER_SLOTS: { slot: ReminderSlot; label: string }[] = [
        { slot: 'morning', label: t('settings.reminderMorning') },
        { slot: 'afternoon', label: t('settings.reminderAfternoon') },
        { slot: 'evening', label: t('settings.reminderEvening') },
        { slot: 'chemistry', label: t('settings.reminderChemistry') },
    ];
    /**
     * "Reminders are on and the next one is at 6:30 tomorrow" vs "reminders are
     * not set up" — read from the OS, never assumed. Every failure in this
     * path used to be swallowed, so both states looked identical here.
     */
    const armed = (reminderStatus?.scheduled ?? 0) > 0 && reminderStatus?.permission === 'granted';
    const blocked = reminderStatus != null && reminderStatus.permission !== 'granted';
    const reminderStatusText = (() => {
        if (!reminderStatus) return null;
        if (blocked) return t('settings.reminderStatusBlocked');
        if (!armed) return t('settings.reminderStatusOff');
        const next = reminderStatus.next;
        if (!next) return t('settings.reminderStatusOn', { when: '' }).trim();
        const time = formatHM({ hour: next.getHours(), minute: next.getMinutes() });
        const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const days = Math.round((midnight(next) - midnight(new Date())) / 86_400_000);
        const when =
            days <= 0
                ? t('settings.reminderWhenToday', { time })
                : days === 1
                    ? t('settings.reminderWhenTomorrow', { time })
                    : t('settings.reminderWhenOn', {
                        time,
                        date: `${String(next.getDate()).padStart(2, '0')}/${String(next.getMonth() + 1).padStart(2, '0')}`,
                    });
        return t('settings.reminderStatusOn', { when });
    })();

    const openSlotLabel = REMINDER_SLOTS.find((s) => s.slot === openSlot)?.label ?? '';
    const openValue = openSlot ? reminderTimes[openSlot] : null;

    // Whole row is the tap target and the value is shown in big tabular-figure
    // type — legible at a glance and obviously editable, without opening
    // anything, on a screen read outdoors.
    const TimeRow: React.FC<{ label: string; slot: ReminderSlot; value: HM }> = ({ label, slot, value }) => (
        <TouchableOpacity
            style={styles.timeRow}
            onPress={() => setOpenSlot(slot)}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${formatHM(value)}`}
        >
            <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.timeValueWrap}>
                <Text style={styles.timeValue}>{formatHM(value)}</Text>
                <Icon name="expand_more" size={20} color={c.textSecondary} />
            </View>
        </TouchableOpacity>
    );

    const Row: React.FC<{ row: LinkRow }> = ({ row }) => (
        <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate(row.route)}
            accessibilityRole="button"
        >
            <Icon name={row.icon} size={22} color={c.textSecondary} />
            <Text style={styles.rowLabel} numberOfLines={1}>
                {row.label}
            </Text>
            <Icon name="chevron_right" size={22} color={c.textDisabled} />
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={displayName ? t('settings.accountEyebrow', { name: displayName }) : null}
                title={t('settings.title')}
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <TouchableOpacity
                    style={styles.identity}
                    onPress={() => navigation.navigate('Profile')}
                    accessibilityRole="button"
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.identityName} numberOfLines={1}>
                            {displayName || t('settings.profile')}
                        </Text>
                        <Text style={styles.identityMeta} numberOfLines={1}>
                            {[
                                // A Truecaller account's "email" is a synthetic
                                // internal address, which authStore already
                                // blanks — showing it here would print a fake
                                // address under the farmer's own name.
                                user?.email || null,
                                ownedCount > 0 ? t('settings.ownerOfFarms', { count: ownedCount }) : null,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                    </View>
                    <Text style={styles.editLink}>{t('settings.edit')}</Text>
                </TouchableOpacity>

                <SectionHeader label={t('settings.language')} />
                <Text style={styles.note}>{t('settings.languageWholeApp')}</Text>
                <View style={styles.langRow}>
                    {LANGUAGES.map((lang) => {
                        const active = i18n.language === lang.code;
                        return (
                            <TouchableOpacity
                                key={lang.code}
                                style={[styles.langPill, active && styles.langPillActive]}
                                onPress={() => i18n.changeLanguage(lang.code).then(() => setLanguageTick((n) => n + 1))}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                            >
                                <Text
                                    style={[styles.langLabel, active && styles.langLabelActive]}
                                    numberOfLines={1}
                                >
                                    {lang.nativeLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <SectionHeader label={t('settings.notifications')} />
                <View style={styles.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowLabel}>{t('settings.pushNotifications')}</Text>
                        <Text style={styles.rowSub}>{t('settings.pushNotificationsDesc')}</Text>
                    </View>
                    <Switch
                        value={pushNotifications}
                        onValueChange={handlePushToggle}
                        disabled={togglingPush}
                        trackColor={{ false: c.borderDefault, true: c.primaryHover }}
                    />
                </View>
                <Row
                    row={{
                        key: 'notifications',
                        icon: 'schedule',
                        label: t('settings.notificationsTitle'),
                        route: 'Notifications',
                    }}
                />

                <SectionHeader label={t('settings.reminderTimes')} />
                <Text style={styles.note}>{t('settings.reminderTimesDesc')}</Text>
                {reminderStatusText != null && (
                    <View
                        style={[styles.reminderStatus, armed ? styles.reminderStatusOk : styles.reminderStatusBad]}
                        accessibilityRole="summary"
                    >
                        <Icon
                            name={armed ? 'check_circle' : 'warning'}
                            size={18}
                            color={armed ? c.successBorder : c.warningBorder}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.reminderStatusText}>{reminderStatusText}</Text>
                            {blocked && (
                                <TouchableOpacity
                                    onPress={() => Linking.openSettings().catch(() => undefined)}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.editLink}>
                                        {t('settings.reminderStatusOpenSettings')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
                {REMINDER_SLOTS.map(({ slot, label }) => (
                    <TimeRow key={slot} label={label} slot={slot} value={reminderTimes[slot]} />
                ))}

                <SectionHeader label={t('settings.security')} />
                <Row row={{ key: '2fa', icon: 'key', label: t('settings.twoFactor'), route: 'TwoFactor' }} />

                {/* Not in p6 — kept so these eleven screens keep an entry point. */}
                <SectionHeader label={t('settings.toolsSection')} />
                {tools.map((row) => (
                    <Row key={row.key} row={row} />
                ))}

                <SectionHeader label={t('settings.farmSection')} />
                {farmLinks.map((row) => (
                    <Row key={row.key} row={row} />
                ))}

                {/*
                  * Privacy — deliberately immediately above "About", so the
                  * two switches sit directly next to the Privacy Policy row
                  * that explains them. Both say what they do in one line; the
                  * analytics switch is off unless the farmer granted it, and
                  * nothing here is pre-ticked on their behalf.
                  */}
                <SectionHeader label={t('settings.privacySection')} />
                <View style={styles.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowLabel}>{t('settings.crashReportsToggle')}</Text>
                        <Text style={styles.rowSub}>{t('settings.crashReportsDesc')}</Text>
                    </View>
                    <Switch
                        value={telemetry.crashReports}
                        onValueChange={(v) => updateTelemetry({ ...telemetry, crashReports: v })}
                        trackColor={{ false: c.borderDefault, true: c.primaryHover }}
                    />
                </View>
                <View style={styles.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowLabel}>{t('settings.analyticsToggle')}</Text>
                        <Text style={styles.rowSub}>{t('settings.analyticsToggleDesc')}</Text>
                    </View>
                    <Switch
                        // 'unasked' and 'declined' both read as OFF. Silence is
                        // never shown to the farmer as a yes.
                        value={telemetry.analytics === 'granted'}
                        onValueChange={(v) =>
                            updateTelemetry({ ...telemetry, analytics: v ? 'granted' : 'declined' })
                        }
                        trackColor={{ false: c.borderDefault, true: c.primaryHover }}
                    />
                </View>

                <SectionHeader label={t('settings.about')} />
                {/* "Is my data saved?" needs an answer that is always reachable,
                    not one that only appears while something is stuck. */}
                <Row row={{ key: 'sync', icon: 'schedule', label: t('sync.title'), route: 'SyncStatus' }} />
                <Row row={{ key: 'help', icon: 'lightbulb', label: t('home.moreHelp'), route: 'Help' }} />
                {/*
                  * Directly under Help & Support, and with a subtitle — this is
                  * the row that has to beat "leave a Play Store review" as the
                  * way a stuck farmer reaches us, so it says what it does
                  * instead of trusting the label to be self-evident.
                  */}
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => navigation.navigate('ReportIssue')}
                    accessibilityRole="button"
                >
                    <Icon name="feedback" size={22} color={c.textSecondary} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>
                            {t('feedback.tileLabel')}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                            {t('feedback.tileSub')}
                        </Text>
                    </View>
                    <Icon name="chevron_right" size={22} color={c.textDisabled} />
                </TouchableOpacity>
                <Row row={{ key: 'privacy', icon: 'badge', label: t('settings.privacyPolicy'), route: 'PrivacyPolicy' }} />
                <Row row={{ key: 'terms', icon: 'badge', label: t('settings.termsOfService'), route: 'Terms' }} />
                <View style={styles.row}>
                    <Text style={[styles.rowLabel, { flex: 1 }]}>{t('common.version')}</Text>
                    <Text style={styles.version}>v1.0.0</Text>
                </View>

                <View style={styles.accountActions}>
                    <TouchableOpacity
                        style={styles.signOutBtn}
                        onPress={confirmSignOut}
                        accessibilityRole="button"
                    >
                        <Text style={styles.signOutLabel}>{t('common.signOut')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => navigation.navigate('DeleteAccount')}
                        accessibilityRole="button"
                    >
                        <Text style={styles.deleteLabel}>{t('settings.deleteAccount')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* One shared sheet for all four slots, in the same tap-a-field/
                bottom-sheet shape as SelectField and CalendarPicker — the
                Picker inside is still @react-native-picker/picker (no new
                dependency; already in the OTA binary), just no longer sitting
                bare on the settings page as two tiny always-open wheels. */}
            <Modal
                visible={openSlot !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setOpenSlot(null)}
            >
                <Pressable style={styles.backdrop} onPress={() => setOpenSlot(null)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{openSlotLabel}</Text>
                            <TouchableOpacity onPress={() => setOpenSlot(null)} hitSlop={8} accessibilityRole="button">
                                <Icon name="close" size={22} color={c.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {openSlot && openValue && (
                            <View style={styles.pickerRow}>
                                <View style={styles.pickerCol}>
                                    <Text style={styles.pickerLabel}>{t('settings.reminderHourLabel')}</Text>
                                    <View style={styles.pickerBox}>
                                        <Picker
                                            selectedValue={openValue.hour}
                                            onValueChange={(v) => updateReminderTime(openSlot, 'hour', Number(v))}
                                        >
                                            {HOURS.map((h) => (
                                                <Picker.Item key={h} label={String(h).padStart(2, '0')} value={h} />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>
                                <Text style={styles.timeSep}>:</Text>
                                <View style={styles.pickerCol}>
                                    <Text style={styles.pickerLabel}>{t('settings.reminderMinuteLabel')}</Text>
                                    <View style={styles.pickerBox}>
                                        <Picker
                                            selectedValue={openValue.minute}
                                            onValueChange={(v) => updateReminderTime(openSlot, 'minute', Number(v))}
                                        >
                                            {MINUTES.map((m) => (
                                                <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>
                            </View>
                        )}

                        <Button title={t('common.done')} onPress={() => setOpenSlot(null)} style={styles.sheetDone} />
                    </Pressable>
                </Pressable>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    identity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
        minHeight: 44,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.sm,
        backgroundColor: c.infoBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { ...theme.typeScale.h3, color: c.infoText },
    identityName: { ...theme.typeScale.h2, color: c.textPrimary },
    identityMeta: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    editLink: { ...theme.typeScale.labelMedium, color: c.textLink },

    note: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    langRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    langPill: {
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 40,
        justifyContent: 'center',
    },
    langPillActive: { borderColor: c.primaryHover, backgroundColor: c.infoBg },
    langLabel: { ...theme.typeScale.labelLarge, color: c.textSecondary },
    langLabelActive: { color: c.infoText },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 48,
    },
    timeValueWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
    timeValue: { ...theme.typeScale.numericMedium, color: c.textPrimary },
    timeSep: { ...theme.typeScale.h2, color: c.textSecondary, marginHorizontal: theme.spacing[1] },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: c.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[8],
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[5],
    },
    sheetTitle: { ...theme.typeScale.h3, color: c.textPrimary },
    pickerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
    pickerCol: { flex: 1, maxWidth: 140 },
    pickerLabel: {
        ...theme.typeScale.labelMedium,
        color: c.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing[2],
    },
    pickerBox: {
        borderWidth: 1,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        backgroundColor: c.surface,
    },
    sheetDone: { alignSelf: 'stretch', marginTop: theme.spacing[6] },
    rowLabel: { ...theme.typeScale.labelLarge, flex: 1, minWidth: 0, color: c.textPrimary },
    rowSub: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    reminderStatus: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        marginHorizontal: theme.spacing[5],
        marginBottom: theme.spacing[2],
        padding: theme.spacing[3],
        borderRadius: theme.radius.sm,
        borderWidth: 1,
    },
    reminderStatusOk: { backgroundColor: c.successBg, borderColor: c.successBorder },
    reminderStatusBad: { backgroundColor: c.warningBg, borderColor: c.warningBorder },
    reminderStatusText: { ...theme.typeScale.bodySmall, color: c.textPrimary },
    version: { fontFamily: 'DMMono-Regular', fontSize: 13, color: c.textTertiary },

    accountActions: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[6],
    },
    signOutBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.borderStrong,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    signOutLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    deleteBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: c.dangerBorder,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    deleteLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.dangerText },
});

export default SettingsScreen;
