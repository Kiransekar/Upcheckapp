/**
 * The global exception filters, wired exactly as main.ts wires them.
 *
 * Two things must hold at once and used to be in conflict:
 *   1. every 5xx reaches Sentry, and
 *   2. pg constraint violations (23505/23503/23502) come back as 409/400 with
 *      a friendly message instead of a bare 500.
 *
 * Nest reverses the useGlobalFilters() list and takes the FIRST filter whose
 * @Catch() list is empty or matches, so the catch-all Sentry filter has to be
 * registered BEFORE the @Catch(QueryFailedError) one — otherwise it wins every
 * match and the TypeORM filter is dead code.
 */
import {
  Controller,
  Get,
  INestApplication,
  HttpException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import request from 'supertest';

jest.mock('../sentry', () => ({
  Sentry: { captureException: jest.fn() },
  initSentry: jest.fn(),
}));

import { Sentry } from '../sentry';
import { useGlobalExceptionFilters } from './index';

const captured = Sentry.captureException as unknown as jest.Mock;

function pgError(code: string): QueryFailedError {
  const err = new QueryFailedError('INSERT ...', [], new Error('boom') as any);
  (err as any).code = code;
  (err as any).detail = 'Key (email)=(a@b.com) already exists.';
  return err;
}

@Controller('boom')
class BoomController {
  @Get('plain')
  plain() {
    throw new Error('kaboom');
  }
  @Get('http500')
  http500() {
    throw new HttpException('nope', 500);
  }
  @Get('http400')
  http400() {
    throw new HttpException('bad', 400);
  }
  @Get('dup')
  dup() {
    throw pgError('23505');
  }
  @Get('fk')
  fk() {
    throw pgError('23503');
  }
  @Get('notnull')
  notnull() {
    throw pgError('23502');
  }
  @Get('unmapped-query')
  unmappedQuery() {
    // e.g. 22P02 invalid uuid syntax — no friendly mapping, so it is a real
    // 500 and must still reach Sentry.
    throw pgError('22P02');
  }
}

describe('global exception filters', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication();
    // The real wiring main.ts uses — not a copy of it.
    useGlobalExceptionFilters(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => captured.mockClear());

  it('reports an unhandled error as a 500 to Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/plain');
    expect(res.status).toBe(500);
    expect(captured).toHaveBeenCalledTimes(1);
  });

  it('reports an explicit 500 HttpException to Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/http500');
    expect(res.status).toBe(500);
    expect(captured).toHaveBeenCalledTimes(1);
  });

  it('does not report a 4xx to Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/http400');
    expect(res.status).toBe(400);
    expect(captured).not.toHaveBeenCalled();
  });

  it('maps a duplicate key to 409 with a friendly message, no Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/dup');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'A record with this unique value already exists.',
    );
    expect(JSON.stringify(res.body)).not.toContain('a@b.com');
    expect(captured).not.toHaveBeenCalled();
  });

  it('maps a foreign key violation to 400, no Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/fk');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Related record not found (Foreign Key Violation).',
    );
    expect(captured).not.toHaveBeenCalled();
  });

  it('maps a not-null violation to 400, no Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/boom/notnull');
    expect(res.status).toBe(400);
    expect(captured).not.toHaveBeenCalled();
  });

  it('still reports an unmapped query failure — it is a real 500', async () => {
    const res = await request(app.getHttpServer()).get('/boom/unmapped-query');
    expect(res.status).toBe(500);
    expect(captured).toHaveBeenCalledTimes(1);
  });
});
