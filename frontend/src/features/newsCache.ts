import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsArticle } from '../api/news';

/**
 * Last-known news, kept on the device.
 *
 * News is read-only, so this is a plain cache rather than a `recordSync` queue
 * (that is for writes). A farmer opening the app with no signal should see the
 * headlines they saw yesterday, dated honestly — never an empty state when we
 * have something to show.
 */
const KEY = 'news-cache-v1';

/** §10 — 50 items is a few screens of scrolling and a small write on a 2 GB phone. */
export const NEWS_CACHE_LIMIT = 50;

export interface NewsCache {
    items: NewsArticle[];
    /** When the server last answered, NOT when the cache was read. */
    cachedAt: string;
}

export const readNewsCache = async (): Promise<NewsCache | null> => {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as NewsCache;
        return Array.isArray(parsed?.items) ? parsed : null;
    } catch {
        // Corrupt or unreadable cache is the same as no cache.
        return null;
    }
};

export const writeNewsCache = async (items: NewsArticle[]): Promise<void> => {
    try {
        const payload: NewsCache = {
            items: items.slice(0, NEWS_CACHE_LIMIT),
            cachedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
        // A full disk must not break the screen that just loaded fine.
    }
};
