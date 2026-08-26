import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthService } from './supabase-auth.service';

const createClientMock = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

/**
 * Live bug (#30): "Continue with Google" on the Sign In screen silently
 * created a brand-new account for an unregistered email — Supabase's
 * signInWithIdToken auto-provisions on first login regardless of intent.
 * When the frontend sends intent: 'signin', the service must check for an
 * existing account FIRST and refuse with a clear error instead of
 * auto-provisioning. intent: 'signup' (or omitted, for older callers) must
 * keep today's auto-provisioning behavior completely unchanged.
 */
describe('SupabaseAuthService.signInWithIdToken — sign-in intent gate', () => {
  let usersRepository: { findOne: jest.Mock };
  let signInWithIdTokenMock: jest.Mock;

  const buildService = () => {
    createClientMock.mockReturnValue({
      auth: { signInWithIdToken: signInWithIdTokenMock },
    });
    const config = new ConfigService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    return new SupabaseAuthService(config, usersRepository as any);
  };

  // Minimal (unsigned) Google-ID-token shape carrying an email claim.
  // decodeEmailFromGoogleIdToken only reads the payload segment and never
  // verifies the signature, so a fake token is fine for this pre-check.
  const fakeIdToken = (email: string) => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(JSON.stringify({ email })).toString(
      'base64url',
    );
    return `${header}.${payload}.sig`;
  };

  beforeEach(() => {
    createClientMock.mockReset();
    usersRepository = { findOne: jest.fn() };
    signInWithIdTokenMock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
      error: null,
    });
  });

  it('intent "signin" with no existing account throws instead of provisioning one', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    const service = buildService();

    await expect(
      service.signInWithIdToken(
        'google',
        fakeIdToken('new@example.com'),
        'signin',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(signInWithIdTokenMock).not.toHaveBeenCalled();
  });

  it('intent "signin" with an existing account proceeds to sign in normally', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'existing-user' });
    const service = buildService();

    const result = await service.signInWithIdToken(
      'google',
      fakeIdToken('existing@example.com'),
      'signin',
    );

    expect(signInWithIdTokenMock).toHaveBeenCalled();
    expect(result.user).toEqual({ id: 'u1' });
  });

  it('intent "signup" auto-provisions as before, without checking for an existing account', async () => {
    const service = buildService();

    await service.signInWithIdToken(
      'google',
      fakeIdToken('brandnew@example.com'),
      'signup',
    );

    expect(usersRepository.findOne).not.toHaveBeenCalled();
    expect(signInWithIdTokenMock).toHaveBeenCalled();
  });

  it('no intent (older caller) keeps auto-provisioning unchanged', async () => {
    const service = buildService();

    await service.signInWithIdToken('google', fakeIdToken('legacy@example.com'));

    expect(usersRepository.findOne).not.toHaveBeenCalled();
    expect(signInWithIdTokenMock).toHaveBeenCalled();
  });

  it('falls through to normal sign-in if the email claim cannot be decoded (fail-open)', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    const service = buildService();

    await service.signInWithIdToken('google', 'not-a-real-jwt', 'signin');

    expect(signInWithIdTokenMock).toHaveBeenCalled();
  });
});
