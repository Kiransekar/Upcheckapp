import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  UnauthorizedException,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  UseFilters,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  TruecallerService,
  VerifiedTruecallerProfile,
} from './truecaller.service';
import { TwoFactorService } from './two-factor.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/auth.decorators';
import { TruecallerAuthDto } from './dto/truecaller-auth.dto';
import { TruecallerOAuthExchangeDto } from './dto/truecaller-oauth-exchange.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { Login2faDto } from './dto/login-2fa.dto';
import { Reset2faCheckDto } from './dto/reset-2fa-check.dto';
import { LoginOtpRequestDto, LoginOtpVerifyDto } from './dto/login-otp.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SignupDto } from './dto/signup.dto';
import { ChangePasswordDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import type { User } from '@supabase/supabase-js';

// L2: tighter per-endpoint rate limits for credential-guessing surfaces
// (the global guard is a coarse 60/min/IP for everything).
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const SENSITIVE_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

const TWO_FA_TEMP_PREFIX = 'auth:2fa:temp:';
const TWO_FA_TEMP_TTL_SECONDS = 300;
const TWO_FA_MAX_ATTEMPTS = 5;

/**
 * Method-level validation pipe for {@link SupabaseAuthController.truecallerOAuth}.
 *
 * The default global `ValidationPipe` translates DTO failures into HTTP 400
 * `BadRequestException`, but Requirement 13.4 mandates that
 * `POST /auth/supabase/oauth/truecaller` responds with HTTP 401 and the
 * body `{ success: false, message: 'Invalid request' }` for *every*
 * malformed body (including the class-level XOR invariant in
 * {@link TruecallerAuthDto}). Overriding `exceptionFactory` here keeps
 * that mapping local to the Truecaller route without affecting any other
 * endpoint, and crucially does not echo the offending field's value back
 * to the caller.
 */
const truecallerValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  exceptionFactory: () =>
    new UnauthorizedException({
      success: false,
      message: 'Invalid request',
    }),
});

/**
 * Route-scoped exception filter that maps any `BadRequestException` raised
 * during request handling into the Requirement 13.4 envelope.
 *
 * Why this filter exists: Nest's pipe-resolution order applies *global*
 * pipes before parameter-level pipes, so the global `ValidationPipe`
 * registered in `main.ts` will throw a default `BadRequestException`
 * (HTTP 400) the moment DTO validation fails — long before the
 * `truecallerValidationPipe` above gets a chance to substitute its 401
 * envelope. The param-level pipe alone is therefore not sufficient to
 * satisfy Requirement 13.4 in production.
 *
 * The filter does not include any details from the underlying exception
 * (`response.message`, `response.errors`, etc.) so the offending field's
 * value cannot leak into the response — also a Requirement 13.4
 * obligation.
 */
@Catch(BadRequestException)
export class TruecallerInvalidRequestFilter implements ExceptionFilter {
  catch(_exception: BadRequestException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    response.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid request',
    });
  }
}

@Controller('auth/supabase')
export class SupabaseAuthController {
  constructor(
    private supabaseAuthService: SupabaseAuthService,
    private truecallerService: TruecallerService,
    private twoFactorService: TwoFactorService,
    private redisService: RedisService,
  ) {}

  // ==================== Email/Password Auth ====================

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('signup')
  async signup(@Body() body: SignupDto) {
    const { email, password, firstName, lastName, username, accountType } =
      body;

    // Default to 'owner' if the client omits it — owners are the gated flow
    // (first-run farm setup); workers go straight to the dashboard.
    const account_type: 'owner' | 'worker' =
      accountType === 'worker' ? 'worker' : 'owner';

    const result = await this.supabaseAuthService.signUp(email, password, {
      firstName,
      lastName,
      username,
      account_type,
    });

    return {
      message:
        'Registration successful. Please check your email for verification.',
      user: this.sanitizeUser(result.user),
      session: result.session,
    };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signin')
  async signin(@Body() body: { email: string; password: string }) {
    const { email, password } = body;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.supabaseAuthService.signIn(email, password);
    return this.issueSessionOrChallenge(result, 'Login successful');
  }

  /**
   * Shared post-authentication gate applied to EVERY login path (password,
   * email-OTP, Google, Truecaller). If the account has TOTP 2FA enabled no
   * session is returned — it is stashed under a short-lived temp token and a
   * code is required via POST /auth/supabase/2fa/login. Previously this gate
   * lived only in `signin`, so 2FA was silently bypassable via the OTP,
   * Google, and Truecaller login paths.
   */
  private async issueSessionOrChallenge(
    result: { user: User | null; session: any },
    successMessage: string,
  ) {
    if (
      result.user &&
      (await this.twoFactorService.isEnabled(result.user.id))
    ) {
      const tempToken = randomUUID();
      await this.redisService.set(
        `${TWO_FA_TEMP_PREFIX}${tempToken}`,
        JSON.stringify({ userId: result.user.id, session: result.session }),
        'EX',
        TWO_FA_TEMP_TTL_SECONDS,
      );
      return { requires2FA: true, tempToken };
    }
    return {
      message: successMessage,
      user: this.sanitizeUser(result.user),
      session: result.session,
    };
  }

  /**
   * L3: strip `identities` from the Supabase user before returning it to the
   * client — it can carry linked-provider identity data the app never uses
   * (the frontend reads only id/email/phone/user_metadata/app_metadata).
   */
  private sanitizeUser(user: User | null) {
    if (!user) return user;
    const { identities, ...safe } = user as any;
    return safe;
  }

  // ==================== Passwordless email OTP login ====================

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('login-otp/request')
  @HttpCode(HttpStatus.OK)
  async requestLoginOtp(@Body() body: LoginOtpRequestDto) {
    return this.supabaseAuthService.sendEmailOtp(body.email);
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('login-otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyLoginOtp(@Body() body: LoginOtpVerifyDto) {
    const result = await this.supabaseAuthService.verifyEmailOtp(
      body.email,
      body.otp,
    );
    return this.issueSessionOrChallenge(result, 'Login successful');
  }

  // ==================== Two-factor authentication (TOTP) ====================

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  async twoFactorLogin(@Body() body: Login2faDto) {
    const key = `${TWO_FA_TEMP_PREFIX}${body.tempToken}`;
    const raw = await this.redisService.get(key);
    if (!raw) {
      throw new UnauthorizedException(
        '2FA challenge expired or invalid. Please sign in again.',
      );
    }
    const { userId, session } = JSON.parse(raw);
    // Accept a TOTP code OR a single-use backup code (AUTH-4).
    const ok = await this.twoFactorService.verifyCodeOrBackup(
      userId,
      body.token,
    );
    if (!ok) {
      // Cap attempts so a captured tempToken can't be brute-forced for the
      // full TTL. Counted in a sibling key so the challenge's own expiry
      // is never extended by a retry.
      const attemptsKey = `${key}:attempts`;
      const attempts =
        parseInt((await this.redisService.get(attemptsKey)) ?? '0', 10) + 1;
      if (attempts >= TWO_FA_MAX_ATTEMPTS) {
        await this.redisService.del(key);
        await this.redisService.del(attemptsKey);
        throw new UnauthorizedException(
          'Too many incorrect codes. Please sign in again.',
        );
      }
      await this.redisService.set(
        attemptsKey,
        String(attempts),
        'EX',
        TWO_FA_TEMP_TTL_SECONDS,
      );
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.redisService.del(key);
    await this.redisService.del(`${key}:attempts`);
    return { message: 'Login successful', session };
  }

  /**
   * AUTH-2: gate the password-reset flow behind 2FA.
   *
   * `ResetPasswordScreen` sets a live Supabase recovery session straight from
   * the deep-link tokens and updates the password without ever touching the
   * login 2FA gate. After the update the client calls this endpoint with the
   * recovery tokens: if the account has 2FA enabled we stash the recovery
   * session under a temp token (identical machinery to
   * {@link issueSessionOrChallenge}) and demand a code via POST /2fa/login — so
   * an attacker with only email access cannot enter the app. Non-2FA accounts
   * get `{ requires2FA: false }` and proceed unchanged.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-2fa-check')
  @HttpCode(HttpStatus.OK)
  async reset2faCheck(@Body() body: Reset2faCheckDto) {
    const user = await this.supabaseAuthService.verifyAccessToken(
      body.accessToken,
    );
    if (!(await this.twoFactorService.isEnabled(user.id))) {
      return { requires2FA: false };
    }
    const tempToken = randomUUID();
    // Stash the recovery session in the SAME shape twoFactorLogin reads, so
    // that path can hand it back verbatim once the code is verified.
    const session = {
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
      token_type: 'bearer',
      user,
    };
    await this.redisService.set(
      `${TWO_FA_TEMP_PREFIX}${tempToken}`,
      JSON.stringify({ userId: user.id, session }),
      'EX',
      TWO_FA_TEMP_TTL_SECONDS,
    );
    return { requires2FA: true, tempToken };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('2fa/setup')
  async twoFactorSetup(@CurrentUser() user) {
    return this.twoFactorService.setup(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('2fa/enable')
  async twoFactorEnable(@CurrentUser() user, @Body() body: Enable2faDto) {
    return this.twoFactorService.enable(user.id, body.token);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('2fa/disable')
  async twoFactorDisable(@CurrentUser() user, @Body() body: Disable2faDto) {
    return this.twoFactorService.disable(user.id, body.token);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('2fa/backup-codes/regenerate')
  async regenerateBackupCodes(@CurrentUser() user, @Body() body: Enable2faDto) {
    return this.twoFactorService.regenerateBackupCodes(user.id, body.token);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('2fa/status')
  async twoFactorStatus(@CurrentUser() user) {
    return this.twoFactorService.status(user.id);
  }

  // ==================== OAuth ====================

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('oauth/google')
  async googleOAuth(
    @Body() body: { idToken: string; intent?: 'signin' | 'signup' },
  ) {
    const { idToken, intent } = body;

    if (!idToken) {
      throw new BadRequestException('ID token is required');
    }

    const result = await this.supabaseAuthService.signInWithIdToken(
      'google',
      idToken,
      intent,
    );
    return this.issueSessionOrChallenge(
      result,
      'Google authentication successful',
    );
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('oauth/truecaller')
  // Requirement 11.5: response status MUST match POST /auth/supabase/signin,
  // which returns HTTP 200. Without this Nest defaults POST to 201, which
  // would silently break the parity required by the spec.
  @HttpCode(HttpStatus.OK)
  // Requirement 13.4: validation failures (whether raised by the global
  // pipe or anywhere downstream of it) must surface as HTTP 401 with
  // `{ success: false, message: 'Invalid request' }`. The route-scoped
  // filter intercepts any BadRequestException reaching the handler and
  // translates it into that envelope, regardless of which pipe raised
  // it. UnauthorizedException raised by the verifier or the
  // method-level pipe is intentionally NOT caught here so the
  // verifier's spec messages (Requirements 9.x / 10.x) pass through
  // unchanged.
  @UseFilters(TruecallerInvalidRequestFilter)
  async truecallerOAuth(
    @Body(truecallerValidationPipe) body: TruecallerAuthDto,
  ) {
    const {
      payload,
      signature,
      signatureAlgorithm,
      requestNonce,
      accessToken,
      phoneNumber,
    } = body;

    // Belt-and-suspenders: the DTO already enforces XOR on
    // accessToken/payload via the class-level constraint, but the
    // controller still re-checks the discriminator before dispatching
    // so a bug in the DTO cannot slip an unverified body through to
    // signInWithTruecaller. Both branches throw 401 with the
    // Requirement 13.4 message via the validation pipe above; this
    // residual check covers the case where validation has been
    // bypassed (e.g., direct method invocation in tests).
    // `isMissedCall` distinguishes the two credential channels. For the
    // missed-call/OTP flow the display name is NOT part of the verified
    // Truecaller response (the phoneNumberDetail endpoint returns only the
    // phone number), so — and only here — the user-entered firstName/lastName
    // from the request body are carried through. This is safe because the
    // phone number remains the sole server-verified identity used for lookup
    // and linking; the name is cosmetic profile data, never an auth key.
    const isMissedCall = !payload && !!accessToken;
    let verifiedProfile: VerifiedTruecallerProfile;
    if (payload) {
      // Flow A (One-Tap) and PROFILE_VERIFIED_BEFORE.
      // Verification failures bubble up as UnauthorizedException
      // with the exact spec messages from Requirements 9.3, 9.5,
      // 9.6, 9.7 — Nest maps that to HTTP 401 directly.
      verifiedProfile = await this.truecallerService.verifySignedPayload({
        payload,
        signature: signature ?? '',
        signatureAlgorithm: signatureAlgorithm ?? '',
        requestNonce: requestNonce ?? '',
      });
    } else if (accessToken) {
      // Flow B (OTP / missed-call). Failures throw with the exact
      // spec messages from Requirements 10.2, 10.3, 10.4.
      verifiedProfile = await this.truecallerService.verifyAccessToken(
        accessToken,
        phoneNumber,
      );
    } else {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid request',
      });
    }

    // Requirement 11.1: the phone number (the identity/linking key) is always
    // sourced from the *verified* Truecaller profile, never the request body.
    // For One-Tap the whole profile (name/email/avatar) is verified, so the
    // body is ignored entirely. For missed-call only the phone is verified, so
    // the user-entered name is accepted (see `isMissedCall` note above).
    const result = await this.supabaseAuthService.signInWithTruecaller({
      phoneNumber: verifiedProfile.phoneNumber,
      firstName:
        (isMissedCall && body.firstName) || verifiedProfile.firstName || 'User',
      lastName:
        (isMissedCall && body.lastName) || verifiedProfile.lastName,
      email: verifiedProfile.email,
      avatarUrl: verifiedProfile.avatarUrl,
    });

    // Requirement 11.5: response shape matches POST /auth/supabase/signin
    // (including the 2FA challenge branch).
    return this.issueSessionOrChallenge(
      result,
      'Truecaller authentication successful',
    );
  }

  /**
   * Truecaller OAuth 2.0 One-Tap exchange.
   *
   * The mobile SDK (`@dhana-cs/react-native-truecaller`) returns an
   * authorization code + PKCE `codeVerifier`; this endpoint completes the
   * server-to-server exchange and mints a Supabase session. This is the
   * current/working path — the legacy `POST oauth/truecaller` route above
   * (signed payload / OTP access token) is retained for backwards
   * compatibility only.
   *
   * Identity fields come solely from Truecaller's verified userinfo
   * response, never from the request body.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('oauth/truecaller/exchange')
  @HttpCode(HttpStatus.OK)
  @UseFilters(TruecallerInvalidRequestFilter)
  async truecallerOAuthExchange(
    @Body(truecallerValidationPipe) body: TruecallerOAuthExchangeDto,
  ) {
    const verifiedProfile = await this.truecallerService.verifyOAuthCode(
      body.authorizationCode,
      body.codeVerifier,
    );

    const result = await this.supabaseAuthService.signInWithTruecaller({
      phoneNumber: verifiedProfile.phoneNumber,
      firstName: verifiedProfile.firstName || 'User',
      lastName: verifiedProfile.lastName,
      email: verifiedProfile.email,
      avatarUrl: verifiedProfile.avatarUrl,
    });

    return this.issueSessionOrChallenge(
      result,
      'Truecaller authentication successful',
    );
  }

  // ==================== Truecaller account linking ====================
  // Authenticated: attach a Truecaller-verified phone to the CURRENT user.
  // The verified phone (never the request body) is the identity; a phone
  // already owned by another account returns 409 (ConflictException).

  @UseGuards(SupabaseAuthGuard)
  @Post('link/truecaller/exchange')
  @HttpCode(HttpStatus.OK)
  @UseFilters(TruecallerInvalidRequestFilter)
  async linkTruecallerOAuth(
    @CurrentUser() user: User,
    @Body(truecallerValidationPipe) body: TruecallerOAuthExchangeDto,
  ) {
    const verified = await this.truecallerService.verifyOAuthCode(
      body.authorizationCode,
      body.codeVerifier,
    );
    return this.supabaseAuthService.linkTruecallerToUser(user.id, {
      phoneNumber: verified.phoneNumber,
      firstName: verified.firstName,
      lastName: verified.lastName,
      avatarUrl: verified.avatarUrl,
    });
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('link/truecaller')
  @HttpCode(HttpStatus.OK)
  @UseFilters(TruecallerInvalidRequestFilter)
  async linkTruecallerMissedCall(
    @CurrentUser() user: User,
    @Body(truecallerValidationPipe) body: TruecallerAuthDto,
  ) {
    if (!body.accessToken) {
      // Only the missed-call (accessToken) channel is accepted here.
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid request',
      });
    }
    const verified = await this.truecallerService.verifyAccessToken(
      body.accessToken,
      body.phoneNumber,
    );
    return this.supabaseAuthService.linkTruecallerToUser(user.id, {
      phoneNumber: verified.phoneNumber,
      firstName: body.firstName || verified.firstName,
      lastName: body.lastName || verified.lastName,
    });
  }

  // ==================== Session Management ====================

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const { refreshToken } = body;

    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const result = await this.supabaseAuthService.refreshSession(refreshToken);

    return {
      message: 'Session refreshed',
      user: result.user,
      session: result.session,
    };
  }

  @Post('signout')
  @UseGuards(SupabaseAuthGuard)
  async signout(@Req() request: any) {
    const token = request.headers.authorization?.substring(7); // Remove 'Bearer '

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    return await this.supabaseAuthService.signOut(token);
  }

  // ==================== User Management ====================

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getCurrentUser(@CurrentUser() user: User) {
    return {
      user,
    };
  }

  @Post('update')
  @UseGuards(SupabaseAuthGuard)
  async updateUser(
    @CurrentUser() user: User,
    @Body() body: { email?: string; password?: string; data?: any },
  ) {
    const updatedUser = await this.supabaseAuthService.updateUser(
      user.id,
      body,
    );

    return {
      message: 'User updated successfully',
      user: updatedUser,
    };
  }

  // ==================== Password Management ====================

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const { email } = body;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    return await this.supabaseAuthService.sendPasswordResetEmail(email);
  }

  @Post('update-password')
  @UseGuards(SupabaseAuthGuard)
  async updatePassword(@Req() request: any, @Body() body: ChangePasswordDto) {
    const token = request.headers.authorization?.substring(7);
    return await this.supabaseAuthService.updatePassword(
      token,
      body.currentPassword,
      body.newPassword,
    );
  }

  // ==================== Email Verification ====================

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('resend-verification')
  async resendVerification(@Body() body: ResendVerificationDto) {
    const { email } = body;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    return await this.supabaseAuthService.sendVerificationEmail(email);
  }
}
