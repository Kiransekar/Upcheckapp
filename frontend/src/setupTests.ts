// Jest setup hooks. Add global test configuration here as needed.

// NetInfo has no native module under jest; use the library's official mock so
// components that subscribe to connectivity (e.g. OfflineIndicator) can render.
jest.mock('@react-native-community/netinfo', () =>
    require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// AsyncStorage (used by syncStore persistence + i18n language persistence) also
// needs its jest mock; without it any screen that renders OfflineIndicator throws.
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// GoogleSignin has no native module under Jest — TurboModuleRegistry has
// nothing registered in this environment. authStore.ts imports it (used by
// logout()), which pulls it into every test that transitively imports the
// store, even ones with nothing to do with Google Sign-In. A per-test-file
// jest.mock() (e.g. in useGoogleAuth's own tests) overrides this default.
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(async () => true),
        signIn: jest.fn(),
        signOut: jest.fn(async () => undefined),
    },
    isSuccessResponse: jest.fn(() => false),
    isErrorWithCode: jest.fn(() => false),
    statusCodes: {
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    },
}));

// Initialise i18n (English) so components using useTranslation() render real
// strings under test instead of raw keys.
import './i18n';

// The read cache is a module singleton, so without this a query cached by one
// test satisfies the next one from cache and its mocked API is never called —
// a confusing "toHaveBeenCalled" failure with no obvious cause. Retries are off
// for the same reason: a test asserting an error state should not wait out a
// backoff first.
import { notifyManager } from '@tanstack/react-query';
import { queryClient } from './query/client';
// TanStack batches its re-renders through a setTimeout(0) by default, which puts
// a query result a macrotask behind a plain setState. Every screen test here was
// written against setState timing; scheduling synchronously under test keeps
// them honest instead of sprinkling extra waitFors through the suite.
notifyManager.setScheduler((cb) => cb());
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retry: false } });
afterEach(() => {
    queryClient.clear();
});

export {};
