import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { User as UserEntity } from './user.entity';

@Injectable()
export class SupabaseAuthService {
  private supabase: SupabaseClient;
  /** Service-role client for table access only — never signs anyone in. */
  private supabaseData: SupabaseClient;
  private readonly logger = new Logger(SupabaseAuthService.name);

  constructor(
    private configService: ConfigService,
    // Optional so existing tests that construct this service directly
    // (`new SupabaseAuthService(config)`) keep working untouched — NestJS's
    // real DI container always provides it in production regardless of the
    // TS-level optionality. Only the sign-in-intent check below reads it,
    // and that check already no-ops when it's undefined.
    @InjectRepository(UserEntity)
    private readonly usersRepository?: Repository<UserEntity>,
  ) {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    // L5: the anon key is required for config parity with the frontend and
    // to fail fast on an incomplete deployment. The server intentionally
    // uses a single service-role client for both admin and public auth
    // calls (signInWithPassword/verifyOtp) — those are auth operations, not
    // RLS-bearing data queries, so the elevated key is not a data-exposure
    // risk here.
    const supabaseAnonKey = this.configService.get('SUPABASE_ANON_KEY');
    const supabaseKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseKey) {
      throw new Error(
        `Missing Supabase env vars.\n` +
          `SUPABASE_URL: ${!!supabaseUrl}\n` +
          `SUPABASE_ANON_KEY: ${!!supabaseAnonKey}\n` +
          `SUPABASE_SERVICE_ROLE_KEY: ${!!supabaseKey}`,
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    /**
     * A SECOND service-role client, used only for table reads/writes and never
     * for auth.
     *
     * This exists because of a real, logged failure. `this.supabase` is used
     * for both auth and data, and any auth call that establishes a session —
     * signInWithPassword, verifyOtp (which mintSession uses), signInWithIdToken
     * — leaves that USER's session on the client. `persistSession: false` keeps
     * it out of storage but NOT out of memory, so from that point supabase-js
     * sends the user's access token as `Authorization` on every `.from()` call
     * instead of the service key.
     *
     * PostgREST then sees `authenticated`, not `service_role`, and RLS applies.
     * With RLS enabled and no policies that means SELECT silently returns zero
     * rows and INSERT returns 403 — which is exactly what the Truecaller signup
     * hit: two lookups that found nothing (so it decided the user was new),
     * admin.createUser succeeding, then the users upsert failing with "new row
     * violates row-level security policy".
     *
     * Keeping the two apart means a data call can never inherit whoever last
     * signed in. Nothing in here may call `.auth` sign-in methods.
     */
    this.supabaseData = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // ==================== Email/Password Auth ====================

  async signUp(
    email: string,
    password: string,
    metadata?: {
      firstName?: string;
      lastName?: string;
      username?: string;
    },
  ) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
        // Without this, the confirmation email's link falls back to the
        // dashboard's default Site URL — an unrelated web page, not the app —
        // so clicking it looks like nothing happened and the user stays
        // gated on "verification needed" forever. Same fix as the OTP
        // magic-link (see sendEmailOtp below); OtpCallbackScreen already
        // handles any tokens landing in this fragment generically, whether
        // they came from a signup confirmation or a login OTP link.
        emailRedirectTo: `${this.configService.get('FRONTEND_URL')}/otp-callback`,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictException('Email already registered');
      }
      throw new BadRequestException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  // ==================== Passwordless email OTP ====================

  /**
   * Send a one-time login code to an existing user's email (Supabase native
   * OTP). `shouldCreateUser: false` keeps this a *login* flow — it will not
   * silently provision a new account for an unknown email.
   */
  async sendEmailOtp(email: string) {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        // The Supabase "Magic Link" email template renders a clickable
        // confirmation link alongside (or instead of) the raw `{{ .Token }}`
        // code, and users click it. Without this, that link's redirect falls
        // back to the dashboard's default Site URL — an unrelated web page,
        // not the app — so the click appears to do nothing. Routing it at
        // the app's deep-link scheme lets OtpCallbackScreen complete the
        // login the same way clicking the reset-password link already does.
        emailRedirectTo: `${this.configService.get('FRONTEND_URL')}/otp-callback`,
      },
    });
    if (error) {
      // L1 (anti-enumeration): do NOT surface the error. A distinct
      // failure for unregistered emails would let an attacker discover
      // which accounts exist. Log server-side; return the same generic
      // response whether or not the email is registered.
      this.logger.warn(
        `sendEmailOtp for a login-otp request failed: ${error.message}`,
      );
    }
    return {
      message:
        'If an account exists for that email, a login code has been sent.',
    };
  }

  /** Verify an emailed OTP and return a full session. */
  async verifyEmailOtp(email: string, token: string) {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) {
      throw new UnauthorizedException(error.message);
    }
    return { user: data.user, session: data.session };
  }

  // ==================== OAuth ====================

  /**
   * Best-effort extraction of the `email` claim from a Google ID token, for
   * the sign-in-intent pre-check below ONLY — this does not verify the
   * token's signature, so it must never be trusted for an actual auth
   * decision. The real authentication is still `signInWithIdToken` a few
   * lines down, which Supabase verifies properly. Returns null on any
   * malformed input rather than throwing, so a decode hiccup fails OPEN
   * (falls through to normal sign-in) instead of blocking a legitimate user.
   */
  private decodeEmailFromGoogleIdToken(idToken: string): string | null {
    try {
      const payload = idToken.split('.')[1];
      if (!payload) return null;
      const json = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8');
      const claims = JSON.parse(json);
      return typeof claims.email === 'string' ? claims.email : null;
    } catch {
      return null;
    }
  }

  /**
   * Verify OAuth token from frontend (id_token from Google)
   * Note: Frontend should use Supabase Auth UI or handle OAuth flow with deep linking
   *
   * `intent` distinguishes the Sign In screen from Create Account — both
   * call this same method, and Supabase's signInWithIdToken auto-provisions
   * a brand-new user on first login regardless of which screen sent the
   * request (bug: "Continue with Google" on Sign In silently creates an
   * account for an unregistered email, identically to Create Account).
   * When intent is 'signin', check for an existing account first and fail
   * with a clear message instead of silently provisioning one. 'signup' (or
   * omitted, for backwards compatibility) keeps today's auto-provisioning
   * behavior unchanged.
   */
  async signInWithIdToken(
    provider: 'google',
    idToken: string,
    intent?: 'signin' | 'signup',
  ) {
    if (intent === 'signin' && this.usersRepository) {
      const email = this.decodeEmailFromGoogleIdToken(idToken);
      if (email) {
        const existing = await this.usersRepository.findOne({
          where: { email: email.toLowerCase() },
          select: { id: true },
        });
        if (!existing) {
          throw new NotFoundException(
            'No account found for this Google account. Tap "Create Account" to sign up first.',
          );
        }
      }
      // If the email claim couldn't be decoded, fall through to the normal
      // sign-in below rather than blocking — same fail-open reasoning as
      // the decode helper's own doc comment.
    }

    const { data, error } = await this.supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  // ==================== Token Validation ====================

  async verifyAccessToken(token: string): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return data.user;
  }

  // ==================== Session Management ====================

  async refreshSession(refreshToken: string) {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signOut(accessToken: string) {
    // Revoke the session
    const { error } = await this.supabase.auth.admin.signOut(accessToken);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Signed out successfully' };
  }

  // ==================== User Management ====================

  // NOTE: `updateUser(userId, updates)` was removed alongside its only caller,
  // `POST /auth/update`. It forwarded a free-form `updates` object — including
  // `data` (Supabase `user_metadata`) and `email` — into the service-role admin
  // client with no whitelist, so it could set arbitrary metadata and bypass
  // email verification. Anything needing an admin-side user write should take a
  // validated DTO and whitelist the fields explicitly.

  async getUserById(userId: string) {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data.user;
  }

  async deleteUser(userId: string) {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'User deleted successfully' };
  }

  /**
   * Re-authenticate an email/password account by its current password. Used as
   * a strict gate before irreversible actions (e.g. account deletion) so a
   * leaked/stolen access token alone can't trigger them. Same technique as
   * updatePassword() above — sign in with the credentials and reject on error.
   */
  async verifyPassword(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new UnauthorizedException('Password is incorrect');
    }
  }

  // ==================== Password Management ====================

  async sendPasswordResetEmail(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${this.configService.get('FRONTEND_URL')}/reset-password`,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Password reset email sent' };
  }

  async updatePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string,
  ) {
    // First verify the token
    const user = await this.verifyAccessToken(accessToken);

    if (!user.email) {
      throw new BadRequestException('This account has no password to change.');
    }

    // Re-authenticate with the CURRENT password before allowing a change.
    // A stolen/leaked access token must not be enough to silently reset the
    // password and lock the owner out.
    const { error: pwError } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (pwError) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password
    const { error } = await this.supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Password updated successfully' };
  }

  // ==================== Email Verification ====================

  async sendVerificationEmail(email: string) {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${this.configService.get('FRONTEND_URL')}/otp-callback`,
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { message: 'Verification email sent' };
  }

  // ==================== Truecaller Auth ====================

  /**
   * The name to show for a Truecaller account.
   *
   * Supabase user_metadata carried only first_name/last_name, and every
   * consumer that wants a display name reads full_name/name and then falls
   * back to the email local part. For these accounts that email is the
   * internal `<digits>@truecaller.temp`, so the fallback rendered the user's
   * MOBILE NUMBER as their name. Writing full_name here fixes it at the
   * source, for every reader.
   *
   * Returns undefined rather than a placeholder when Truecaller gave us no
   * name at all, so we never overwrite a good stored name with "User".
   */
  private truecallerDisplayName(profile: {
    firstName?: string;
    lastName?: string;
  }): string | undefined {
    const full = [profile.firstName, profile.lastName]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' ');
    // 'User' is the controller's placeholder for "Truecaller sent no name";
    // it is not a name and must not be stored as one.
    return full && full !== 'User' ? full : undefined;
  }

  async signInWithTruecaller(profile: {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
  }) {
    // Canonicalize the verified phone to ONE stored form (digits incl. country
    // code, no '+') so every Truecaller path resolves to the SAME users.phone.
    // One-tap's OIDC userinfo returns e.g. "917010133018" while the missed-call
    // endpoint returns "+917010133018"; without this the same person creates
    // two accounts and the second login collides on the internal email.
    const phone = String(profile.phoneNumber ?? '').replace(/\D/g, '');

    // The internal, phone-derived login email. Note this has ALWAYS been
    // digit-only (the pre-canonicalization code stripped non-digits when
    // building it), which is what makes it a reliable second lookup key below.
    const tempEmail = `${phone}@truecaller.temp`;

    // 1. Find the existing account.
    //
    // Primary key is the canonical phone. But canonicalization only arrived
    // recently: rows created before it stored the phone exactly as the SDK
    // returned it, so a missed-call signup left `users.phone = '+9170...'`
    // while one-tap now looks up '9170...'. That lookup misses, we fall through
    // to createUser, and Supabase rejects the ALREADY-TAKEN internal email —
    // surfacing to the user as "account already exists" while they are simply
    // logging in. That is the bug this second lookup fixes.
    //
    // Matching on `tempEmail` is NOT the account-takeover risk described below:
    // that email is DERIVED from the Truecaller-verified phone, never from the
    // profile's self-asserted `email`. It is the same identity, written down
    // differently.
    //
    // maybeSingle(), not single(): single() errors on zero rows AND on
    // duplicates, so a user who managed to create two rows before
    // canonicalization would get an opaque failure instead of being logged in.
    let existingUser: any = null;
    {
      const { data: byPhone } = await this.supabaseData
        .from('users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      existingUser = byPhone ?? null;
    }
    if (!existingUser) {
      const { data: byInternalEmail } = await this.supabaseData
        .from('users')
        .select('*')
        .eq('email', tempEmail)
        .maybeSingle();
      existingUser = byInternalEmail ?? null;
    }

    if (existingUser) {
      // 2a. Existing user — verify the phone, and HEAL the stored form so the
      // next login hits the fast path above instead of relying on the fallback.
      await this.supabaseData
        .from('users')
        .update({
          phone,
          phone_verified: true,
          auth_provider: 'truecaller',
        })
        .eq('id', existingUser.id);

      return this.createSessionForUser(existingUser.id, profile);
    }

    // SECURITY (account-takeover fix): we intentionally do NOT link a
    // Truecaller login to an existing account by email. Truecaller profile
    // emails are self-asserted and NOT ownership-verified, so matching on
    // them would let an attacker set their profile email to a victim's
    // address and be handed the victim's session. Truecaller identity is
    // the *verified phone number* only (branch 1 above). A user who wants
    // their phone linked to an existing email account must do so through an
    // authenticated, email-verified flow — never implicitly here.

    // 3. Create new user, keyed on the verified phone (Requirement 11.4).
    // `tempEmail` above is the phone-derived internal email — never the
    // profile's unverified email — so an attacker can't pre-squat a victim's
    // address in auth.users (which enforces email uniqueness regardless of
    // confirmation) and lock them out of a future signup.

    const { data: newUser, error: createError } =
      await this.supabase.auth.admin.createUser({
        email: tempEmail,
        phone,
        password: crypto.randomUUID(),
        email_confirm: false,
        phone_confirm: true,
        user_metadata: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          // Without full_name every display-name reader falls through to the
          // email local part, which for these accounts is the phone number.
          full_name: this.truecallerDisplayName(profile),
          avatar_url: profile.avatarUrl,
          provider: 'truecaller',
          phone_verified: true,
        },
      });

    if (createError) {
      // Supabase infra failure (outage, rate limit, etc.), not a client
      // validation error — a 5xx here keeps it visible to monitoring
      // instead of being remapped to a misleading 401 by
      // TruecallerInvalidRequestFilter (which only catches
      // BadRequestException).
      throw new ServiceUnavailableException(createError.message);
    }

    // The auth user now exists. From this point on, ANY failure must
    // delete it via supabase.auth.admin.deleteUser(authUserId) so the
    // system never holds an auth user without a corresponding users
    // row. This rollback is required by the design's
    // "Failure-mode considerations" section and is a corollary of
    // Property 8 (idempotence): leaving an orphan auth user would
    // break the next call's phone-match branch because Supabase
    // would reject re-creation of the same phone or email.
    const newAuthUserId = newUser.user.id;
    try {
      // The `handle_new_user` trigger (supabase_setup.sql) already mirrored the
      // new auth.users row into public.users on createUser above — but it does
      // NOT copy `phone`. A plain INSERT here therefore collides with that
      // trigger-created row on the primary key (duplicate key on users.id),
      // which previously made EVERY new Truecaller signup fail and roll back.
      // UPSERT on the id instead: update the trigger row to add the verified
      // phone (and Truecaller-specific fields), or insert it if no trigger ran.
      const { error: dbError } = await this.supabaseData.from('users').upsert(
        {
          id: newAuthUserId,
          // Store the phone-derived internal email, not the unverified
          // profile email (public.users.email is NOT NULL). The real
          // email stays unset until the user verifies one.
          email: tempEmail,
          phone,
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: profile.avatarUrl,
          auth_provider: 'truecaller',
          phone_verified: true,
          email_verified: false,
        },
        { onConflict: 'id' },
      );

      if (dbError) {
        // Same reasoning as createError above — surface DB outages as
        // 5xx, not a masked 401.
        throw new ServiceUnavailableException(dbError.message);
      }
    } catch (insertErr) {
      // Best-effort rollback. We deliberately swallow rollback
      // failures: the original insert error is more useful to the
      // caller, and any leftover orphan auth user can be reaped by
      // a follow-up admin job. We do NOT log the failed delete in
      // production at the phone-number level — Requirement 13.1.
      try {
        await this.supabase.auth.admin.deleteUser(newAuthUserId);
      } catch {
        // Intentionally ignored — see comment above.
      }
      throw insertErr;
    }

    // The auth user + users row both exist now — mint a real session the
    // same way the existing-user branches do.
    const session = await this.mintSession(tempEmail);
    return { user: newUser.user, session };
  }

  /**
   * Link a Truecaller-verified phone number to an ALREADY-authenticated user
   * (the safe cross-provider linking path). Unlike sign-in, the caller's
   * identity comes from their session (`userId`), and the Truecaller flow only
   * proves ownership of the phone number being attached.
   *
   * Guard: the verified phone must not already belong to a DIFFERENT account,
   * otherwise linking it here would either hijack that account's login key or
   * create two rows that both claim the same phone. That case returns 409 so
   * the client can tell the user to sign in with that number instead.
   */
  async linkTruecallerToUser(
    userId: string,
    profile: {
      phoneNumber: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    },
  ) {
    const { data: phoneOwner } = await this.supabaseData
      .from('users')
      .select('id')
      .eq('phone', profile.phoneNumber)
      .maybeSingle();

    if (phoneOwner && phoneOwner.id !== userId) {
      throw new ConflictException(
        'This phone number is already linked to another account.',
      );
    }
    if (phoneOwner && phoneOwner.id === userId) {
      // Already linked to this user — idempotent success.
      return { linked: true as const, phoneNumber: profile.phoneNumber };
    }

    const update: Record<string, unknown> = {
      phone: profile.phoneNumber,
      phone_verified: true,
    };
    if (profile.avatarUrl) update.avatar_url = profile.avatarUrl;

    const { error } = await this.supabaseData
      .from('users')
      .update(update)
      .eq('id', userId);
    if (error) throw new ServiceUnavailableException(error.message);

    return { linked: true as const, phoneNumber: profile.phoneNumber };
  }

  /**
   * Redeem an admin-generated magic link into a real session server-side.
   * `admin.generateLink` never returns a live session (its `action_link` is
   * always populated), so the only way to mint one out-of-band is to verify
   * the link's `hashed_token` through the public `verifyOtp` API — the
   * documented Supabase pattern for admin-issued sign-in.
   */
  private async mintSession(email: string) {
    const { data: linkData, error: linkError } =
      await this.supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    if (linkError) {
      throw new ServiceUnavailableException(linkError.message);
    }

    const { data: verifyData, error: verifyError } =
      await this.supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

    if (verifyError || !verifyData.session) {
      throw new ServiceUnavailableException(
        verifyError?.message ?? 'Failed to create session',
      );
    }

    return verifyData.session;
  }

  private async createSessionForUser(
    userId: string,
    profile: { firstName: string; lastName?: string; avatarUrl?: string },
  ) {
    // Update user metadata
    const { data, error } = await this.supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          // Backfills full_name for accounts created before it was written,
          // so an existing user stops seeing their phone number as a name
          // from their very next login.
          full_name: this.truecallerDisplayName(profile),
          avatar_url: profile.avatarUrl,
          provider: 'truecaller',
        },
      },
    );

    if (error) {
      // Supabase infra failure, not client validation — surface as 5xx
      // (see createError/dbError above).
      throw new ServiceUnavailableException(error.message);
    }

    const userEmail = data.user.email ?? '';
    if (!userEmail) {
      throw new BadRequestException('User email is required to create session');
    }

    const session = await this.mintSession(userEmail);
    return { user: data.user, session };
  }

  // ==================== Helpers ====================

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
