import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useMembershipStore } from '../store/membershipStore';
import type { SignupIntent } from '../store/authStore';
import type { FarmRole } from '../api/farmMembers';
import type { CreateFarmDto } from '../api/farms';
import type { ExportDataset } from '../features/export/types';
import { hasChosenLanguage } from '../i18n';
import {
    loadTelemetryPrefs,
    shouldAskAnalyticsConsent,
} from '../features/telemetryPrefs';

// EAGER — only what the app can actually paint on first frame.
//
// Everything else is supplied through `getComponent` below, which `require`s
// the screen module at first navigation instead of at import time. That keeps
// ~110 screen modules (and with them expo-camera, expo-image-picker,
// expo-location, react-native-chart-kit, react-native-qrcode-svg and
// @react-native-google-signin) off the startup path. `getComponent` is
// synchronous, so there is no Suspense boundary and no loading flash.
//
// Kept eager:
//  - MainNavigator: where an authenticated user lands (`MainApp`).
//  - LanguageScreen: the first route of the unauthenticated stack.
//  - WelcomeScreen: one tap after Language, and its assets are shared with it.
import { MainNavigator } from './MainNavigator';
import { LanguageScreen } from '../screens/onboarding/LanguageScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';

export type RootStackParamList = {
    // Auth
    Login: undefined;
    // Carries the intent chosen on artboard 03; optional so a direct arrival
    // (deep link, 'Sign up' from Login) still resolves.
    Register: { intent?: SignupIntent } | undefined;
    ForgotPassword: undefined;
    ResetPassword: undefined;
    // Both carry IntentScreen's answer when the flow began at Register (W2).
    TruecallerLogin: { intent?: SignupIntent } | undefined;
    TruecallerPhone: { intent?: SignupIntent } | undefined;
    OtpLogin: undefined;
    OtpCallback: undefined;
    TwoFactorChallenge: { tempToken: string };
    TwoFactor: undefined;
    DeleteAccount: undefined;
    PrivacyPolicy: undefined;
    Terms: undefined;

    // Main
    MainApp: undefined;
    // Every pond's water quality in one pass (L3).
    MorningRounds: undefined;
    // Asked once, after the account exists and before farm setup (W8).
    AnalyticsConsent: undefined;
    QuickLog: undefined;
    HarvestLog: { pondId: string; pondName: string; cropId?: string };

    // Phase 2
    CreateFarm: { editFarmId?: string } | undefined;
    FarmDetail: { farmId: string; farmName?: string };
    FarmMembers: { farmId: string; farmName?: string };
    MemberDetail: { farmId: string; farmName?: string; member: any };
    AllWorkers: undefined;
    AddWorker: { farmId: string; farmName?: string };
    CreatePond: { farmId: string; farmName?: string; pondCount?: number; editPondId?: string };
    PondDashboard: { pondId: string; pondName?: string };
    PondDimensionHistory: { pondId: string; pondName?: string };
    CycleAnalysis: { cycleId: string; cycleName?: string };
    CreateCycle: { pondId: string };
    CycleDetail: { cycleId: string };
    // Cycle history: per pond (from the dashboard) or per farm (from farm detail).
    CycleList: { pondId?: string; pondName?: string; farmId?: string; farmName?: string } | undefined;

    // The cross-table timeline (GET /activity). No scope = every accessible farm.
    Activity: { farmId?: string; farmName?: string; pondId?: string; pondName?: string } | undefined;

    // Phase 3
    WaterQualityLog: { pondId: string; pondName?: string; cropId?: string };
    FeedLog: { pondId: string; pondName?: string; cropId?: string };
    FeedingTrayChecks: { cropId: string; pondName?: string };
    SamplingLog: { pondId: string; pondName?: string; cropId?: string };
    TreatmentLog: { pondId: string; pondName?: string; cropId?: string };
    MortalityLog: { pondId: string; pondName?: string; cropId?: string };
    ChemicalLog: { pondId: string; pondName?: string; cropId?: string };
    PlanktonLog: { pondId: string; pondName?: string; cropId?: string };
    MicrobiologyLog: { pondId: string; pondName?: string; cropId?: string };
    DiseaseLog: { pondId: string; pondName?: string; cropId?: string };

    // Phase 4
    CalculatorHub: undefined;
    CultivationPerformance: undefined;
    DailyFeedCalculator: undefined;
    ProductAmount: undefined;
    FreeAmmonia: undefined;

    SimulationList: undefined;
    SimulationCreate: undefined;
    SimulationResults: { simulationId?: string; resultData?: any };

    // Phase 5 (History & Polish)
    WaterQualityHistory: { pondId: string; pondName?: string; cropId?: string };
    FeedHistory: { pondId: string; pondName?: string; cropId?: string };
    SamplingHistory: { pondId: string; pondName?: string; cropId?: string };
    TreatmentHistory: { pondId: string; pondName?: string; cropId?: string };
    HarvestHistory: { pondId: string; cycleId?: string; cropId?: string };
    ChemicalHistory: { pondId: string; cropId?: string };
    PlanktonHistory: { pondId: string; cropId?: string };
    MicrobiologyHistory: { pondId: string; cropId?: string };
    DiseaseHistory: { pondId: string; cropId?: string };
    MortalityHistory: { pondId: string; cropId?: string };

    // Measurement pipeline (PRD §6.2 keystone)
    Measurements: { pondId: string; pondName?: string; cropId?: string };

    // Decision engines (PRD P2)
    WeeklyChemistry: { pondId: string; pondName?: string };
    WeeklyChemistryHistory: { pondId: string; pondName?: string; cropId?: string };
    DailyRoutine: { pondId: string; pondName?: string; cropId?: string };
    EnginesHub: { pondId?: string; pondName?: string; cropId?: string };
    FeedAdvisor: { pondId?: string; pondName?: string; cropId?: string };
    HarvestTiming: { pondId?: string; pondName?: string; cropId?: string };
    DiseaseRisk: { pondId?: string; pondName?: string; cropId?: string };
    Aeration: { pondId?: string; pondName?: string; cropId?: string };
    Lunar: { pondId?: string; pondName?: string; cropId?: string };
    CropPnl: { pondId?: string; pondName?: string; cropId?: string };
    MorningBriefing: undefined;

    Profile: undefined;
    Notifications: undefined;
    Help: undefined;
    ReportIssue: undefined;
    SyncStatus: undefined;
    FeedbackDetail: { id: string };
    About: undefined;
    Inventory: undefined;
    InventoryDetail: { inventoryId: string; itemName?: string };
    // Create (no itemId) and edit (itemId) share one form, so the category
    // chips, unit dropdown and icon picker cannot drift between them (D4).
    InventoryForm: { farmId?: string; itemId?: string } | undefined;

    // Disease Encyclopedia
    DiseaseList: undefined;
    DiseaseDetail: { diseaseId: string };
    Diagnose: { pondId?: string; pondName?: string; cropId?: string } | undefined;

    // Tasks
    TaskList: { farmId: string; farmName?: string };
    TaskCompose: { farmId: string; farmName?: string; scope?: 'farm' | 'personal' };
    RecurringTasks: { farmId: string; farmName?: string };

    // Leave requests
    LeaveRequests: { farmId: string; farmName?: string };

    // Attendance
    Attendance: { farmId: string; farmName?: string };
    AttendanceLog: { farmId: string; farmName?: string };

    // News / eShop / Reference
    NewsList: undefined;
    NewsDetail: { id: string };
    Shop: undefined;
    Reference: undefined;

    // Finance
    Expenses: { cropId: string; pondName?: string };
    Transactions: { farmId: string; farmName?: string };

    // Harvest planning
    HarvestPlans: { pondId: string; pondName?: string; cropId?: string; farmId?: string };

    // First-run onboarding (docs/design/onboarding/*)
    Language: undefined;
    Welcome: undefined;
    Intent: undefined;
    PondSetup: { farmId: string; totalPonds: number };
    PondNames: { farm: CreateFarmDto; pondCount: number };
    // code: from the upcheckapp://join/<CODE> deep link (linking.ts).
    JoinFarm: { code?: string } | undefined;
    JoinedFarm: { farmName: string; role: FarmRole; status: 'active' | 'pending' };

    // Additional calculators + feed products
    GrowthAndHarvest: undefined;
    FeedProducts: undefined;
    FeedStats: { pondId: string; pondName?: string; cropId?: string; farmId?: string };

    // One configurable export flow. Every param is a PRE-FILL of a control the
    // farmer can still change — arriving from a cycle preselects that cycle,
    // arriving from Settings preselects nothing.
    Export: { dataset?: ExportDataset; farmId?: string; pondId?: string; cropId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Where the app opens. Pure, exported and tested, because the last version of
 * this rule ENDED IN `undefined` and nobody could see what that meant.
 *
 * React Navigation treats an undefined `initialRouteName` as "the first
 * registered screen", and the first screen in the signed-out stack is
 * `Language`. So the branch that was supposed to mean "everyone else starts on
 * the main app / login" silently meant "start on the language picker": anyone
 * who logged out, or whose refresh token was revoked (which routes through
 * `clearSession()`), reopened the app at a language question and had to walk
 * Language → Welcome → "Skip for now" → Login to reach a form they had used a
 * hundred times. Every branch is explicit now, and none of them is a fallthrough.
 *
 * Order matters and encodes the product decisions:
 *  1. Consent first once an account exists (W8/D2) — asked before farm setup so
 *     the setup funnel itself is measurable.
 *  2. Then first-run setup, owner or worker.
 *  3. Then the app.
 *  4. Signed out: the language picker on a first run, the login screen after.
 */
export const initialRouteFor = (s: {
    isAuthenticated: boolean;
    needsConsent: boolean;
    pendingFarmSetup: boolean;
    pendingFarmJoin: boolean;
    needsLanguage: boolean;
}): keyof RootStackParamList => {
    if (s.isAuthenticated) {
        if (s.needsConsent) return 'AnalyticsConsent';
        if (s.pendingFarmSetup) return 'CreateFarm';
        if (s.pendingFarmJoin) return 'JoinFarm';
        return 'MainApp';
    }
    return s.needsLanguage ? 'Language' : 'Login';
};

const RootNavigator = () => {
    // One selector per field, deliberately. Subscribing to the whole store made
    // every auth write (error text, per-request isLoading) re-render — and with
    // the spinner below that meant UNMOUNTING the navigator and losing all
    // navigation state on a failed login.
    const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const pendingFarmSetup = useAuthStore((s) => s.pendingFarmSetup);
    const pendingFarmJoin = useAuthStore((s) => s.pendingFarmJoin);
    const initialize = useAuthStore((s) => s.initialize);
    const loadMemberships = useMembershipStore((s) => s.load);
    const resetMemberships = useMembershipStore((s) => s.reset);

    useEffect(() => {
        initialize();
    }, []);

    // The first run opens on the language screen (artboard 01) — before the
    // welcome copy, so nobody reads three value propositions in a language they
    // did not pick. null = still reading the stored preference; hold the splash
    // rather than flash Login and then replace it.
    const [needsLanguage, setNeedsLanguage] = useState<boolean | null>(null);
    useEffect(() => {
        hasChosenLanguage().then((chosen) => setNeedsLanguage(!chosen));
    }, []);

    /**
     * Whether the farmer still owes us an answer on product analytics (W8).
     *
     * Seventeen events are wired and the ONLY place to grant consent is a
     * Settings toggle nobody is prompted to open — so in production the
     * activation funnel is dark for effectively every user, and every decision
     * about it ships on judgement with no way to tell whether it worked.
     * "Never ask" is not the same as privacy-first.
     *
     * Asked once, after the account exists and before farm setup, so the setup
     * funnel itself is measurable. `null` = still reading; hold the splash
     * rather than flash a screen and replace it, exactly as `needsLanguage`
     * does. A decline is permanent (see telemetryPrefs) — this never re-asks.
     */
    const [needsConsent, setNeedsConsent] = useState<boolean | null>(null);
    const refreshConsentGate = useCallback(() => {
        loadTelemetryPrefs()
            .then((p) => setNeedsConsent(shouldAskAnalyticsConsent(p)))
            // Unreadable storage must not strand anyone on a consent screen.
            .catch(() => setNeedsConsent(false));
    }, []);
    useEffect(refreshConsentGate, [refreshConsentGate]);

    // Load the user's farm memberships once authenticated so usePermissions()
    // resolves correctly on every screen; clear them on logout.
    useEffect(() => {
        if (isAuthenticated) loadMemberships();
        else resetMemberships();
    }, [isAuthenticated, loadMemberships, resetMemberships]);

    // ONLY startup may hold the splash. An in-flight login/signup must not, or
    // the navigator unmounts and the error message arrives at the first
    // onboarding screen instead of the screen the farmer was typing into.
    if (isBootstrapping || needsLanguage === null || needsConsent === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.roles.light.background }}>
                <ActivityIndicator size="large" color={theme.roles.light.primary} />
            </View>
        );
    }

    return (
        <Stack.Navigator
            /**
             * The consent ask comes FIRST once there is an account (W8/D2) —
             * before farm setup, so the setup funnel itself is measurable.
             * Then owners land on Create-Farm and workers on Join-Farm; a
             * signed-out farmer gets the language picker on first run and the
             * login screen every time after.
             *
             * Every branch is explicit, and the last one especially (W3). It
             * used to be `: undefined`, which makes React Navigation fall back
             * to the FIRST REGISTERED SCREEN — and the first screen in the
             * signed-out stack is `Language`. So the branch was dead: anyone
             * who logged out, or whose refresh token was revoked (which routes
             * through `clearSession()`), reopened the app at the language
             * picker and had to walk Language → Welcome → "Skip for now" →
             * Login to get back to a form they had used a hundred times.
             */
            initialRouteName={initialRouteFor({
                isAuthenticated,
                needsConsent,
                pendingFarmSetup,
                pendingFarmJoin,
                needsLanguage,
            })}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: theme.roles.light.background },
            }}
        >
            {!isAuthenticated ? (
                <>
                    {/* First-run flow, in order: language → welcome → intent →
                        create account. Registered before Login so the stack reads
                        the way the farmer walks it. */}
                    <Stack.Screen name="Language" component={LanguageScreen} />
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />
                    <Stack.Screen name="Intent" getComponent={() => require('../screens/onboarding/IntentScreen').IntentScreen} />
                    <Stack.Screen name="Login" getComponent={() => require('../screens/auth/LoginScreen').LoginScreen} />
                    <Stack.Screen name="Register" getComponent={() => require('../screens/auth/RegisterScreen').RegisterScreen} />
                    <Stack.Screen
                        name="ForgotPassword"
                        getComponent={() => require('../screens/auth/ForgotPasswordScreen').ForgotPasswordScreen}
                        options={{ headerShown: true, title: 'Forgot Password', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen name="ResetPassword" getComponent={() => require('../screens/auth/ResetPasswordScreen').ResetPasswordScreen} />
                    <Stack.Screen
                        name="TruecallerLogin"
                        getComponent={() => require('../screens/auth/TruecallerLoginScreen').TruecallerLoginScreen}
                        options={{ headerShown: true, title: 'Sign in with Truecaller', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen
                        name="TruecallerPhone"
                        getComponent={() => require('../screens/auth/TruecallerPhoneScreen').TruecallerPhoneScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen name="OtpLogin" getComponent={() => require('../screens/auth/OtpLoginScreen').OtpLoginScreen} />
                    <Stack.Screen name="OtpCallback" getComponent={() => require('../screens/auth/OtpCallbackScreen').OtpCallbackScreen} />
                    <Stack.Screen name="TwoFactorChallenge" getComponent={() => require('../screens/auth/TwoFactorChallengeScreen').TwoFactorChallengeScreen} />
                    {/* Legal — reachable pre-auth from the Register consent line */}
                    <Stack.Screen name="PrivacyPolicy" getComponent={() => require('../screens/legal/PrivacyPolicyScreen').PrivacyPolicyScreen} />
                    <Stack.Screen name="Terms" getComponent={() => require('../screens/legal/TermsScreen').TermsScreen} />
                </>
            ) : (
                <>
                    <Stack.Screen name="MainApp" component={MainNavigator} />
                    <Stack.Screen name="AnalyticsConsent" getComponent={() => require('../screens/onboarding/AnalyticsConsentScreen').AnalyticsConsentScreen} />
                    <Stack.Screen name="QuickLog" getComponent={() => require('../screens/main/QuickLogScreen').QuickLogScreen} options={{ presentation: 'modal' }} />
                    <Stack.Screen name="MorningRounds" getComponent={() => require('../screens/logs/MorningRoundsScreen').MorningRoundsScreen} />

                    <Stack.Screen name="CreateFarm" getComponent={() => require('../screens/farms/CreateFarmScreen').CreateFarmScreen} />
                    <Stack.Screen name="PondNames" getComponent={() => require('../screens/onboarding/PondNamesScreen').PondNamesScreen} />
                    <Stack.Screen name="PondSetup" getComponent={() => require('../screens/onboarding/PondSetupScreen').PondSetupScreen} />
                    <Stack.Screen name="JoinFarm" getComponent={() => require('../screens/onboarding/JoinFarmScreen').JoinFarmScreen} />
                    <Stack.Screen name="JoinedFarm" getComponent={() => require('../screens/onboarding/JoinedFarmScreen').JoinedFarmScreen} />
                    <Stack.Screen name="FarmDetail" getComponent={() => require('../screens/farms/FarmDetailScreen').FarmDetailScreen} />
                    <Stack.Screen name="FarmMembers" getComponent={() => require('../screens/farms/FarmMembersScreen').FarmMembersScreen} />

                    <Stack.Screen name="MemberDetail" getComponent={() => require('../screens/farms/MemberDetailScreen').MemberDetailScreen} />
                    <Stack.Screen name="AllWorkers" getComponent={() => require('../screens/farms/AllWorkersScreen').AllWorkersScreen} />
                    <Stack.Screen name="AddWorker" getComponent={() => require('../screens/farms/AddWorkerScreen').AddWorkerScreen} />
                    <Stack.Screen name="CreatePond" getComponent={() => require('../screens/ponds/CreatePondScreen').CreatePondScreen} />
                    <Stack.Screen name="PondDashboard" getComponent={() => require('../screens/ponds/PondDashboardScreen').PondDashboardScreen} />
                    <Stack.Screen name="CreateCycle" getComponent={() => require('../screens/cycles/CreateCycleScreen').CreateCycleScreen} />
                    <Stack.Screen name="CycleDetail" getComponent={() => require('../screens/cycles/CycleDetailScreen').CycleDetailScreen} />
                    <Stack.Screen name="CycleList" getComponent={() => require('../screens/cycles/CycleListScreen').CycleListScreen} />
                    {/* The cross-table timeline. Renders its own ScreenHeader,
                        same as AttendanceLog. */}
                    <Stack.Screen name="Activity" getComponent={() => require('../screens/activity/ActivityScreen').ActivityScreen} />
                    <Stack.Screen name="PondDimensionHistory" getComponent={() => require('../screens/ponds/PondDimensionHistoryScreen').PondDimensionHistoryScreen} />
                    <Stack.Screen name="CycleAnalysis" getComponent={() => require('../screens/reports/CycleAnalysisScreen').CycleAnalysisScreen} />

                    <Stack.Screen name="WaterQualityLog" getComponent={() => require('../screens/logs/WaterQualityLogScreen').WaterQualityLogScreen} />
                    <Stack.Screen name="FeedLog" getComponent={() => require('../screens/logs/FeedLogScreen').FeedLogScreen} />
                    <Stack.Screen name="FeedingTrayChecks" getComponent={() => require('../screens/logs/FeedingTrayChecksScreen').FeedingTrayChecksScreen} />
                    <Stack.Screen name="SamplingLog" getComponent={() => require('../screens/logs/SamplingLogScreen').SamplingLogScreen} />
                    <Stack.Screen name="TreatmentLog" getComponent={() => require('../screens/logs/TreatmentLogScreen').TreatmentLogScreen} />
                    <Stack.Screen name="HarvestLog" getComponent={() => require('../screens/logs/HarvestLogScreen').HarvestLogScreen} />
                    <Stack.Screen name="MortalityLog" getComponent={() => require('../screens/logs/MortalityLogScreen').MortalityLogScreen} />
                    <Stack.Screen name="ChemicalLog" getComponent={() => require('../screens/logs/ChemicalLogScreen').ChemicalLogScreen} />
                    <Stack.Screen name="PlanktonLog" getComponent={() => require('../screens/logs/PlanktonLogScreen').PlanktonLogScreen} />
                    <Stack.Screen name="MicrobiologyLog" getComponent={() => require('../screens/logs/MicrobiologyLogScreen').MicrobiologyLogScreen} />
                    <Stack.Screen name="DiseaseLog" getComponent={() => require('../screens/logs/DiseaseLogScreen').DiseaseLogScreen} />

                    {/* Phase 4 */}
                    <Stack.Screen name="CalculatorHub" getComponent={() => require('../screens/calculators/CalculatorHubScreen').CalculatorHubScreen} />
                    <Stack.Screen name="CultivationPerformance" getComponent={() => require('../screens/calculators/CultivationPerformanceScreen').CultivationPerformanceScreen} />
                    <Stack.Screen name="DailyFeedCalculator" getComponent={() => require('../screens/calculators/DailyFeedCalculatorScreen').DailyFeedCalculatorScreen} />
                    <Stack.Screen name="ProductAmount" getComponent={() => require('../screens/calculators/ProductAmountScreen').ProductAmountScreen} />
                    <Stack.Screen name="FreeAmmonia" getComponent={() => require('../screens/calculators/FreeAmmoniaScreen').FreeAmmoniaScreen} />

                    <Stack.Screen name="SimulationList" getComponent={() => require('../screens/simulation/SimulationListScreen').SimulationListScreen} />
                    <Stack.Screen name="SimulationCreate" getComponent={() => require('../screens/simulation/SimulationCreateScreen').SimulationCreateScreen} />
                    <Stack.Screen name="SimulationResults" getComponent={() => require('../screens/simulation/SimulationResultsScreen').SimulationResultsScreen} />

                    {/* Phase 5 (History) */}
                    <Stack.Screen name="WaterQualityHistory" getComponent={() => require('../screens/logs/History/WaterQualityHistoryScreen').WaterQualityHistoryScreen} />
                    <Stack.Screen name="FeedHistory" getComponent={() => require('../screens/logs/History/FeedHistoryScreen').FeedHistoryScreen} />
                    <Stack.Screen name="SamplingHistory" getComponent={() => require('../screens/logs/History/SamplingHistoryScreen').SamplingHistoryScreen} />
                    <Stack.Screen name="TreatmentHistory" getComponent={() => require('../screens/logs/History/TreatmentHistoryScreen').TreatmentHistoryScreen} />
                    <Stack.Screen name="HarvestHistory" getComponent={() => require('../screens/logs/History/HarvestHistoryScreen').HarvestHistoryScreen} />
                    <Stack.Screen name="ChemicalHistory" getComponent={() => require('../screens/logs/History/ChemicalHistoryScreen').ChemicalHistoryScreen} />
                    <Stack.Screen name="PlanktonHistory" getComponent={() => require('../screens/logs/History/PlanktonHistoryScreen').PlanktonHistoryScreen} />
                    <Stack.Screen name="MicrobiologyHistory" getComponent={() => require('../screens/logs/History/MicrobiologyHistoryScreen').MicrobiologyHistoryScreen} />
                    <Stack.Screen name="DiseaseHistory" getComponent={() => require('../screens/logs/History/DiseaseHistoryScreen').DiseaseHistoryScreen} />
                    <Stack.Screen name="MortalityHistory" getComponent={() => require('../screens/logs/History/MortalityHistoryScreen').MortalityHistoryScreen} />
                    <Stack.Screen
                        name="Measurements"
                        getComponent={() => require('../screens/measurements/MeasurementsScreen').MeasurementsScreen}
                        options={{ headerShown: true, title: 'Measurements', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen name="DailyRoutine" getComponent={() => require('../screens/engines/DailyRoutineScreen').DailyRoutineScreen} options={{ headerShown: true, title: 'Daily Routine', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="WeeklyChemistry" getComponent={() => require('../screens/logs/WeeklyChemistryScreen').WeeklyChemistryScreen} options={{ headerShown: true, title: 'Weekly Chemistry', headerTintColor: theme.roles.light.primary }} />
                    {/* Own back header, matching WaterQualityHistoryScreen. */}
                    <Stack.Screen name="WeeklyChemistryHistory" getComponent={() => require('../screens/logs/History/WeeklyChemistryHistoryScreen').WeeklyChemistryHistoryScreen} options={{ headerShown: false }} />
                    <Stack.Screen name="EnginesHub" getComponent={() => require('../screens/engines/EnginesHubScreen').EnginesHubScreen} options={{ headerShown: true, title: 'Decision Engines', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="FeedAdvisor" getComponent={() => require('../screens/engines/FeedAdvisorScreen').FeedAdvisorScreen} options={{ headerShown: true, title: 'Feed Advisor', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="HarvestTiming" getComponent={() => require('../screens/engines/HarvestTimingScreen').HarvestTimingScreen} options={{ headerShown: true, title: 'Harvest Timing', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="DiseaseRisk" getComponent={() => require('../screens/engines/DiseaseRiskScreen').DiseaseRiskScreen} options={{ headerShown: true, title: 'Disease Early-Warning', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="Aeration" getComponent={() => require('../screens/engines/AerationScreen').AerationScreen} options={{ headerShown: true, title: 'Aeration & Power', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="Lunar" getComponent={() => require('../screens/engines/LunarScreen').LunarScreen} options={{ headerShown: true, title: 'Lunar Molt', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="CropPnl" getComponent={() => require('../screens/engines/CropPnlScreen').CropPnlScreen} options={{ headerShown: true, title: 'Crop P&L', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="MorningBriefing" getComponent={() => require('../screens/engines/MorningBriefingScreen').MorningBriefingScreen} options={{ headerShown: true, title: 'Morning Briefing', headerTintColor: theme.roles.light.primary }} />

                    {/* Phase 5 (Settings & Notifications) */}
                    <Stack.Screen name="Profile" getComponent={() => require('../screens/settings/ProfileScreen').ProfileScreen} />
                    <Stack.Screen name="DeleteAccount" getComponent={() => require('../screens/settings/DeleteAccountScreen').DeleteAccountScreen} />
                    <Stack.Screen name="Notifications" getComponent={() => require('../screens/notifications/NotificationsScreen').NotificationsScreen} />
                    <Stack.Screen name="Help" getComponent={() => require('../screens/settings/HelpScreen').HelpScreen} />
                    <Stack.Screen name="ReportIssue" getComponent={() => require('../screens/settings/ReportIssueScreen').ReportIssueScreen} />
                    <Stack.Screen name="SyncStatus" getComponent={() => require('../screens/settings/SyncStatusScreen').SyncStatusScreen} />
                    <Stack.Screen name="FeedbackDetail" getComponent={() => require('../screens/settings/FeedbackDetailScreen').FeedbackDetailScreen} />
                    <Stack.Screen name="About" getComponent={() => require('../screens/settings/AboutScreen').AboutScreen} />
                    <Stack.Screen name="Inventory" getComponent={() => require('../screens/inventory/InventoryListScreen').InventoryListScreen} />
                    <Stack.Screen name="InventoryDetail" getComponent={() => require('../screens/inventory/InventoryDetailScreen').InventoryDetailScreen} />
                    {/* One screen for create AND edit, so the category chips,
                        unit list and icon picker cannot drift apart (D4). */}
                    <Stack.Screen name="InventoryForm" getComponent={() => require('../screens/inventory/InventoryFormScreen').InventoryFormScreen} options={{ headerShown: false }} />

                    {/* Disease Encyclopedia */}
                    <Stack.Screen name="DiseaseList" getComponent={() => require('../screens/diseases/DiseaseListScreen').DiseaseListScreen} />
                    <Stack.Screen name="DiseaseDetail" getComponent={() => require('../screens/diseases/DiseaseDetailScreen').DiseaseDetailScreen} />
                    <Stack.Screen name="Diagnose" getComponent={() => require('../screens/diseases/DiagnoseScreen').DiagnoseScreen} />

                    {/* Tasks */}
                    <Stack.Screen name="TaskList" getComponent={() => require('../screens/tasks/TaskListScreen').TaskListScreen} />
                    <Stack.Screen name="TaskCompose" getComponent={() => require('../screens/tasks/TaskComposerScreen').TaskComposerScreen} />
                    <Stack.Screen name="RecurringTasks" getComponent={() => require('../screens/tasks/RecurringTasksScreen').RecurringTasksScreen} />
                    <Stack.Screen name="LeaveRequests" getComponent={() => require('../screens/leave/LeaveRequestsScreen').LeaveRequestsScreen} />
                    <Stack.Screen name="Attendance" getComponent={() => require('../screens/attendance/AttendanceScreen').AttendanceScreen} />
                    <Stack.Screen name="AttendanceLog" getComponent={() => require('../screens/attendance/AttendanceLogScreen').AttendanceLogScreen} />

                    {/* News / eShop / Reference */}
                    <Stack.Screen name="NewsList" getComponent={() => require('../screens/news/NewsListScreen').NewsListScreen} />
                    <Stack.Screen name="NewsDetail" getComponent={() => require('../screens/news/NewsDetailScreen').NewsDetailScreen} />
                    <Stack.Screen name="Shop" getComponent={() => require('../screens/shop/ShopScreen').ShopScreen} />
                    <Stack.Screen name="Reference" getComponent={() => require('../screens/reference/ReferenceScreen').ReferenceScreen} />

                    {/* Finance */}
                    <Stack.Screen name="Expenses" getComponent={() => require('../screens/finance/ExpensesScreen').ExpensesScreen} />
                    <Stack.Screen name="Transactions" getComponent={() => require('../screens/finance/TransactionsScreen').TransactionsScreen} />

                    {/* Harvest planning */}
                    <Stack.Screen name="HarvestPlans" getComponent={() => require('../screens/harvest/HarvestPlansScreen').HarvestPlansScreen} />

                    {/* Security */}
                    <Stack.Screen name="TwoFactor" getComponent={() => require('../screens/settings/TwoFactorScreen').TwoFactorScreen} />
                    {/* DEEPLINK-1: the reset link must open even when a session
                        already exists, so ResetPassword is reachable from the
                        authenticated stack too — and TwoFactorChallenge so the
                        AUTH-2 reset→2FA hand-off can complete from here. */}
                    <Stack.Screen name="ResetPassword" getComponent={() => require('../screens/auth/ResetPasswordScreen').ResetPasswordScreen} />
                    <Stack.Screen name="OtpCallback" getComponent={() => require('../screens/auth/OtpCallbackScreen').OtpCallbackScreen} />
                    <Stack.Screen name="TwoFactorChallenge" getComponent={() => require('../screens/auth/TwoFactorChallengeScreen').TwoFactorChallengeScreen} />

                    {/* Additional calculators + feed products */}
                    <Stack.Screen name="GrowthAndHarvest" getComponent={() => require('../screens/calculators/GrowthAndHarvestScreen').GrowthAndHarvestScreen} />
                    <Stack.Screen name="FeedProducts" getComponent={() => require('../screens/feedProducts/FeedProductsScreen').FeedProductsScreen} />
                    <Stack.Screen
                        name="FeedStats"
                        getComponent={() => require('../screens/feed/FeedStatsScreen').FeedStatsScreen}
                        options={{ headerShown: true, title: 'Feed Statistics', headerTintColor: theme.roles.light.primary }}
                    />

                    {/* Export — reachable from the cycle report and from Settings */}
                    <Stack.Screen name="Export" getComponent={() => require('../screens/export/ExportScreen').ExportScreen} />

                    {/* Legal */}
                    <Stack.Screen name="PrivacyPolicy" getComponent={() => require('../screens/legal/PrivacyPolicyScreen').PrivacyPolicyScreen} />
                    <Stack.Screen name="Terms" getComponent={() => require('../screens/legal/TermsScreen').TermsScreen} />
                </>
            )}
        </Stack.Navigator>
    );
};

export default RootNavigator;
