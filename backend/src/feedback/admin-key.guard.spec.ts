import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminKeyGuard, ADMIN_KEY_HEADER } from './admin-key.guard';

const contextWith = (headers: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, method: 'GET', url: '/api/admin/feedback' }),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (key?: string) =>
  new AdminKeyGuard({ get: () => key } as unknown as ConfigService);

describe('AdminKeyGuard', () => {
  it('lets the dashboard through with the right key', () => {
    const guard = guardWith('s3cret-key');
    expect(guard.canActivate(contextWith({ [ADMIN_KEY_HEADER]: 's3cret-key' }))).toBe(
      true,
    );
  });

  it('rejects a wrong key', () => {
    const guard = guardWith('s3cret-key');
    expect(() =>
      guard.canActivate(contextWith({ [ADMIN_KEY_HEADER]: 'wrong-key-xx' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a key of a different length', () => {
    // timingSafeEqual throws on mismatched lengths — the guard must handle
    // that itself rather than 500ing on a short header.
    const guard = guardWith('s3cret-key');
    expect(() => guard.canActivate(contextWith({ [ADMIN_KEY_HEADER]: 'x' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing header', () => {
    const guard = guardWith('s3cret-key');
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects a farmer bearer token — this is not that kind of auth', () => {
    const guard = guardWith('s3cret-key');
    expect(() =>
      guard.canActivate(contextWith({ authorization: 'Bearer farmer-jwt' })),
    ).toThrow(UnauthorizedException);
  });

  /**
   * The one that matters: a forgotten Render env var must not open the support
   * inbox — with farmers' photos in it — to the internet.
   */
  it('denies everything when ADMIN_API_KEY is not configured', () => {
    const guard = guardWith(undefined);
    expect(() =>
      guard.canActivate(contextWith({ [ADMIN_KEY_HEADER]: 'anything' })),
    ).toThrow(UnauthorizedException);
  });
});
