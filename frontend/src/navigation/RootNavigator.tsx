import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useMembershipStore } from '../store/membershipStore';
import type { SignupIntent } from '../store/authStore';
import type { FarmRole } from '../api/farmMembers';
import type { CreateFarmDto } from '../api/farms';
import { hasChosenLanguage } from '../i18n';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { TruecallerLoginScreen } from '../screens/auth/TruecallerLoginScreen';
import { TruecallerPhoneScreen } from '../screens/auth/TruecallerPhoneScreen';

// Main Navigation
import { MainNavigator } from './MainNavigator';
import { QuickLogScreen } from '../screens/main/QuickLogScreen';

// Phase 2 Screens
import { CreateFarmScreen } from '../screens/farms/CreateFarmScreen';
import { FarmDetailScreen } from '../screens/farms/FarmDetailScreen';
import { FarmMembersScreen } from '../screens/farms/FarmMembersScreen';
import { MemberDetailScreen } from '../screens/farms/MemberDetailScreen';
import { AllWorkersScreen } from '../screens/farms/AllWorkersScreen';
import { AddWorkerScreen } from '../screens/farms/AddWorkerScreen';
import { CreatePondScreen } from '../screens/ponds/CreatePondScreen';
import { PondDashboardScreen } from '../screens/ponds/PondDashboardScreen';
import { CreateCycleScreen } from '../screens/cycles/CreateCycleScreen';
import { CycleDetailScreen } from '../screens/cycles/CycleDetailScreen';
import { PondDimensionHistoryScreen } from '../screens/ponds/PondDimensionHistoryScreen';
import { CycleAnalysisScreen } from '../screens/reports/CycleAnalysisScreen';

// Phase 3 Screens (Logs)
import { WaterQualityLogScreen } from '../screens/logs/WaterQualityLogScreen';
import { FeedLogScreen } from '../screens/logs/FeedLogScreen';
import { FeedingTrayChecksScreen } from '../screens/logs/FeedingTrayChecksScreen';
import { SamplingLogScreen } from '../screens/logs/SamplingLogScreen';
import { TreatmentLogScreen } from '../screens/logs/TreatmentLogScreen';
import { HarvestLogScreen } from '../screens/logs/HarvestLogScreen';
import { MortalityLogScreen } from '../screens/logs/MortalityLogScreen';
import { ChemicalLogScreen } from '../screens/logs/ChemicalLogScreen';
import { PlanktonLogScreen } from '../screens/logs/PlanktonLogScreen';
import { MicrobiologyLogScreen } from '../screens/logs/MicrobiologyLogScreen';
import { DiseaseLogScreen } from '../screens/logs/DiseaseLogScreen';

// Phase 4 Screens (Calculators & Simulations)
import { CalculatorHubScreen } from '../screens/calculators/CalculatorHubScreen';
import { CultivationPerformanceScreen } from '../screens/calculators/CultivationPerformanceScreen';
import { DailyFeedCalculatorScreen } from '../screens/calculators/DailyFeedCalculatorScreen';
import { ProductAmountScreen } from '../screens/calculators/ProductAmountScreen';
import { FreeAmmoniaScreen } from '../screens/calculators/FreeAmmoniaScreen';

import { SimulationListScreen } from '../screens/simulation/SimulationListScreen';
import { SimulationCreateScreen } from '../screens/simulation/SimulationCreateScreen';
import { SimulationResultsScreen } from '../screens/simulation/SimulationResultsScreen';

// Phase 5 Screens (History & Polish)
import { WaterQualityHistoryScreen } from '../screens/logs/History/WaterQualityHistoryScreen';
import { FeedHistoryScreen } from '../screens/logs/History/FeedHistoryScreen';
import { SamplingHistoryScreen } from '../screens/logs/History/SamplingHistoryScreen';
import { TreatmentHistoryScreen } from '../screens/logs/History/TreatmentHistoryScreen';
import { HarvestHistoryScreen } from '../screens/logs/History/HarvestHistoryScreen';
import { ChemicalHistoryScreen } from '../screens/logs/History/ChemicalHistoryScreen';
import { PlanktonHistoryScreen } from '../screens/logs/History/PlanktonHistoryScreen';
import { MicrobiologyHistoryScreen } from '../screens/logs/History/MicrobiologyHistoryScreen';
import { DiseaseHistoryScreen } from '../screens/logs/History/DiseaseHistoryScreen';
import { MortalityHistoryScreen } from '../screens/logs/History/MortalityHistoryScreen';
import { MeasurementsScreen } from '../screens/measurements/MeasurementsScreen';
import { DailyRoutineScreen } from '../screens/engines/DailyRoutineScreen';
import { WeeklyChemistryScreen } from '../screens/logs/WeeklyChemistryScreen';
import { EnginesHubScreen } from '../screens/engines/EnginesHubScreen';
import { FeedAdvisorScreen } from '../screens/engines/FeedAdvisorScreen';
import { HarvestTimingScreen } from '../screens/engines/HarvestTimingScreen';
import { DiseaseRiskScreen } from '../screens/engines/DiseaseRiskScreen';
import { AerationScreen } from '../screens/engines/AerationScreen';
import { LunarScreen } from '../screens/engines/LunarScreen';
import { CropPnlScreen } from '../screens/engines/CropPnlScreen';
import { MorningBriefingScreen } from '../screens/engines/MorningBriefingScreen';

import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { DeleteAccountScreen } from '../screens/settings/DeleteAccountScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { HelpScreen } from '../screens/settings/HelpScreen';
import { AboutScreen } from '../screens/settings/AboutScreen';
import { InventoryListScreen } from '../screens/inventory/InventoryListScreen';
import { InventoryDetailScreen } from '../screens/inventory/InventoryDetailScreen';

// Disease Encyclopedia
import { DiseaseListScreen } from '../screens/diseases/DiseaseListScreen';
import { DiseaseDetailScreen } from '../screens/diseases/DiseaseDetailScreen';
import { DiagnoseScreen } from '../screens/diseases/DiagnoseScreen';

// Tasks
import { TaskListScreen } from '../screens/tasks/TaskListScreen';
import { LeaveRequestsScreen } from '../screens/leave/LeaveRequestsScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { AttendanceLogScreen } from '../screens/attendance/AttendanceLogScreen';
import { NewsListScreen } from '../screens/news/NewsListScreen';
import { NewsDetailScreen } from '../screens/news/NewsDetailScreen';
import { ShopScreen } from '../screens/shop/ShopScreen';
import { ExpensesScreen } from '../screens/finance/ExpensesScreen';
import { TransactionsScreen } from '../screens/finance/TransactionsScreen';
import { ReferenceScreen } from '../screens/reference/ReferenceScreen';
import { HarvestPlansScreen } from '../screens/harvest/HarvestPlansScreen';
import { LanguageScreen } from '../screens/onboarding/LanguageScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { IntentScreen } from '../screens/onboarding/IntentScreen';
import { PondNamesScreen } from '../screens/onboarding/PondNamesScreen';
import { JoinedFarmScreen } from '../screens/onboarding/JoinedFarmScreen';
import { PondSetupScreen } from '../screens/onboarding/PondSetupScreen';
import { JoinFarmScreen } from '../screens/onboarding/JoinFarmScreen';
import { OtpLoginScreen } from '../screens/auth/OtpLoginScreen';
import { OtpCallbackScreen } from '../screens/auth/OtpCallbackScreen';
import { TwoFactorChallengeScreen } from '../screens/auth/TwoFactorChallengeScreen';
import { TwoFactorScreen } from '../screens/settings/TwoFactorScreen';
import { GrowthAndHarvestScreen } from '../screens/calculators/GrowthAndHarvestScreen';
import { FeedProductsScreen } from '../screens/feedProducts/FeedProductsScreen';
import { FeedStatsScreen } from '../screens/feed/FeedStatsScreen';
import { PrivacyPolicyScreen } from '../screens/legal/PrivacyPolicyScreen';
import { TermsScreen } from '../screens/legal/TermsScreen';

export type RootStackParamList = {
    // Auth
    Login: undefined;
    // Carries the intent chosen on artboard 03; optional so a direct arrival
    // (deep link, 'Sign up' from Login) still resolves.
    Register: { intent?: SignupIntent } | undefined;
    ForgotPassword: undefined;
    ResetPassword: undefined;
    TruecallerLogin: undefined;
    TruecallerPhone: undefined;
    OtpLogin: undefined;
    OtpCallback: undefined;
    TwoFactorChallenge: { tempToken: string };
    TwoFactor: undefined;
    DeleteAccount: undefined;
    PrivacyPolicy: undefined;
    Terms: undefined;

    // Main
    MainApp: undefined;
    QuickLog: undefined;
    HarvestLog: { pondId: string; pondName: string; cropId?: string };

    // Phase 2
    CreateFarm: undefined;
    FarmDetail: { farmId: string; farmName?: string };
    FarmMembers: { farmId: string; farmName?: string };
    MemberDetail: { farmId: string; farmName?: string; member: any };
    AllWorkers: undefined;
    AddWorker: { farmId: string; farmName?: string };
    CreatePond: { farmId: string };
    PondDashboard: { pondId: string; pondName?: string };
    PondDimensionHistory: { pondId: string; pondName?: string };
    CycleAnalysis: { cycleId: string; cycleName?: string };
    CreateCycle: { pondId: string };
    CycleDetail: { cycleId: string };

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
    WeeklyChemistry: { pondId: string; pondName?: string; cropId?: string };
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
    About: undefined;
    Inventory: undefined;
    InventoryDetail: { inventoryId: string; itemName?: string };

    // Disease Encyclopedia
    DiseaseList: undefined;
    DiseaseDetail: { diseaseId: string };
    Diagnose: { pondId?: string; pondName?: string; cropId?: string } | undefined;

    // Tasks
    TaskList: { farmId: string; farmName?: string };

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
    JoinFarm: undefined;
    JoinedFarm: { farmName: string; role: FarmRole; status: 'active' | 'pending' };

    // Additional calculators + feed products
    GrowthAndHarvest: undefined;
    FeedProducts: undefined;
    FeedStats: { pondId: string; pondName?: string; cropId?: string; farmId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
    const { isLoading, isAuthenticated, pendingFarmSetup, pendingFarmJoin, initialize } = useAuthStore();
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

    // Load the user's farm memberships once authenticated so usePermissions()
    // resolves correctly on every screen; clear them on logout.
    useEffect(() => {
        if (isAuthenticated) loadMemberships();
        else resetMemberships();
    }, [isAuthenticated, loadMemberships, resetMemberships]);

    if (isLoading || needsLanguage === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.roles.light.background }}>
                <ActivityIndicator size="large" color={theme.roles.light.primary} />
            </View>
        );
    }

    return (
        <Stack.Navigator
            // Owners who just registered land on Create-Farm first (mandatory
            // first-run setup); workers who just registered land on Join-Farm
            // first; everyone else starts on the main app / login.
            initialRouteName={
                isAuthenticated && pendingFarmSetup
                    ? 'CreateFarm'
                    : isAuthenticated && pendingFarmJoin
                        ? 'JoinFarm'
                        : !isAuthenticated && needsLanguage
                            ? 'Language'
                            : undefined
            }
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
                    <Stack.Screen name="Intent" component={IntentScreen} />
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                    <Stack.Screen
                        name="ForgotPassword"
                        component={ForgotPasswordScreen}
                        options={{ headerShown: true, title: 'Forgot Password', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    <Stack.Screen
                        name="TruecallerLogin"
                        component={TruecallerLoginScreen}
                        options={{ headerShown: true, title: 'Sign in with Truecaller', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen
                        name="TruecallerPhone"
                        component={TruecallerPhoneScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen name="OtpLogin" component={OtpLoginScreen} />
                    <Stack.Screen name="OtpCallback" component={OtpCallbackScreen} />
                    <Stack.Screen name="TwoFactorChallenge" component={TwoFactorChallengeScreen} />
                    {/* Legal — reachable pre-auth from the Register consent line */}
                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                    <Stack.Screen name="Terms" component={TermsScreen} />
                </>
            ) : (
                <>
                    <Stack.Screen name="MainApp" component={MainNavigator} />
                    <Stack.Screen name="QuickLog" component={QuickLogScreen} options={{ presentation: 'modal' }} />

                    <Stack.Screen name="CreateFarm" component={CreateFarmScreen} />
                    <Stack.Screen name="PondNames" component={PondNamesScreen} />
                    <Stack.Screen name="PondSetup" component={PondSetupScreen} />
                    <Stack.Screen name="JoinFarm" component={JoinFarmScreen} />
                    <Stack.Screen name="JoinedFarm" component={JoinedFarmScreen} />
                    <Stack.Screen name="FarmDetail" component={FarmDetailScreen} />
                    <Stack.Screen name="FarmMembers" component={FarmMembersScreen} />

                    <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
                    <Stack.Screen name="AllWorkers" component={AllWorkersScreen} />
                    <Stack.Screen name="AddWorker" component={AddWorkerScreen} />
                    <Stack.Screen name="CreatePond" component={CreatePondScreen} />
                    <Stack.Screen name="PondDashboard" component={PondDashboardScreen} />
                    <Stack.Screen name="CreateCycle" component={CreateCycleScreen} />
                    <Stack.Screen name="CycleDetail" component={CycleDetailScreen} />
                    <Stack.Screen name="PondDimensionHistory" component={PondDimensionHistoryScreen} />
                    <Stack.Screen name="CycleAnalysis" component={CycleAnalysisScreen} />

                    <Stack.Screen name="WaterQualityLog" component={WaterQualityLogScreen} />
                    <Stack.Screen name="FeedLog" component={FeedLogScreen} />
                    <Stack.Screen name="FeedingTrayChecks" component={FeedingTrayChecksScreen} />
                    <Stack.Screen name="SamplingLog" component={SamplingLogScreen} />
                    <Stack.Screen name="TreatmentLog" component={TreatmentLogScreen} />
                <Stack.Screen name="HarvestLog" component={HarvestLogScreen} />
                    <Stack.Screen name="MortalityLog" component={MortalityLogScreen} />
                    <Stack.Screen name="ChemicalLog" component={ChemicalLogScreen} />
                    <Stack.Screen name="PlanktonLog" component={PlanktonLogScreen} />
                    <Stack.Screen name="MicrobiologyLog" component={MicrobiologyLogScreen} />
                    <Stack.Screen name="DiseaseLog" component={DiseaseLogScreen} />

                    {/* Phase 4 */}
                    <Stack.Screen name="CalculatorHub" component={CalculatorHubScreen} />
                    <Stack.Screen name="CultivationPerformance" component={CultivationPerformanceScreen} />
                    <Stack.Screen name="DailyFeedCalculator" component={DailyFeedCalculatorScreen} />
                    <Stack.Screen name="ProductAmount" component={ProductAmountScreen} />
                    <Stack.Screen name="FreeAmmonia" component={FreeAmmoniaScreen} />

                    <Stack.Screen name="SimulationList" component={SimulationListScreen} />
                    <Stack.Screen name="SimulationCreate" component={SimulationCreateScreen} />
                    <Stack.Screen name="SimulationResults" component={SimulationResultsScreen} />

                    {/* Phase 5 (History) */}
                    <Stack.Screen name="WaterQualityHistory" component={WaterQualityHistoryScreen} />
                    <Stack.Screen name="FeedHistory" component={FeedHistoryScreen} />
                    <Stack.Screen name="SamplingHistory" component={SamplingHistoryScreen} />
                    <Stack.Screen name="TreatmentHistory" component={TreatmentHistoryScreen} />
                    <Stack.Screen name="HarvestHistory" component={HarvestHistoryScreen} />
                    <Stack.Screen name="ChemicalHistory" component={ChemicalHistoryScreen} />
                    <Stack.Screen name="PlanktonHistory" component={PlanktonHistoryScreen} />
                    <Stack.Screen name="MicrobiologyHistory" component={MicrobiologyHistoryScreen} />
                    <Stack.Screen name="DiseaseHistory" component={DiseaseHistoryScreen} />
                    <Stack.Screen name="MortalityHistory" component={MortalityHistoryScreen} />
                    <Stack.Screen
                        name="Measurements"
                        component={MeasurementsScreen}
                        options={{ headerShown: true, title: 'Measurements', headerTintColor: theme.roles.light.primary }}
                    />
                    <Stack.Screen name="DailyRoutine" component={DailyRoutineScreen} options={{ headerShown: true, title: 'Daily Routine', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="WeeklyChemistry" component={WeeklyChemistryScreen} options={{ headerShown: true, title: 'Weekly Chemistry', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="EnginesHub" component={EnginesHubScreen} options={{ headerShown: true, title: 'Decision Engines', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="FeedAdvisor" component={FeedAdvisorScreen} options={{ headerShown: true, title: 'Feed Advisor', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="HarvestTiming" component={HarvestTimingScreen} options={{ headerShown: true, title: 'Harvest Timing', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="DiseaseRisk" component={DiseaseRiskScreen} options={{ headerShown: true, title: 'Disease Early-Warning', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="Aeration" component={AerationScreen} options={{ headerShown: true, title: 'Aeration & Power', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="Lunar" component={LunarScreen} options={{ headerShown: true, title: 'Lunar Molt', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="CropPnl" component={CropPnlScreen} options={{ headerShown: true, title: 'Crop P&L', headerTintColor: theme.roles.light.primary }} />
                    <Stack.Screen name="MorningBriefing" component={MorningBriefingScreen} options={{ headerShown: true, title: 'Morning Briefing', headerTintColor: theme.roles.light.primary }} />

                    {/* Phase 5 (Settings & Notifications) */}
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="Help" component={HelpScreen} />
                    <Stack.Screen name="About" component={AboutScreen} />
                    <Stack.Screen name="Inventory" component={InventoryListScreen} />
                    <Stack.Screen name="InventoryDetail" component={InventoryDetailScreen} />

                    {/* Disease Encyclopedia */}
                    <Stack.Screen name="DiseaseList" component={DiseaseListScreen} />
                    <Stack.Screen name="DiseaseDetail" component={DiseaseDetailScreen} />
                    <Stack.Screen name="Diagnose" component={DiagnoseScreen} />

                    {/* Tasks */}
                    <Stack.Screen name="TaskList" component={TaskListScreen} />
                    <Stack.Screen name="LeaveRequests" component={LeaveRequestsScreen} />
                    <Stack.Screen name="Attendance" component={AttendanceScreen} />
                    <Stack.Screen name="AttendanceLog" component={AttendanceLogScreen} />

                    {/* News / eShop / Reference */}
                    <Stack.Screen name="NewsList" component={NewsListScreen} />
                    <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
                    <Stack.Screen name="Shop" component={ShopScreen} />
                    <Stack.Screen name="Reference" component={ReferenceScreen} />

                    {/* Finance */}
                    <Stack.Screen name="Expenses" component={ExpensesScreen} />
                    <Stack.Screen name="Transactions" component={TransactionsScreen} />

                    {/* Harvest planning */}
                    <Stack.Screen name="HarvestPlans" component={HarvestPlansScreen} />

                    {/* Security */}
                    <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
                    {/* DEEPLINK-1: the reset link must open even when a session
                        already exists, so ResetPassword is reachable from the
                        authenticated stack too — and TwoFactorChallenge so the
                        AUTH-2 reset→2FA hand-off can complete from here. */}
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    <Stack.Screen name="OtpCallback" component={OtpCallbackScreen} />
                    <Stack.Screen name="TwoFactorChallenge" component={TwoFactorChallengeScreen} />

                    {/* Additional calculators + feed products */}
                    <Stack.Screen name="GrowthAndHarvest" component={GrowthAndHarvestScreen} />
                    <Stack.Screen name="FeedProducts" component={FeedProductsScreen} />
                    <Stack.Screen
                        name="FeedStats"
                        component={FeedStatsScreen}
                        options={{ headerShown: true, title: 'Feed Statistics', headerTintColor: theme.roles.light.primary }}
                    />

                    {/* Legal */}
                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                    <Stack.Screen name="Terms" component={TermsScreen} />
                </>
            )}
        </Stack.Navigator>
    );
};

export default RootNavigator;
