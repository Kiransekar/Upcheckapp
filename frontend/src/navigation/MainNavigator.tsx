import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Icon } from '../components/ui/Icon';
import { usePermissions } from '../hooks/usePermissions';

// Import screens
import { HomeScreen } from '../screens/main/HomeScreen';
import { FarmsListScreen } from '../screens/farms/FarmsListScreen';
import { ReportsScreen } from '../screens/main/ReportsScreen';
import { MoreScreen } from '../screens/main/MoreScreen';
import { TeamScreen } from '../screens/main/TeamScreen';
import { TransactionsScreen } from '../screens/finance/TransactionsScreen';

const Tab = createBottomTabNavigator();

/** Placeholder for the center "+" slot — never rendered (the button opens the
 *  Quick Log modal instead of switching tabs). */
const NoopScreen = () => null;

/** Elevated center action button — one-tap entry to the daily logging flow. */
const QuickLogButton = () => {
    const navigation = useNavigation<any>();
    const perms = usePermissions();
    // Viewers are read-only — hide the logging entry. When no farm context is
    // resolved yet (role null), keep it visible; the Quick Log screen and the
    // backend both guard writes anyway.
    if (perms.role && !perms.canRecordData) {
        return <View style={styles.centerSlot} pointerEvents="none" />;
    }
    return (
        <View style={styles.centerSlot} pointerEvents="box-none">
            <TouchableOpacity
                activeOpacity={0.85}
                accessibilityLabel="Quick log"
                onPress={() => navigation.navigate('QuickLog')}
                style={styles.centerTouch}
            >
                <LinearGradient
                    colors={theme.gradients.brand.colors as [string, string, ...string[]]}
                    start={theme.gradients.brand.start}
                    end={theme.gradients.brand.end}
                    style={styles.centerFab}
                >
                    <Icon name="edit_note" size={28} color={theme.roles.light.textInverse} />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

export const MainNavigator = () => {
    const { t } = useTranslation();
    // The tab set is CAPABILITY-DRIVEN, not account-driven. The design shows
    // six tabs for an owner and the same five minus Money for a worker, and
    // Money is exactly VIEW_FINANCIALS — so the nav derives from the same
    // matrix the backend enforces rather than from any global account flag.
    // Hidden, not disabled: a tab a worker may not open should not be there.
    const perms = usePermissions();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.tokens.tabBar.activeColor,
                tabBarInactiveTintColor: theme.tokens.tabBar.inactiveColor,
                tabBarStyle: {
                    backgroundColor: theme.roles.light.surface,
                    borderTopWidth: 1,
                    borderTopColor: theme.roles.light.borderDefault,
                    paddingTop: 8,
                    paddingBottom: 8,
                    height: 64,
                    ...theme.shadows.md,
                },
                tabBarLabelStyle: {
                    fontFamily: theme.tokens.tabBar.labelFontFamily,
                    fontSize: theme.tokens.tabBar.labelFontSize,
                },
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{
                    tabBarLabel: t('common.tabToday'),
                    tabBarIcon: ({ color }) => <Icon name="flag" color={color} size={22} />,
                }}
            />
            <Tab.Screen
                name="Farms"
                component={FarmsListScreen}
                options={{
                    tabBarLabel: t('common.tabFarm'),
                    tabBarIcon: ({ color }) => <Icon name="grid_view" color={color} size={22} />,
                }}
            />
            {/* Center quick-log action — opens the Quick Log modal, never a tab. */}
            <Tab.Screen
                name="QuickLogTab"
                component={NoopScreen}
                options={{
                    tabBarLabel: () => null,
                    tabBarButton: () => <QuickLogButton />,
                }}
                listeners={{ tabPress: (e) => e.preventDefault() }}
            />
            {/* Money is VIEW_FINANCIALS. A worker or viewer simply does not
                have this tab — the design shows their nav as the same set
                minus this one. */}
            {perms.canViewFinancials && (
                <Tab.Screen
                    name="Money"
                    component={TransactionsScreen}
                    options={{
                        tabBarLabel: t('common.tabMoney'),
                        tabBarIcon: ({ color }) => <Icon name="currency_rupee" color={color} size={22} />,
                    }}
                />
            )}
            <Tab.Screen
                name="Team"
                component={TeamScreen}
                options={{
                    tabBarLabel: t('common.tabTeam'),
                    tabBarIcon: ({ color }) => <Icon name="groups" color={color} size={22} />,
                }}
            />
            <Tab.Screen
                name="More"
                component={MoreScreen}
                options={{
                    tabBarLabel: t('common.tabSettings'),
                    tabBarIcon: ({ color }) => <Icon name="settings" color={color} size={22} />,
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    centerSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    centerTouch: {
        // Lift the FAB above the tab bar so it reads as the primary action.
        top: -18,
    },
    centerFab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: theme.roles.light.surface,
        ...theme.shadows.brandGlow,
    },
});
