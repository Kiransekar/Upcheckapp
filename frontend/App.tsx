import './src/i18n'; // initialise i18next before any screen renders
import './src/theme/fontScaling'; // cap OS-level font scaling app-wide (docs/UI_UX_AUDIT.md Tier 1 #4)
import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { linking } from './src/navigation/linking';
import { queryClient, persistOptions, startFocusTracking } from './src/query/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastHost } from './src/components/ui/ToastHost';
import { registerForPushNotificationsAsync, syncReminders } from './src/utils/notifications';
import { alertCenterApi } from './src/api/alertCenter';
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

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Once we have a real Expo token and an authenticated session, register the
  // token with the backend so server-side alerts can be delivered as push.
  useEffect(() => {
    if (isAuthenticated && expoPushToken.startsWith('ExponentPushToken')) {
      pushApi.registerToken(expoPushToken).catch(() => {
        /* best-effort; backend logs failures */
      });
    }
  }, [isAuthenticated, expoPushToken]);

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
    const armReminders = () => {
      alertCenterApi
        .today()
        .then((r) => syncReminders(r.data.contexts ?? []))
        .catch(() => {
          /* best-effort; the next foreground or save will retry */
        });
    };
    armReminders();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') armReminders();
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

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
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
          <NavigationContainer linking={linking}>
            <RootNavigator />
          </NavigationContainer>
          {/* App-wide transient confirmations (e.g. "Saved" after a log). */}
          <ToastHost />
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
