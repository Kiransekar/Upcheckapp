import apiClient from './client';

export interface NewsArticle {
    id: string;
    title: string;
    /** Upcheck's own short summary. Null until one has been written. */
    summary?: string | null;
    /** Hand-written editorial body only — an aggregated item never has one. */
    content?: string | null;
    category?: string;
    imageUrl?: string | null;
    publishedAt: string;
    createdAt: string;
    /** Publisher name. Every aggregated item is shown attributed. */
    sourceName?: string | null;
    /** The publisher's page. Tapping an item opens this, not an in-app copy. */
    canonicalUrl?: string | null;
}

export interface PageMeta {
    page: number;
    take: number;
    itemCount: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface NewsPage {
    data: NewsArticle[];
    meta: PageMeta;
}

export interface NewsQuery {
    category?: string;
    page?: number;
    take?: number;
    locale?: string;
}

export const newsApi = {
    getAll: (params: NewsQuery = {}) =>
        apiClient.get<NewsPage | NewsArticle[]>('/news', { params }),

    getById: (id: string, locale?: string) =>
        apiClient.get<NewsArticle>(`/news/${id}`, { params: { locale } }),
};

/** The list endpoint returned a bare array before pagination landed. */
export const unwrapNews = (body: NewsPage | NewsArticle[] | undefined): NewsArticle[] =>
    Array.isArray(body) ? body : (body?.data ?? []);
