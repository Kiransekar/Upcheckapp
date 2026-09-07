import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { TypeORMExceptionFilter } from './typeorm-exception.filter';
import { SentryExceptionFilter } from './sentry-exception.filter';

export { TypeORMExceptionFilter, SentryExceptionFilter };

/**
 * ORDER MATTERS, and it is backwards from how it reads: Nest reverses this
 * list and takes the FIRST filter whose @Catch() list is empty or matches.
 * SentryExceptionFilter is @Catch() — it matches everything — so it must be
 * registered FIRST to end up LAST. Register it last and TypeORMExceptionFilter
 * never runs, and every duplicate-key comes back as a bare 500 instead of 409.
 *
 * Lives here rather than inline in main.ts so filters.spec.ts can exercise the
 * real order instead of a copy of it.
 */
export function useGlobalExceptionFilters(app: INestApplication): void {
  const httpAdapter = app.get(HttpAdapterHost).httpAdapter;
  app.useGlobalFilters(
    new SentryExceptionFilter(httpAdapter),
    new TypeORMExceptionFilter(),
  );
}
