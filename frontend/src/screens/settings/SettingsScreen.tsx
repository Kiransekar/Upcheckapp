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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import i18n from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon, type IconName } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import { pushApi } from '../../api/push';
import { useAuthStore } from '../../store/authStore';
import { useMembershipStore } from '../../store/membershipStore';

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

    useEffect(() => {
        AsyncStorage.getItem('pushNotifications')
            .then((stored) => {
                if (stored !== null) setPushNotifications(JSON.parse(stored));
            })
            .catch(() => undefined);
    }, []);

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
    rowLabel: { ...theme.typeScale.labelLarge, flex: 1, minWidth: 0, color: c.textPrimary },
    rowSub: { ...theme.typeScale.bodySmall, color: c.textTertiary },
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
