import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import i18n from '../i18n';
import { readCached, writeCached } from './offlineCache';

const API_URL = Constants.expoConfig?.extra?.apiBaseUrl
    || process.env.EXPO_PUBLIC_API_URL
    || 'http://localhost:8080/api';

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Lazy import to avoid require cycle: authStore -> auth -> client -> authStore
// We import authStore only when needed in interceptors, not at module load time
const getAuthState = () => {
    // Dynamic import to break the cycle
    const authStore = require('../store/authStore');
    return authStore.useAuthStore.getState();
};

// Request interceptor — attach auth token
apiClient.interceptors.request.use((config) => {
    const { accessToken } = getAuthState();
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// ── Token refresh machinery ──
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token!);
        }
    });
    failedQueue = [];
};

/** The cache key for a request — path plus query, ignoring the host. */
const cacheKeyFor = (config?: InternalAxiosRequestConfig): string | null => {
    if (!config || (config.method ?? 'get').toLowerCase() !== 'get') return null;
    const url = config.url ?? '';
    if (!url) return null;
    const params = config.params
        ? JSON.stringify(config.params, Object.keys(config.params).sort())
        : '';
    return `${url}${params}`;
};

// Response interceptor — handle 401 with refresh
apiClient.interceptors.response.use(
    (response) => {
        // Remember successful GETs so the same read survives losing signal.
        // Fire-and-forget: a cache write must never delay a response that has
        // already arrived.
        const key = cacheKeyFor(response.config as InternalAxiosRequestConfig);
        if (key) void writeCached(key, response.data);
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // No response at all — timeout or no connectivity.
        if (!error.response) {
            /**
             * Serve the last-known-good copy rather than an error screen.
             *
             * Only 7 of ~96 screens read through TanStack Query; the rest fetch
             * straight into `useState` and had no cache at all, so losing
             * signal made them unusable instantly — even for data the farmer
             * had just been looking at.
             *
             * GET only, and only on a NETWORK failure: a 4xx/5xx is the server
             * answering, and substituting stale data there would hide a real
             * error. Writes still reject, because they go through the offline
             * queue in src/sync/, which is what actually guarantees they land.
             */
            const key = cacheKeyFor(originalRequest);
            if (key) {
                const cached = await readCached(key);
                if (cached) {
                    return {
                        data: cached.data,
                        status: 200,
                        statusText: 'OK (offline cache)',
                        // Screens that care can show the age; the rest just render.
                        headers: { 'x-upcheck-cached-at': String(cached.at) },
                        config: originalRequest,
                        request: null,
                    } as any;
                }
            }
            // Nothing cached — surface a friendly message instead of axios
            // internals like "timeout of 15000ms exceeded".
            error.message = i18n.t('common.networkError');
            return Promise.reject(error);
        }

        // Only handle 401s, and don't retry if already retried
        if (error.response.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // Don't try to refresh auth endpoints themselves
        const url = originalRequest.url || '';
        if (url.includes('/auth/')) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // Another request is already refreshing — queue this one
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                originalRequest._retry = true;
                return apiClient(originalRequest);
            }).catch((err) => {
                return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const authState = getAuthState();
            // Fall back to the persisted refresh token: after an offline cold-start
            // (AUTH-1) the store holds a reconstructed user with no `session` object,
            // only the persisted `refreshToken`. Without this fallback the first
            // 401 on reconnect would wrongly log the farmer out.
            const refreshToken = authState.session?.refresh_token || authState.refreshToken;
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            // Call the refresh endpoint
            const { data } = await axios.post(`${API_URL}/auth/supabase/refresh`, {
                refreshToken,
            });

            const newSession = data.session;
            if (!newSession?.access_token) {
                throw new Error('Refresh response missing access token');
            }

            // Update the store with new session
            getAuthState().setSession(newSession);

            // Process queued requests with new token
            processQueue(null, newSession.access_token);

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${newSession.access_token}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            // Refresh failed — clear everything and log out
            processQueue(refreshError, null);
            getAuthState().clearSession();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default apiClient;
