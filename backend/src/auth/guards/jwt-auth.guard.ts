import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private reflector: Reflector,
    configService: ConfigService,
  ) {
    // Build a self-contained Supabase admin client.
    // ConfigService is globally available — no circular-dependency risk.
    const url = configService.get<string>('SUPABASE_URL') ?? '';
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log(`[PUBLIC] ${method} ${url} — skipping auth`);
      return true;
    }

    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[NO AUTH HEADER] ${method} ${url} — missing Authorization header`,
      );
      throw new UnauthorizedException('No bearer token provided');
    }

    const token = authHeader.substring(7);
    // Hot-path: keep verification quiet by default. No email (PII) in logs
    // and no per-request "[AUTH OK]" spam — only the user id, at debug level.
    this.logger.debug(
      `[GUARD] ${method} ${url} — verifying via supabase.auth.getUser() (alg-agnostic)`,
    );

    try {
      // supabase.auth.getUser() validates the JWT on Supabase's servers.
      // Works for both HS256 (legacy) and ES256 (new projects) automatically.
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedException(
          error?.message ?? 'Invalid or expired token',
        );
      }

      const supabaseUser = data.user;
      this.logger.debug(`[GUARD] token valid — sub: ${supabaseUser.id}`);

      // `accountType` is deliberately NOT attached. It used to be read off
      // client-mutable Supabase user_metadata and gated exactly one endpoint
      // (farm creation). Leaving it off `req.user` means nothing can
      // accidentally authorize on it later — per-farm role via
      // FarmAccessService is the only authority.
      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };
      return true;
    } catch (err: any) {
      this.logger.error(`[UNAUTHORIZED] ${method} ${url} — ${err.message}`);
      throw new UnauthorizedException(
        err.message || 'Invalid or expired token',
      );
    }
  }
}
