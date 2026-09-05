import './src/i18n'; // initialise i18next before any screen renders
import './src/theme/fontScaling'; // cap OS-level font scaling app-wide (docs/UI_UX_AUDIT.md Tier 1 #4)
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import i18n from './src/i18n';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { linking } from './src/navigation/linking';
import { queryClient, persistOptions, startFocusTracking } from './src/query/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import RootNavigator, { type RootStackParamList } from './src/navigation/RootNavigator';
import { routeForNotification } from './src/features/notificationRouting';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastHost } from './src/components/ui/ToastHost';
import { WhatsNewCard } from './src/components/ui/WhatsNewCard';
import { registerForPushNotificationsAsync, syncReminders } from './src/utils/notifications';
import { alertCenterApi } from './src/api/alertCenter';
import { pondsApi } from './src/api/ponds';
import { loadReminderTimes } from './src/features/reminderTimes';
import {
  loadTelemetryPrefs,
  saveTelemetryPrefs,
  shouldAskAnalyticsConsent,
} from './src/features/telemetryPrefs';
import { syncAnalyticsConsent, capture } from './src/features/analytics';
import { initSentry, setSentryUser } from './src/utils/sentry';
import { useAuthStore } from './src/store/authStore';
import { useBannedSubstancesStore } from './src/features/bannedSubstancesStore';
import { pushApi } from './src/api/push';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
// Material Symbols Rounded — the redesign names its icons in Material Symbols
// terms, and this is a ligature font, so components render the icon NAME as
// text (see components/ui/Icon.tsx).
import { MaterialSymbolsRounded_400Regular } from '@expo-google-fonts/material-symbols-rounded';

/**
 * Navigation handle for notification taps.
 *
 * A tap arrives outside the React tree — from an OS callback, and on a cold
 * start before any navigator exists — so there is no component in scope to
 * navigate from. The ref is the supported way to reach the navigator from
 * there, and `isReady()` is what stops a cold-start tap from firing into a
 * container that has not mounted yet.
 */
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Send the farmer wherever a tapped notification points, if anywhere.
 *
 * `routeForNotification` owns the decision (and the payload→navigator param
 * translation); this only performs it. A payload with no destination — every
 * reminder — returns null and is ignored, which is correct: tapping a reminder
 * just opens the app.
 */
function navigateForNotification(data: unknown): void {
  const route = routeForNotification(data);
  if (!route || !navigationRef.isReady()) return;
  // A switch (not a destructured .navigate(route.screen, route.params)) so
  // TS keeps route.screen and route.params paired per navigator overload —
  // splitting a discriminated union across two args loses that narrowing.
  switch (route.screen) {
    case 'FeedbackDetail':
      navigationRef.navigate('FeedbackDetail', route.params);
      break;
    case 'FarmMembers':
      navigationRef.navigate('FarmMembers', route.params);
      break;
    case 'LeaveRequests':
      navigationRef.navigate('LeaveRequests', route.params);
      break;
  }
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  // One prompt per install, and only for a farmer who has never answered.
  const askedThisSession = useRef(false);
  // Flips true once the navigator is mounted AND the cold-start notification
  // (if any) has been resolved — see onReady below. Gates WhatsNewCard so it
  // never appears over the login flow, before the navigator exists, or on
  // top of a tap that's about to route the farmer to their support reply.
  const [navReady, setNavReady] = useState(false);

  // Once we have a real Expo token and an authenticated session, register the
  // token with the backend so server-side alerts can be delivered as push.
  useEffect(() => {
    if (isAuthenticated && expoPushToken.startsWith('ExponentPushToken')) {
      pushApi.registerToken(expoPushToken).catch(() => {
        /* best-effort; backend logs failures */
      });
    }
  }, [isAuthenticated, expoPushToken]);

  // Telemetry, per Privacy Policy section 6. Crash reporting starts on launch
  // unless the farmer switched it off (and is a no-op with no DSN configured);
  // analytics is only ever started by syncAnalyticsConsent finding a stored
  // 'granted' — 'unasked' and 'declined' both leave the SDK unconstructed.
  useEffect(() => {
    loadTelemetryPrefs()
      .then((prefs) => {
        if (prefs.crashReports) initSentry();
        return syncAnalyticsConsent();
      })
      .catch(() => {
        /* telemetry must never be able to stop the app starting */
      });
  }, []);

  // Identify the account to the crash reporter by an irreversible hash only —
  // never the raw id, email or phone number (setSentryUser does the derivation).
  useEffect(() => {
    setSentryUser(isAuthenticated ? userId : null).catch(() => undefined);
  }, [isAuthenticated, userId]);

  /*
   * The analytics consent question, asked ONCE.
   *
   * Placed here rather than in onboarding or Settings on purpose: onboarding
   * is where a farmer is trying to get their first pond in and will tap
   * anything to get through, which is not consent; Settings is a screen most
   * farmers never open, so the answer would be "no" by default forever, which
   * the policy says is not a decision either. This asks after they are signed
   * in and the navigator is up — the app has already shown it is useful — and
   * never again: 'declined' is written down and the prompt is gated on
   * 'unasked'. The switch in Settings is the only way back in either direction.
   *
   * Not cancelable: a dismissed dialog is not an answer, and leaving it
   * 'unasked' would re-raise it on the next launch, which is the nagging the
   * policy language rules out.
   */
  useEffect(() => {
    if (!isAuthenticated || !navReady || askedThisSession.current) return;
    askedThisSession.current = true;
    loadTelemetryPrefs()
      .then((prefs) => {
        if (!shouldAskAnalyticsConsent(prefs)) return;
        const answer = (granted: boolean) => {
          saveTelemetryPrefs({ ...prefs, analytics: granted ? 'granted' : 'declined' })
            .then(syncAnalyticsConsent)
            .catch(() => undefined);
        };
        Alert.alert(
          i18n.t('settings.analyticsPromptTitle'),
          i18n.t('settings.analyticsPromptBody'),
          [
            { text: i18n.t('settings.analyticsPromptDecline'), onPress: () => answer(false) },
            { text: i18n.t('settings.analyticsPromptAllow'), onPress: () => answer(true) },
          ],
          { cancelable: false },
        );
      })
      .catch(() => undefined);
  }, [isAuthenticated, navReady]);

  // React Native has no window focus event, so TanStack Query's refetch-on-focus
  // needs AppState wiring or it never fires — see src/query/client.ts.
  useEffect(() => startFocusTracking(), []);

  // (Re)arm the water-quality/chemistry reminders against the latest pond
  // contexts on launch and every time the app comes back to the foreground —
  // a slot the farmer already logged is simply not scheduled (see
  // syncReminders). Also re-armed from saveRecord()'s success path
  // (src/sync/recordSync.ts) so logging while the app is open takes effect
  // immediately, not just at the next foreground.
  useEffect(() => {
    if (!isAuthenticated) return;
    //
    // THREE things this deliberately does NOT do any more:
    //  1. It no longer lets `/alert-center/today` decide whether the farmer
    //     gets reminders at all. That endpoint only returns ponds with a
    //     RUNNING CYCLE, so a farmer between crops got an empty array and
    //     silently zero reminders. `/ponds/mine` answers the real question —
    //     "is there a pond here?" — and a fallow pond still needs testing.
    //  2. It no longer drops the whole arming on a failed fetch. If `today()`
    //     fails we arm the full window with no skip information, which is
    //     strictly better than the previous outcome of nothing at all.
    //  3. It no longer scheduled against DEFAULT_REMINDER_TIMES while the
    //     farmer's chosen times sat unread in AsyncStorage.
    const armReminders = async () => {
      const [ctxRes, pondRes, times] = await Promise.all([
        alertCenterApi.today().catch(() => null),
        pondsApi.getMine().catch(() => null),
        loadReminderTimes(),
      ]);
      const contexts = ctxRes?.data?.contexts ?? [];
      // Unknown pond list → fall back to the contexts, which is what the old
      // code assumed unconditionally.
      const hasPonds = pondRes ? (pondRes.data?.length ?? 0) > 0 : contexts.length > 0;
      await syncReminders(contexts, times, new Date(), hasPonds);
    };
    const arm = () =>
      armReminders().catch((e) =>
        // Not swallowed silently any more — Settings shows the farmer the same
        // truth (getReminderStatus), this is for the crash/log trail.
        console.warn('[Notifications] Could not arm reminders', e),
      );
    arm();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') arm();
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Refresh the authoritative banned-substance list from the backend on launch
  // (BANNED-1). Best-effort: falls back to the cached/bundled list when offline.
  useEffect(() => {
    useBannedSubstancesStore.getState().hydrate();
  }, []);

  // Global unhandled promise rejection handler — prevents crash on Android production
  useEffect(() => {
    const handler = (id: string, error: Error | undefined) => {
      console.warn('[UnhandledRejection]', id, error?.message ?? 'Unknown error');
    };
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({ allRejections: true, onUnhandled: handler });
    return () => tracking.disable();
  }, []);

  const [fontsLoaded] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
    'Nunito-ExtraBold': Nunito_800ExtraBold,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_700Bold,
    'DMMono-Regular': DMMono_400Regular,
    'DMMono-Medium': DMMono_500Medium,
    MaterialSymbolsRounded: MaterialSymbolsRounded_400Regular,
  });

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(token => {
        setExpoPushToken(token ?? '');
      })
      .catch((error: any) => setExpoPushToken(`${error}`));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // A tap on a support-reply push opens the report it answers. Reminders
    // carry no destination and are ignored — tapping one just opens the app.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      navigateForNotification(response.notification.request.content.data);
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      {/*
        * The read cache, restored from AsyncStorage before the first paint.
        * This is what lets a phone with no signal open on last-known farms,
        * ponds and readings instead of a stack of error screens.
        */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider>
          <NavigationContainer
            linking={linking}
            ref={navigationRef}
            /*
             * The COLD-START case. If the app was not running, the tap that
             * launched it never reaches the response listener above — it is
             * already in the past by the time that listener attaches. Without
             * this the farmer taps "Support replied", the app opens on Today,
             * and the reply they tapped is nowhere to be seen. Read once the
             * navigator is ready, so the navigate call has somewhere to go.
             */
            onReady={() => {
              Notifications.getLastNotificationResponseAsync()
                .then((response) => {
                  if (response) {
                    navigateForNotification(response.notification.request.content.data);
                  }
                })
                .catch(() => {
                  /* best-effort; a failed read must never block app start */
                })
                .finally(() => {
                  // Only now is it safe to consider showing WhatsNewCard: the
                  // cold-start notification route (if any) has already been
                  // dispatched, so the card never fights it for the screen.
                  setNavReady(true);
                });
              // The one and only automatic lifecycle event, and it is a no-op
              // until the farmer has opted in (features/analytics.ts). Fired
              // here rather than on mount so it cannot run before the consent
              // state has been read from storage.
              capture('app_opened');
            }}
            /*
             * Screen views, by ROUTE NAME only. This is the whole of our
             * automatic instrumentation: PostHog's own autocapture is off at
             * both ends (project setting and client config) because it would
             * hoover up the CONTENTS of these screens — pond names, amounts,
             * harvest figures — which the Privacy Policy promises never reach
             * analytics. A route name is a UI fact, not a farm fact, and it is
             * the one thing that tells us which features get used.
             *
             * `capture` drops anything not on the AnalyticsProps allowlist, so
             * route PARAMS (which carry farmId, pondId, cropId and amounts)
             * cannot leak here even by accident.
             */
            onStateChange={() => {
              const name = navigationRef.getCurrentRoute()?.name;
              if (name) capture('screen_viewed', { screen: name });
            }}
          >
            <RootNavigator />
          </NavigationContainer>
          {/* App-wide transient confirmations (e.g. "Saved" after a log). */}
          <ToastHost />
          {/*
            * "What's new" — undismissed announcements. Gated on auth (never
            * shown over the login flow) and navReady (never shown before the
            * navigator exists or ahead of a cold-start notification route).
            * Self-contained: fetches its own data and renders nothing on an
            * empty response or a failed fetch.
            */}
          {isAuthenticated && navReady && <WhatsNewCard />}
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
