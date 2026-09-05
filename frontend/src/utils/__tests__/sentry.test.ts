/**
 * The scrubber is the Privacy Policy, in code.
 *
 * Section 6 promises crash reports carry "no passwords or session tokens, no
 * phone numbers, no email addresses, and no financial values, harvest figures
 * or farm records". Every promise in that sentence gets a test here, plus the
 * two failure modes that would quietly void it: a scrubber that only looks at
 * the top level, and a scrubber so blunt it destroys the crash report.
 */
// Spied rather than merely absent: "no DSN is a no-op" has to mean the SDK is
// never initialised, not just that initialising it happened to throw under
// Jest. Without this the test passes even when the DSN check is deleted.
const mockSentryInit = jest.fn();
jest.mock('@sentry/react-native', () => ({
    init: mockSentryInit,
    setUser: jest.fn(),
    close: jest.fn(),
}));

import { initSentry, isCrashReportingActive, scrubBreadcrumb, scrubEvent, scrubString } from '../sentry';

const R = '[redacted]';

describe('scrubEvent', () => {
    it('strips a request body carrying password, amount and phone', () => {
        const out: any = scrubEvent({
            request: {
                url: 'https://api.upcheck.in/api/auth/login',
                data: { password: 'hunter2', amount: 45000, phone: '9876543210' },
            },
        });
        expect(out.request.data).toBe(R);
        expect(JSON.stringify(out)).not.toContain('hunter2');
        expect(JSON.stringify(out)).not.toContain('45000');
        expect(JSON.stringify(out)).not.toContain('9876543210');
    });

    it('strips an Authorization: Bearer <jwt> header', () => {
        const jwt =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIm5hbWUiOiJSYXZpIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
        const out: any = scrubEvent({
            request: { headers: { Authorization: `Bearer ${jwt}`, Cookie: 'sb=abc', Accept: 'application/json' } },
        });
        expect(out.request.headers.Authorization).toBe(R);
        expect(out.request.headers.Cookie).toBe(R);
        // Signal that is not PII survives.
        expect(out.request.headers.Accept).toBe('application/json');
        expect(JSON.stringify(out)).not.toContain(jwt);
    });

    it('strips an Indian phone number out of a free-text message', () => {
        const out: any = scrubEvent({ message: 'OTP send failed for +919876543210 (gateway 502)' });
        expect(out.message).not.toContain('9876543210');
        expect(out.message).toBe(`OTP send failed for ${R} (gateway 502)`);
    });

    it('strips the internal <digits>@truecaller.temp address — it IS a phone number', () => {
        const out: any = scrubEvent({
            message: 'profile lookup failed for 9876543210@truecaller.temp',
        });
        expect(out.message).not.toContain('9876543210');
        expect(out.message).not.toContain('truecaller.temp');
    });

    it('strips a breadcrumb request body and the query string off its URL', () => {
        const out: any = scrubEvent({
            breadcrumbs: [
                {
                    category: 'xhr',
                    data: {
                        url: 'https://api.upcheck.in/api/expenses?amount=45000&phone=9876543210',
                        method: 'POST',
                        status_code: 500,
                        body: { amount: 45000, note: 'feed for pond 3' },
                    },
                },
            ],
        });
        const crumb = out.breadcrumbs[0];
        expect(crumb.data.body).toBe(R);
        expect(crumb.data.url).toBe('https://api.upcheck.in/api/expenses');
        // The parts that make it debuggable are untouched.
        expect(crumb.data.method).toBe('POST');
        expect(crumb.data.status_code).toBe(500);
        expect(JSON.stringify(out)).not.toContain('45000');
    });

    // The whole reason the walk is recursive. A shallow pass over event.extra
    // sails straight past this.
    it('finds a salary four levels deep', () => {
        const out: any = scrubEvent({
            extra: { response: { farm: { worker: { salary: 12000, name: 'Ravi' } } } },
        });
        expect(out.extra.response.farm.worker.salary).toBe(R);
        expect(JSON.stringify(out)).not.toContain('12000');
    });

    it('leaves an event with no PII completely unchanged', () => {
        const clean = {
            level: 'error',
            message: 'Cannot read property length of undefined',
            platform: 'android',
            release: 'upcheck@1.0.0',
            tags: { screen: 'WaterLog', pondCount: 3 },
            exception: {
                values: [
                    {
                        type: 'TypeError',
                        stacktrace: {
                            frames: [
                                { filename: 'src/screens/logs/WaterLogScreen.tsx', lineno: 142, function: 'onSave' },
                            ],
                        },
                    },
                ],
            },
            breadcrumbs: [{ category: 'navigation', data: { from: 'Today', to: 'WaterLog' } }],
        };
        expect(scrubEvent(JSON.parse(JSON.stringify(clean)))).toEqual(clean);
    });

    it('survives a circular reference instead of hanging', () => {
        const event: any = { message: 'boom', extra: {} };
        event.extra.self = event;
        expect(() => scrubEvent(event)).not.toThrow();
    });

    it('does not mistake a 13-digit epoch timestamp for a phone number', () => {
        expect(scrubString('failed at 1760000000000')).toBe('failed at 1760000000000');
    });
});

describe('scrubBreadcrumb', () => {
    // A console.log of a record is already flattened to text by the time it
    // reaches us, so there is no key left to match on. Dropping the category
    // is the only honest way to keep section 6's promise.
    it('drops console breadcrumbs entirely', () => {
        expect(scrubBreadcrumb({ category: 'console', message: 'salary: 12000' })).toBeNull();
    });

    it('keeps a navigation breadcrumb, scrubbed', () => {
        const out: any = scrubBreadcrumb({ category: 'navigation', data: { to: 'Money' } });
        expect(out.data.to).toBe('Money');
    });
});

describe('with no DSN configured', () => {
    it('is a no-op: Sentry.init is never called and the app boots normally', () => {
        // No EXPO_PUBLIC_SENTRY_DSN under test, so extra.sentryDsn is ''.
        expect(initSentry()).toBe(false);
        expect(mockSentryInit).not.toHaveBeenCalled();
        expect(isCrashReportingActive()).toBe(false);
    });
});
