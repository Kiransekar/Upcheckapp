import {
  IsEmail,
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

  // NOTE: no `accountType`. It was a global owner/worker flag stored in
  // Supabase user_metadata that gated exactly one endpoint (farm creation)
  // and contradicted the per-farm role model. Signup intent is now a UI-only
  // preference — see RegisterScreen — and never becomes an auth claim.
}
