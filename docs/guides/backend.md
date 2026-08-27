# Backend Developer Guide

The Upcheck backend is a **NestJS 11** service (TypeORM + `pg`) that talks to a
**Supabase Postgres** database and uses **Redis** for short-lived auth state
(2FA / Truecaller replay). Auth tokens are Supabase JWTs; every data request
flows through this API — the mobile client never touches the database directly.

Related docs:
- [Database & migrations](./database-migrations.md) — schema sources, the migration workflow, and the fresh-DB safety gate. **Read this before touching any entity.**
- [Auth & security](./auth-security.md)
- [Architecture](../ARCHITECTURE.md)
- [Operations](../OPERATIONS.md)

---

## 1. Project layout

Everything lives under `backend/src/`. Each domain is a self-contained NestJS
module folder following the same convention:

```
backend/src/
  main.ts                     # bootstrap: pipes, filters, CORS, schema guard
  app.module.ts               # root module — wires every feature module + global guards
  <feature>/
    <feature>.module.ts       # declares controllers/providers, imports deps
    <feature>.controller.ts   # HTTP routes, guards, decorators
    <feature>.service.ts      # business logic, repository access
    <feature>.entity.ts       # TypeORM entity (a DB table)
    <feature>.service.spec.ts # Jest unit tests
    dto/
      create-<feature>.dto.ts # class-validator input DTOs
      update-<feature>.dto.ts
  auth/                       # guards, decorators, Supabase auth, 2FA, Truecaller
  farm-access/                # the capability/role authorization model (see §4)
  common/                     # cross-cutting: guards, filters, decorators, schema-guard
  migrations/                 # TypeORM migration chain (see database-migrations.md)
```

Conventions worth knowing:
- **Entity column names are snake_case in the DB, camelCase in TS** — always set the explicit `name` in `@Column({ name: 'pond_id' })`. The DB is the contract.
- Services own all business logic; controllers stay thin (route → guard → delegate to service).
- Every module that owns a table calls `TypeOrmModule.forFeature([Entity])` and usually `exports` its service so sibling modules can inject it.

---

## 2. Walkthrough: the `sampling` module end-to-end

A single request — `POST /api/sampling` — touches all five files. This is the
canonical shape to copy.

### Entity — `sampling/sampling-data.entity.ts`
Maps the `sampling_data` table. Note the explicit column names, the
`@ManyToOne` relations to `Pond`/`Crop` with `onDelete` behaviour, and the
audit columns (`created_by_id` / `updated_by_id`):

```ts
@Entity('sampling_data')
export class SamplingData {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ name: 'pond_id', type: 'uuid' }) pondId: string;
  @ManyToOne(() => Pond, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pond_id' }) pond: Pond;
  // ... measurement columns ...
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true }) createdById: string | null;
}
```

### DTO — `sampling/dto/create-sampling.dto.ts`
Pure `class-validator` input contract. The optional client-minted `id` is the
offline-replay idempotency key (see §5):

```ts
export class CreateSamplingDto {
  @IsUUID() @IsOptional() id?: string;        // client idempotency key
  @IsUUID() pondId: string;
  @IsDateString() samplingDate: string;
  @IsNumber() @IsOptional() mbwG?: number;
  // ...
}
```

### Controller — `sampling/sampling.controller.ts`
Routes are grouped under `@Controller('sampling')` (the global `api` prefix
makes this `/api/sampling`). Each mutating route declares an ownership guard +
the capability it requires; the current user is injected with `@CurrentUser()`:

```ts
@Controller('sampling')
export class SamplingController {
  constructor(private readonly samplingService: SamplingService) {}

  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId')          // default cap: WRITE_OPERATIONAL
  create(@Body() dto: CreateSamplingDto, @CurrentUser() user) {
    return this.samplingService.create(dto, user.id);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('SamplingData', 'id', 'pond.farm.userId', 'READ')
  findOne(@Param('id') id: string) { return this.samplingService.findOne(id); }
}
```

### Service — `sampling/sampling.service.ts`
Injects the repository plus any collaborators (`PondsService`,
`FarmAccessService`). It re-checks access itself — guards protect single-record
routes, but **list/create logic must scope to accessible farms in the service**
(see §4):

```ts
async create(dto: CreateSamplingDto, userId: string) {
  if (dto.id) {                                   // idempotent replay guard
    const existing = await this.samplingRepository.findOne({ where: { id: dto.id } });
    if (existing) {
      await this.farmAccess.assertCanAccessPond(userId, existing.pondId, 'WRITE_OPERATIONAL');
      return existing;                            // safe insert-or-return
    }
  }
  const pond = await this.pondsService.findOneAccessible(dto.pondId, userId, 'WRITE_OPERATIONAL');
  const record = this.samplingRepository.create({ /* ... */ createdById: userId });
  return this.samplingRepository.save(record);
}
```

### Module — `sampling/sampling.module.ts`
Registers the entity, wires the controller/service, imports `PondsModule` for
`PondsService`, and exports its own service:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([SamplingData]), PondsModule],
  controllers: [SamplingController],
  providers: [SamplingService],
  exports: [SamplingService],
})
export class SamplingModule {}
```

`FarmAccessService` is **not** imported here — `FarmAccessModule` is `@Global`,
so it's injectable everywhere.

---

## 3. Adding a new feature module

1. `nest g module <feature> && nest g controller <feature> && nest g service <feature>` (or copy the sampling folder).
2. Write the entity (`<feature>.entity.ts`) with explicit snake_case column names, indexes on FK columns, and audit columns where records are user-authored. **A new entity means a schema change — you must generate a migration and enable RLS on the new table. See [database-migrations.md](./database-migrations.md).**
3. Write the DTOs under `dto/` using `class-validator`. Add an optional `@IsUUID() @IsOptional() id?` if the record is created from the offline queue.
4. In the module: `TypeOrmModule.forFeature([Entity])`, register the controller/service, import any module whose service you inject, and `exports: [YourService]` if others need it.
5. Guard mutating routes with `@UseGuards(OwnershipGuard)` + `@OwnsResource(...)` and pick the right capability (§4).
6. Scope every list/find query to accessible farms in the service (§4).
7. **Wire it into the root module**: add the module to the `imports` array in `backend/src/app.module.ts`. Nothing is auto-discovered — an unregistered module simply doesn't exist.
8. Add a `*.service.spec.ts` (§6).

---

## 4. Auth & authorization

### Global authentication — `JwtAuthGuard` + `@Public()`
`JwtAuthGuard` is registered as a global `APP_GUARD` in `app.module.ts`, so
**every route requires a valid Supabase bearer token by default.** The guard
calls `supabase.auth.getUser(token)` (works for both HS256 legacy and ES256 new
projects) and attaches `req.user = { id, email }`.

Opt a route out with the `@Public()` decorator (login, register, health, etc.):

```ts
import { Public } from '../auth/decorators/auth.decorators';

@Public()
@Post('login')
login(@Body() dto: LoginDto) { /* ... */ }
```

Read the authenticated user in a handler with `@CurrentUser()` (returns
`req.user`; `user.id` is the Supabase UID).

> There is also a `SupabaseAuthGuard` (`auth/guards/supabase-auth.guard.ts`)
> used locally by the auth controller via `verifyAccessToken`. For normal
> feature routes you rely on the **global** `JwtAuthGuard` — don't add a second
> auth guard.

Also global: `ThrottlerGuard` (60 req / 60 s per IP; `trust proxy` is set in
`main.ts` so it keys on the real client IP behind Render's proxy).

### Authorization — the capability model (`farm-access/`)
Everything in the app is scoped to a **farm**. A user's access to a farm is
one of four **roles**, and each route requires a **capability**. The mapping
lives in exactly one place — `farm-access/farm-capability.ts`:

| Capability | owner | manager | worker | viewer |
|---|:---:|:---:|:---:|:---:|
| `READ` | ✓ | ✓ | ✓ | ✓ |
| `WRITE_OPERATIONAL` (field/log writes) | ✓ | ✓ | ✓ | |
| `WRITE_MANAGEMENT` (ponds/cycles/tasks/treatments) | ✓ | ✓ | | |
| `VIEW_FINANCIALS` (costs, P&L, transactions) | ✓ | ✓ | | |
| `MANAGE_WORKERS` (invite/remove workers) | ✓ | ✓ | | |
| `OWNER_ONLY` (delete, transfer, role changes) | ✓ | | | |

`FarmAccessService` is the single source of truth. Its key methods:
- `getRoleOnFarm(userId, farmId)` → `FarmRole | null`
- `getAccessibleFarmIds(userId)` → all farms the user can see
- `getFarmIdsWithCapability(userId, cap)` → farms where the user's role satisfies `cap`
- `assertCanAccessFarm(userId, farmId, cap)` / `assertCanAccessPond(userId, pondId, cap)` → throw `Forbidden`/`NotFound` or return the entity

Two enforcement layers use it:

**Route layer** — `@UseGuards(OwnershipGuard)` + `@OwnsResource(entityType, paramName, ownerPath, capability)`.
The guard loads the resource by id, walks `ownerPath` (e.g. `'pond.farm.userId'`)
to find the owning farm, passes the direct owner immediately, and otherwise
resolves the caller's role and checks it against the capability.

**Service layer** — for list/create, guards can't scope a *set* of rows, so
the service must filter to accessible farms. **This is mandatory for every list
endpoint** — a missing scope is a cross-tenant leak:

```ts
async findAll(userId: string, cropId?: string) {
  const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
  if (farmIds.length === 0) return [];
  const qb = this.samplingRepository
    .createQueryBuilder('sampling')
    .innerJoin('sampling.pond', 'pond')
    .where('pond.farmId IN (:...farmIds)', { farmIds })
    .orderBy('sampling.samplingDate', 'DESC');
  if (cropId) qb.andWhere('sampling.cropId = :cropId', { cropId }); // filter, NOT the boundary
  return qb.getMany();
}
```

For financial lists use `getFarmIdsWithCapability(userId, 'VIEW_FINANCIALS')`
instead, so a worker's farms don't leak financial rows.

---

## 5. Validation, errors, and offline-replay idempotency

**Validation** — `main.ts` installs a global `ValidationPipe`:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // strips properties with no DTO decorator
  forbidNonWhitelisted: false,
  transform: true,           // coerces payloads into DTO class instances
}));
```

So DTOs are the input contract: only decorated fields survive, and types are
coerced. `whitelist` silently drops undeclared fields — if a client field isn't
persisting, check the DTO has a decorator for it. (See
`src/_e2e/create-dtos.validation.spec.ts`, which pushes realistic payloads
through the real pipe and asserts nothing is dropped.)

**Error handling** — `TypeORMExceptionFilter` (global, in `main.ts`) catches
`QueryFailedError` and maps Postgres codes to clean HTTP responses while logging
the raw pg detail **server-side only** (it can leak schema internals):
- `23505` unique violation → `409 Conflict`
- `23503` FK violation → `400`
- `23502` not-null violation → `400`

Business errors are thrown as ordinary Nest exceptions (`NotFoundException`,
`ForbiddenException`) from services/guards.

**Offline-replay idempotency** — the mobile app queues writes offline and
drains them later, so the same create can arrive twice. The pattern: the client
mints a UUID and sends it as the optional `id` on the create DTO. The service
does **insert-or-return**, but must re-verify access to the *found* record
before returning it (a replayed op with a guessed id must not leak another
farm's row):

```ts
if (dto.id) {
  const existing = await this.repo.findOne({ where: { id: dto.id } });
  if (existing) {
    await this.farmAccess.assertCanAccessPond(userId, existing.pondId, 'WRITE_OPERATIONAL');
    return existing;
  }
}
```

Some services additionally reject an id collision that lands on a *different*
parent (crop/pond) rather than returning it — see
`mortality/mortality.service.idempotency.spec.ts` for the IDOR guard cases.

---

## 6. Testing

Tests are **Jest + ts-jest**, colocated as `*.spec.ts` next to the code
(config lives in `backend/package.json` under `"jest"`, `rootDir: "src"`,
`testRegex: .*\.spec\.ts$`). There are ~58 unit specs plus e2e specs in
`backend/test/`. Coverage skews to the risky paths: authorization
(`farm-capability.spec.ts`, `jwt-auth.guard.spec.ts`), idempotency
(`*.idempotency.spec.ts`), calculations, the schema guard, and property-based
tests for Truecaller (`fast-check`).

Style: services are unit-tested with mocked repositories (a plain object with
`findOne`/`create`/`save` jest mocks via `getRepositoryToken(Entity)`) — no real
DB. See the mortality idempotency spec for the template.

```bash
cd backend
npm test                                   # all unit specs
npm test -- sampling                       # one suite by path fragment
npm run test:watch                         # watch mode
npm run test:cov                           # with coverage
npm run test:e2e                           # e2e specs in test/ (test/jest-e2e.json)
```

---

## 7. Local dev commands & environment

```bash
cd backend
npm install
npm run start:dev     # nest start --watch (hot reload)
npm run build         # nest build → dist/
npm run lint          # eslint --fix
npm run start:prod    # node dist/main
```

On boot, `main.ts` runs `assertSchemaReady()` (see
`common/schema-guard.ts`) — it fails fast if core tables are missing or RLS
wasn't applied, so a misconfigured DB won't limp along silently. The server
listens on `PORT` (default `8080`) under the global `/api` prefix.

**Minimum env to boot** (`backend/.env`; see `.env.example` for the full,
annotated list):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Supabase pooler on Render; see the migrations guide for the direct-vs-pooler rule) |
| `SUPABASE_URL` | Supabase project URL (used by `JwtAuthGuard`) |
| `SUPABASE_SERVICE_ROLE_KEY` | validates bearer tokens via `supabase.auth.getUser()` |
| `SUPABASE_ANON_KEY` | public, RLS-locked; auth only |
| `JWT_SECRET` | app JWT signing secret |
| `PORT` | listen port |
| `CORS_ORIGIN` | `*` for the mobile app |
| `REDIS_URL` | optional — 2FA/Truecaller store; falls back to in-memory if unset |
| `ADMIN_API_KEY` | shared secret for `/api/admin/feedback*`; unset ⇒ every admin request is denied |

`BREVO_API_KEY` (email), `GOOGLE_CLIENT_ID_*` (Google login) and `TRUECALLER_*`
are needed only for those specific flows.

`ADMIN_API_KEY` is only needed if the staff feedback dashboard (`admin/`, on
Vercel) is running — the same value goes in both places. See
[`admin/README.md`](../../admin/README.md).

> Anything that changes the **schema** (a new/edited entity, a new migration, a
> new table's RLS) is high-risk — follow
> [database-migrations.md](./database-migrations.md) exactly, and run
> `npm run verify:fresh-db` before you push.
