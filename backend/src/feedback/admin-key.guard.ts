import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

export const ADMIN_KEY_HEADER = 'x-admin-key';

/**
 * Shared-secret gate for the staff feedback endpoints.
 *
 * There is no staff account model in this app and inventing one to read a
 * support inbox would be a whole authentication feature nobody asked for. The
 * admin dashboard is a server-rendered internal tool: it holds ADMIN_API_KEY
 * as a server-only env var and calls this API from route handlers, so the key
 * never reaches a browser.
 *
 * Two things this guard must get right:
 *
 *  - If ADMIN_API_KEY is unset, DENY. The tempting alternative — "no key
 *    configured, so skip the check" — turns a forgotten Render env var into a
 *    public support inbox containing farmers' photos.
 *  - Compare in constant time. The endpoints are reachable from the internet
 *    and a plain `===` on a secret leaks it a byte at a time to anyone patient.
 *
 * The controllers using this are marked @Public() so the global JwtAuthGuard
 * lets them through — @Public() means "no farmer JWT", not "no auth", and this
 * guard is the auth.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!expected) {
      this.logger.error(
        'ADMIN_API_KEY is not set — refusing every admin feedback request.',
      );
      throw new UnauthorizedException('Admin API is not configured');
    }

    const req = context.switchToHttp().getRequest();
    const header = req.headers?.[ADMIN_KEY_HEADER];
    const provided = Array.isArray(header) ? header[0] : header;

    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
      this.logger.warn(
        `[ADMIN DENIED] ${req.method} ${req.url} — bad or missing ${ADMIN_KEY_HEADER}`,
      );
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}

/**
 * Constant-time string compare. `timingSafeEqual` throws on a length mismatch,
 * which would itself leak the key's length, so the lengths are compared first
 * and a mismatch still walks the full comparison against the expected value.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Burn the same work so the failure is not measurably faster.
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
