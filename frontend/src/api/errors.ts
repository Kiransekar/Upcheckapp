/** class-validator 400s send `message: string[]`; Alert.alert(title, string[]) crashes natively on Android. Always a string. */
export function apiErrorMessage(err: unknown, fallback: string): string {
    const m = (err as any)?.response?.data?.message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join('\n') || fallback;
    if (typeof m === 'string' && m.trim()) return m;
    return fallback;
}
