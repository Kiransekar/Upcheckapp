import {
  scrubEvent,
  scrubBreadcrumb,
  scrubString,
  hashUserId,
  REDACTED,
} from './sentry-scrub';

const json = (v: unknown) => JSON.stringify(v);

describe('sentry scrubbing', () => {
  it('drops the request body entirely (password, amount, phone)', () => {
    const out = scrubEvent({
      request: {
        method: 'POST',
        url: 'https://api.upcheck.in/api/expenses',
        data: {
          password: 'hunter2',
          amount: 45000,
          phone: '9876543210',
        },
      },
    });
    expect(out.request.data).toBeUndefined();
    const s = json(out);
    expect(s).not.toContain('hunter2');
    expect(s).not.toContain('45000');
    expect(s).not.toContain('9876543210');
  });

  it('strips Authorization / Cookie / api-key headers', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijklmnop';
    const out = scrubEvent({
      request: {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Cookie: 'sid=abc123',
          'x-api-key': 'sb_secret_abcdefghijkl',
          'user-agent': 'okhttp/4.9',
        },
      },
    });
    expect(out.request.headers.Authorization).toBe(REDACTED);
    expect(out.request.headers.Cookie).toBe(REDACTED);
    expect(out.request.headers['x-api-key']).toBe(REDACTED);
    expect(out.request.headers['user-agent']).toBe('okhttp/4.9');
    expect(json(out)).not.toContain(jwt);
  });

  it('scrubs query-string values but keeps the keys', () => {
    const out = scrubEvent({
      request: { query_string: { token: 'abc', page: '2' } },
    });
    expect(out.request.query_string).toEqual({
      token: REDACTED,
      page: REDACTED,
    });
  });

  it('redacts phone numbers in exception messages', () => {
    const out = scrubEvent({
      exception: {
        values: [
          { type: 'Error', value: 'no worker for +919876543210 on farm 4' },
        ],
      },
    });
    const v = out.exception.values[0].value;
    expect(v).not.toContain('9876543210');
    expect(v).toContain(REDACTED);
    expect(v).toContain('on farm 4');
  });

  it('redacts truecaller.temp internal emails (they are phone numbers)', () => {
    const out = scrubEvent({
      exception: {
        values: [
          { type: 'Error', value: 'login failed for 9876543210@truecaller.temp' },
        ],
      },
    });
    const v = out.exception.values[0].value;
    expect(v).not.toContain('9876543210');
    expect(v).not.toContain('truecaller.temp');
    expect(v).toBe(`login failed for ${REDACTED}`);
  });

  it('redacts real email addresses anywhere in a string', () => {
    expect(scrubString('mail ravi.k@gmail.com now')).toBe(
      `mail ${REDACTED} now`,
    );
  });

  it('scrubs a breadcrumb carrying a request body with unitPrice', () => {
    const out = scrubBreadcrumb({
      category: 'http',
      data: {
        url: '/api/expenses',
        body: { unitPrice: 320, note: 'feed' },
      },
    });
    expect(out.data.body.unitPrice).toBe(REDACTED);
    expect(out.category).toBe('http');
  });

  it('reduces event.user to a hashed id with no email/username/phone', () => {
    const out = scrubEvent({
      user: {
        id: 'c0ffee00-0000-4000-8000-000000000001',
        email: 'ravi@example.com',
        username: 'ravi',
        phone: '+919876543210',
        ip_address: '49.37.1.2',
      },
    });
    expect(out.user).toEqual({
      id: hashUserId('c0ffee00-0000-4000-8000-000000000001'),
    });
    expect(out.user.id).not.toContain('c0ffee00');
    const s = json(out);
    expect(s).not.toContain('ravi');
    expect(s).not.toContain('49.37.1.2');
  });

  it('scrubs a salary key nested 4+ levels deep', () => {
    const out = scrubEvent({
      extra: { a: { b: { c: { d: { salary: 18000 } } } } },
    });
    expect(out.extra.a.b.c.d.salary).toBe(REDACTED);
  });

  it('survives circular references', () => {
    const a: any = { name: 'loop' };
    a.self = a;
    expect(() => scrubEvent({ extra: { a } })).not.toThrow();
    expect(json(scrubEvent({ extra: { a } }))).toContain('[circular]');
  });

  it('leaves a clean event untouched', () => {
    const clean = {
      level: 'error',
      exception: {
        values: [
          {
            type: 'TypeError',
            value: "Cannot read properties of undefined (reading 'id')",
            stacktrace: {
              frames: [
                {
                  filename: '/src/ponds/ponds.service.ts',
                  function: 'PondsService.findOne',
                  lineno: 42,
                },
              ],
            },
          },
        ],
      },
      request: { method: 'GET', url: 'https://api.upcheck.in/api/ponds/7' },
      tags: { module: 'ponds' },
    };
    expect(scrubEvent(JSON.parse(json(clean)))).toEqual(clean);
  });
});
