import { webcrypto } from 'crypto';
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { useGlobalExceptionFilters } from './common/filters';
import { assertSchemaReady } from './common/schema-guard';
import { assertCorsOriginAllowed } from './common/cors-guard';
import { initSentry, Sentry } from './common/sentry';

import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  // Init before anything else so early failures are captured (no-op w/o DSN).
  const sentryOn = initSentry();

  const app = await NestFactory.create(AppModule);

  // Security response headers (HSTS, X-Content-Type-Options, frameguard, …).
  // Defaults are safe for a JSON API — no HTML is served, so CSP is a no-op.
  app.use(helmet());

  // Behind Render's reverse proxy, trust the X-Forwarded-For chain so
  // ThrottlerGuard (and req.ip generally) keys by real client IP instead of
  // the proxy's IP for every request — otherwise all users share one bucket.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Fail fast (with a loud log) if the DB schema is missing — prevents the
  // app from limping into per-request "relation does not exist" errors after
  // a fresh-DB deploy where migrations did not run.
  await assertSchemaReady(app.get(DataSource));

  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  // Refuse to boot in production with a wildcard origin (CORS-1).
  assertCorsOriginAllowed(process.env.NODE_ENV, corsOrigin);
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: corsOrigin !== '*',
  });
  /**
   * Everything is under /api EXCEPT the public invite landing page.
   *
   * That page is a link a farm worker taps in WhatsApp, so it has to read like
   * a web address and not like an API call: `upcheck.in/join/ABCD2345`. See
   * JoinLandingController.
   */
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'join/:code', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  useGlobalExceptionFilters(app);

  // Run onModuleDestroy/onApplicationShutdown hooks (e.g. close the DB pool)
  // when Render sends SIGTERM on deploy, instead of dropping in-flight work.
  app.enableShutdownHooks();

  // Last-resort crash safety: log and shut down gracefully rather than leaving
  // the process wedged in an undefined state.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception — shutting down:', err);
    Sentry.captureException(err);
    // captureException only queues; process.exit() would kill the process
    // before the transport ever sends it — losing exactly the crashes we most
    // want to see. Flush first, with a bounded wait so a wedged network can
    // not stop us from exiting.
    void Sentry.close(2000)
      .then(() => app.close())
      .finally(() => process.exit(1));
  });

  const port = process.env.PORT ?? 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on 0.0.0.0:${port}`);
  console.log(`CORS origin: ${corsOrigin}`);
  console.log(
    `Sentry error tracking: ${sentryOn ? 'on' : 'off (no SENTRY_DSN)'}`,
  );
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
