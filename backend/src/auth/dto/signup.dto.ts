import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Server-side validation for POST /auth/supabase/signup.
 *
 * Enforces email format and password strength at the trust boundary — the
 * signup handler previously took an untyped inline body, so the global
 * ValidationPipe validated nothing and weak passwords / malformed emails
 * reached Supabase unchecked. Name/username stay lenient to match
 * what the app sends (whitelist:true strips anything extra).
 */
export class SignupDto {
  @IsEmail()
  email: string;

  // Requires ≥1 lowercase, ≥1 uppercase, ≥1 digit, and ≥1 special character.
  // "Special" = any character that is not an ASCII letter or digit ([^A-Za-z0-9])
  // — the broadest printable-symbol set, so common passwords like "MyPass#123"
  // (# was previously rejected) are accepted. The frontend validator must mirror
  // this exact rule. (min length is enforced separately by @MinLength(8).)
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (any non-letter, non-digit character such as # - _ . @ ! etc.)',
  })
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  /**
   * The farmer's UI language, stored in Supabase `user_metadata` so the auth
   * EMAIL TEMPLATES can branch on it — `{{ if eq .Data.language "ta" }}`.
   *
   * Supabase has one template per email type with no locale switching, so the
   * language has to travel with the user or every farmer gets English. Absent
   * or unrecognised falls through to English, which is also what every account
   * created before this field existed will do.
   *
   * Constrained to the six locales the app ships. Anything else is rejected
   * rather than stored: this string is interpolated into a Go template
   * comparison, and an open string field there is not something to be relaxed
   * about.
   */
  @IsOptional()
  @IsIn(['en', 'hi', 'bn', 'ta', 'te', 'or'])
  language?: string;

  // NOTE: no `accountType`. It was a global owner/worker flag stored in
  // Supabase user_metadata that gated exactly one endpoint (farm creation)
  // and contradicted the per-farm role model. Signup intent is now a UI-only
  // preference — see RegisterScreen — and never becomes an auth claim.
}
