import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

import { ProfilesModule } from './profiles/profiles.module';
import { FarmAccessModule } from './farm-access/farm-access.module';
import { FarmMembersModule } from './farm-members/farm-members.module';
import { FarmsModule } from './farms/farms.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { PondsModule } from './ponds/ponds.module';
import { CropsModule } from './crops/crops.module';
import { WaterQualityModule } from './water-quality/water-quality.module';
import { FeedRecordsModule } from './feed-records/feed-records.module';
import { ShrimpCalculationsModule } from './shrimp-calculations/shrimp-calculations.module';
import { TransactionsModule } from './transactions/transactions.module';
import { InventoryModule } from './inventory/inventory.module';
import { NewsModule } from './news/news.module';
import { AlertsModule } from './alerts/alerts.module';
import { ProductsModule } from './products/products.module';
import { SimulationsModule } from './simulations/simulations.module';
import { HarvestPlansModule } from './harvest-plans/harvest-plans.module';
import { ChemicalModule } from './chemical/chemical.module';
import { PlanktonModule } from './plankton/plankton.module';
import { MicrobiologyModule } from './microbiology/microbiology.module';
import { MortalityModule } from './mortality/mortality.module';
import { DiseaseModule } from './disease/disease.module';
import { ReferenceModule } from './reference/reference.module';
import { SamplingModule } from './sampling/sampling.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { HarvestsModule } from './harvests/harvests.module';
import { FeedProductsModule } from './feed-products/feed-products.module';
import { FeedingTrayChecksModule } from './feeding-tray-checks/feeding-tray-checks.module';
import { FinancesModule } from './finances/finances.module';
import { ReportsModule } from './reports/reports.module';
import { TasksModule } from './tasks/tasks.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { TeamOverviewModule } from './team-overview/team-overview.module';
import { MoneyOverviewModule } from './money-overview/money-overview.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PushModule } from './push/push.module';
import { HealthModule } from './health/health.module';
import { MeasurementModule } from './measurement/measurement.module';
import { IndiaModule } from './india/india.module';
import { FeedAdvisorModule } from './feed-advisor/feed-advisor.module';
import { LunarModule } from './lunar/lunar.module';
import { DiseaseWarningModule } from './disease-warning/disease-warning.module';
import { HarvestTimingModule } from './harvest-timing/harvest-timing.module';
import { AerationModule } from './aeration/aeration.module';
import { PnlModule } from './pnl/pnl.module';
import { CreditModule } from './credit/credit.module';
import { AlertCenterModule } from './alert-center/alert-center.module';
import { BannedSubstancesModule } from './banned-substances/banned-substances.module';
import { PondContextModule } from './pond-context/pond-context.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ThrottlerGuard is registered ahead of JwtAuthGuard (see providers below),
    // so `req.user` doesn't exist yet and it buckets by IP. `main.ts` sets
    // `trust proxy`, so on rural Indian mobile carriers that IP is a CGNAT
    // address shared by many subscribers — one farmer's home screen focus
    // spends ~19 requests, and a handful of neighbours on the same carrier
    // could rate-limit each other off the app.
    //
    // The tight per-route @Throttle decorators on the auth endpoints are what
    // actually protect the sensitive surface; this global number only has to
    // stop a runaway client. Do not tighten this without moving to a
    // user-aware tracker first.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const type = configService.get('DB_TYPE') || 'postgres';
        const isProduction = configService.get('NODE_ENV') === 'production';
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (!databaseUrl && type === 'postgres') {
          if (isProduction) {
            // Fail fast instead of silently connecting to localhost — a
            // production deploy with no DATABASE_URL is a misconfiguration,
            // not a case to limp along on (AUDIT id 154).
            throw new Error(
              'DATABASE_URL is not set in production. Refusing to start.',
            );
          }
          console.error('DATABASE_URL is not set! Falling back to localhost.');
        }

        const common = {
          autoLoadEntities: true,
          synchronize: !isProduction,
        };
        if (type === 'sqlite') {
          return {
            ...common,
            type: 'sqlite',
            database: configService.get('DB_NAME') || ':memory:',
            dropSchema: true,
          };
        }
        return {
          ...common,
          type: 'postgres',
          url: databaseUrl,
          ssl: { rejectUnauthorized: false },
          // Connection retry settings for Render cold starts
          // Render may spin down the service after inactivity, and the
          // database connection pool needs to handle reconnection gracefully.
          extra: {
            // Maximum time to wait for connection (10 seconds)
            connectionTimeoutMillis: 10000,
            /**
             * Pool size. Was 5, which was the app's real concurrency limit:
             * one Farms screen fans out to ~300 queries (≈7 per pond across
             * 43 ponds), and with 5 connections those serialise into ~60
             * waves. Every wave is a round trip to Supabase in Singapore from
             * a backend in Oregon (~180ms), so the pool alone was costing
             * ~11s on that screen.
             *
             * DATABASE_URL points at the Supabase POOLER in transaction mode,
             * which multiplexes onto far fewer server connections, so 20
             * client connections here is comfortable rather than reckless.
             */
            max: 20,
            // Minimum connections to maintain (helps with cold starts)
            min: 2,
            /**
             * Idle/lifetime were 30s and 60s. Recycling a connection every
             * 60s meant constantly re-opening one — `pgbouncer.get_auth` was
             * the single most-called statement in the database at 18,311
             * calls, each a TLS handshake plus auth ACROSS THE PACIFIC before
             * any query could run.
             *
             * Keeping connections warm removes that setup cost from the hot
             * path entirely. Still bounded, so a leaked or wedged connection
             * is eventually reclaimed.
             */
            idleTimeoutMillis: 600000, // 10 min
            maxLifetimeMillis: 1800000, // 30 min
          },
          // Retry connection on startup (important for cold starts)
          connectTimeoutMS: 10000,
          // In production `synchronize` is off, so the schema is not modified.
          // migrationsRun is disabled because the database already has the schema
          // from previous deployments. New migrations should be run manually via CLI.
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
          migrationsRun: false,
          // Keep connection alive during cold start spin-up
          keepConnectionAlive: true,
        };
      },
      inject: [ConfigService],
    }),
    HealthModule,
    FarmAccessModule,
    FarmMembersModule,
    ProfilesModule,
    FarmsModule,
    AuthModule,
    RedisModule,
    PondsModule,
    CropsModule,
    WaterQualityModule,
    FeedRecordsModule,
    ShrimpCalculationsModule,
    TransactionsModule,
    InventoryModule,
    NewsModule,
    AlertsModule,
    ProductsModule,
    SimulationsModule,
    HarvestPlansModule,
    ChemicalModule,
    PlanktonModule,
    MicrobiologyModule,
    MortalityModule,
    DiseaseModule,
    ReferenceModule,
    SamplingModule,
    TreatmentsModule,
    HarvestsModule,
    FeedProductsModule,
    FeedingTrayChecksModule,
    FinancesModule,
    ReportsModule,
    TasksModule,
    LeaveRequestsModule,
    TeamOverviewModule,
    MoneyOverviewModule,
    AttendanceModule,
    PushModule,
    MeasurementModule,
    IndiaModule,
    FeedAdvisorModule,
    LunarModule,
    DiseaseWarningModule,
    HarvestTimingModule,
    AerationModule,
    PnlModule,
    CreditModule,
    AlertCenterModule,
    PondContextModule,
    BannedSubstancesModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
