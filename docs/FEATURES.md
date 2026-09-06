# Upcheck — Feature Map

The master feature reference for the Upcheck monorepo (shrimp-farming operations app for the Indian aquaculture market). This is the "what exists and where" index. Every feature below is grounded in real code: a backend NestJS module (`@Controller` prefix + routes), a frontend Expo/React-Native screen, and a persistence entity/table.

## How to use this map

- **Route prefixes** are the literal `@Controller('…')` strings from `backend/src/*/*.controller.ts`. Prepend the API base to get the full path.
- **Screens** are file basenames under `frontend/src/screens/…`. Navigation is defined in `frontend/src/navigation/{RootNavigator,MainNavigator}.tsx`.
- **Entity / table** names come from `@Entity('…')` (TypeORM). One-to-one with a Postgres table in Supabase (`supabase_setup.sql`).
- **Launch status**: a handful of screens are gated by `frontend/src/config/features.ts`. Anything not gated is always on. See [Launch flags](#launch-flags) at the bottom.
- Deeper context: [ARCHITECTURE.md](./ARCHITECTURE.md) · [backend guide](./guides/backend.md) · [frontend guide](./guides/frontend.md) · app flow in [APP_FLOW.md](./APP_FLOW.md).

**Conventions worth knowing before you read:**
- The API is **mostly** request-driven: "Daily briefing" and every engine output
  are computed live, per request, when the farmer opens the app.
  > **Correction (2026-09-07).** This line previously read "there is no cron /
  > scheduler anywhere (`ScheduleModule`/`@Cron` unused)". That is **wrong**.
  > `ScheduleModule.forRoot()` is wired in `news.module.ts` and
  > `@Cron(CronExpression.EVERY_HOUR)` runs news ingestion. The infrastructure
  > exists and is proven, so proactive alerting is not a greenfield build.
  >
  > Two consequences worth carrying into the alerts work:
  > 1. **That cron is silently unreliable today.** `render.yaml` runs the backend
  >    on Render's free plan, which spins down after ~15 minutes idle, and an
  >    in-process cron on a sleeping instance does not fire. The file's own
  >    comment acknowledges the spin-down and suggests an external ping, which
  >    was never configured. This is a live bug independent of any engine work.
  > 2. **A predicted pre-dawn DO crash is therefore computed only when the
  >    farmer opens the app** — at 6 a.m., after the kill. An alert you have to
  >    ask for is not an alert. Fixing it is a hosting decision (paid plan or a
  >    Render Cron Job) before it is a code one.
- Units are **fixed metric** on the client (m, m², kg) — no unit-conversion layer exists. Currency is **hardcoded ₹ INR** via local `formatMoney` helpers.
- Localization is real: **6 languages** (English, Hindi, Tamil, Telugu, Bengali, Odia) via i18next; language persisted in AsyncStorage, picker in Settings.
- Navigation: 5 bottom tabs — **Dashboard · Farms · (+) QuickLog · Reports · More** — everything else is pushed on the root stack.

---

## 1. Auth & onboarding

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Email/password sign-up & sign-in | `auth/supabase` → `POST signup`, `POST signin` | `auth/LoginScreen`, `auth/RegisterScreen` | `users` | Supabase Auth (Postgres-backed) + JWT. |
| Phone OTP login | `auth/supabase` → `POST login-otp/request`, `POST login-otp/verify` | `auth/OtpLoginScreen` | `users` | SMS/OTP fallback path. |
| Google OAuth | `auth/supabase` → `POST oauth/google` | `auth/LoginScreen` (button) | `users` | |
| Truecaller One-Tap | `auth/supabase` → `POST oauth/truecaller`, `POST oauth/truecaller/exchange` | `auth/TruecallerLoginScreen` | `users` | Native Java SDK bridge (`com.upcheck.app.TruecallerAuthModule`); backend verifier exchange. |
| Two-factor auth (TOTP) | `auth/supabase` → `POST 2fa/setup`, `2fa/enable`, `2fa/disable`, `2fa/login`, `GET 2fa/status` | `auth/TwoFactorChallengeScreen`, `settings/TwoFactorScreen` | `users` | Challenge screen on login; setup screen in settings. |
| Password reset | `auth/supabase` → `POST forgot-password`, `POST update-password` | `auth/ForgotPasswordScreen`, `auth/ResetPasswordScreen` | `users` | Email via Brevo SMTP. |
| Session refresh / signout / resend verify | `auth/supabase` → `POST refresh`, `POST signout`, `POST resend-verification`, `GET me`, `POST update` | — | `users` | |
| User profile | `profiles` → `POST/GET/PATCH`, `GET me`, `DELETE me`, `GET public/:username`, `GET check-username/:username`, `POST invite` | `settings/ProfileScreen` | `profiles` | `public/*` and `check-username/*` are `@Public()`. `invite` emails a friend. `DELETE me` = transactional local delete + best-effort Supabase auth removal. |
| First-run onboarding | — | `onboarding/WelcomeScreen`, `onboarding/PondSetupScreen` | — | Welcome shown when the user has no farms (3 value props → create farm). PondSetup is a multi-step wizard (geometry/dimensions/stocking/species). |
| Legal docs | — | `legal/LegalScreen`, `legal/PrivacyPolicyScreen`, `legal/TermsScreen` | — | Static content, available pre-auth. |

**Gotcha:** ownership on `profiles` public reads returns only whitelisted columns (id/username/fullName/avatar/website/createdAt).

## 2. Farms & ponds

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Farm CRUD | `farms` → `POST/GET/GET :id/PATCH/DELETE` | `farms/FarmsListScreen`, `farms/CreateFarmScreen`, `farms/FarmDetailScreen` | `farms` | FarmsList is the **Farms tab**. All routes behind `OwnershipGuard`. |
| Pond CRUD + archive | `ponds` → `POST`, `GET mine`, `GET`, `GET :id`, `PATCH :id`, `PATCH :id/archive`, `DELETE`, `GET :id/dimension-history` | `ponds/CreatePondScreen`, `ponds/PondDashboardScreen` | `ponds` | PondDashboard is the per-pond home (metrics, alerts, daily-action buttons, log/engine links). |
| Pond dimension history | `ponds` → `GET :id/dimension-history` | `ponds/PondDimensionHistoryScreen` | `pond_dimension_history` | Records L/W/D/area (m, m²) changes over time. **Gated** by `pondDimensionHistory` (ON). |
| Boundary map | *(deferred)* | — | — | Flag `boundaryMap` OFF; no live code. |

## 3. Crops / cycles

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Crop/cycle lifecycle | `crops` → `POST`, `GET`, `GET :id`, `PATCH :id`, `PATCH :id/harvest`, `PATCH :id/close`, `DELETE` | `cycles/CreateCycleScreen`, `cycles/CycleDetailScreen` | `crops` | A crop = one culture cycle (stocking → harvest → close). CycleDetail links to Cycle Analysis (**gated** by `cycleAnalysisReport`, ON). |

## 4. Water quality & chemistry

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Water-quality readings | `water-quality` → `POST`, `GET`, `GET pond/:pondId/latest`, `GET :id`, `PATCH :id`, `DELETE` | `logs/WaterQualityLogScreen`, `logs/History/WaterQualityHistoryScreen` | `water_quality_records` | Daily probe params (DO/pH/temp/…). |
| Weekly chemistry | *(uses water-quality/measurement pipeline)* | `logs/WeeklyChemistryScreen` | `water_quality_records` / `measurements` | Engine-styled weekly entry (alkalinity/hardness/etc.). |
| Chemical / probiotic applications | `chemical-data` → `POST`, `GET crop/:cropId`, `GET :id`, `PATCH :id`, `DELETE` | `logs/ChemicalLogScreen`, `logs/History/ChemicalHistoryScreen` | `chemical_data` | |
| Plankton observations | `plankton-data` → `POST`, `GET crop/:cropId`, `GET :id`, `PATCH :id`, `DELETE` | `logs/PlanktonLogScreen`, `logs/History/PlanktonHistoryScreen` | `plankton_data` | |
| Microbiology (Vibrio etc.) | `microbiology-data` → `POST`, `GET crop/:cropId`, `GET :id`, `PATCH :id`, `DELETE` | `logs/MicrobiologyLogScreen`, `logs/History/MicrobiologyHistoryScreen` | `microbiology_data` | |
| Generic measurements + data dictionary | `measurements` → `POST`, `POST batch`, `GET`, `GET :id`, `PATCH :id`; `data-dictionary` → `GET` | `measurements/MeasurementsScreen` | `measurements`, `data_dictionary` | Unified parameter pipeline. **Data dictionary is a validation layer**, not an engine: seeds a versioned param dictionary on module init and validates unit/allowed-values/range (throws 400). Pick a param → record → trend chart. |

## 5. Feed & feeding trays

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Feed records | `feed-records` → `POST`, `GET`, `GET pond/:pondId/total`, `GET :id`, `PATCH :id`, `DELETE` | `logs/FeedLogScreen`, `logs/History/FeedHistoryScreen` | `feed_records` | |
| Feed stats/analytics | *(reads feed-records)* | `feed/FeedStatsScreen` | `feed_records` | Daily-total line chart, cumulative kg, low-stock. |
| Feed products catalog | `feed-products` → `POST/GET/GET :id/PATCH/DELETE` | `feedProducts/FeedProductsScreen` | `feed_products` | Farm's feed brands/protein specs. |
| Feeding-tray checks | `feeding-tray-checks` → `POST/GET/GET :id/PATCH/DELETE` | `logs/FeedingTrayChecksScreen` | `feeding_tray_checks` | Tray residue → adjusts feed advisor ration. **Gated** by `feedingTrayChecks` (ON). |

## 6. Sampling & growth

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Shrimp sampling (weight/count) | `sampling` → `POST/GET/GET :id/PATCH/DELETE` | `logs/SamplingLogScreen`, `logs/History/SamplingHistoryScreen` | `sampling_data` | Feeds ABW/ADG into engines. |

## 7. Mortality & disease

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Mortality records | `mortality` → `POST`, `GET crop/:cropId`, `GET :id`, `PATCH :id`, `DELETE` | `logs/MortalityLogScreen`, `logs/History/MortalityHistoryScreen` | `mortality_records` | Live population = stocking − Σmortality. |
| Disease library (encyclopedia) | `disease` → `POST/GET/GET :id/PUT/DELETE library`, `GET library/search`, `POST library/seed` | `diseases/DiseaseListScreen`, `diseases/DiseaseDetailScreen` | `disease_library` | Searchable encyclopedia w/ severity badges. |
| Disease occurrence log | `disease` → `POST record`, `GET record/crop/:cropId`, `PATCH record/:id`, `DELETE record/:id` | `logs/DiseaseLogScreen`, `logs/History/DiseaseHistoryScreen` | `disease_records` | Warns on banned substances. |
| Symptom-based diagnosis | *(client-side rule matcher)* | `diseases/DiagnoseScreen` | — | Pick physical/behavioral/environmental symptoms → ranked matches. **Gated** by `diseaseDiagnosis` (ON). |
| Treatments / dosing | `treatments` → `POST/GET/GET :id/PATCH/DELETE` | `logs/TreatmentLogScreen`, `logs/History/TreatmentHistoryScreen` | `treatments` | Warns on banned substances. |

## 8. Harvest & harvest planning

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Harvest records | `harvests` → `POST/GET/GET :id/PATCH/DELETE` | `logs/HarvestLogScreen`, `logs/History/HarvestHistoryScreen` | `harvests`, `harvest_records` | Partial + full harvest events. |
| Harvest plans | `harvest-plans` → `POST`, `GET`, `GET :id`, `PATCH :id`, `PATCH :id/complete`, `GET pond/:pondId/summary`, `DELETE` | `harvest/HarvestPlansScreen` | `harvest_plans` | Plan → mark complete / cancel. |

## 9. Inventory, feed products & credit

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Inventory items | `inventory` → `POST`, `GET`, `GET low-stock/:farmId`, `GET :id`, `PATCH :id/adjust`, `PATCH :id`, `DELETE` | `inventory/InventoryListScreen`, `inventory/InventoryDetailScreen` | `inventory` | Stock-adjustment action on detail. |
| Products (generic catalog) | `products` → `POST/GET/GET :id/PATCH/DELETE`, `PATCH :id/stock` | `shop/ShopScreen` | `products` | Catalog browse; **checkout deferred** (`marketplaceCheckout` OFF — Shop screen does not check the flag, but no checkout flow exists). |
| Inventory credit ledger | `credit` → `POST`, `GET`, `GET summary`, `PATCH :id/repay`, `GET reorder-check` | *(surfaced in inventory/finance)* | `credit_ledgers` | `outstanding = principal×(1+interest%) − repaid` (simple, non-compounding). `reorder-check` flags when below threshold OR runout ≤ supplier lead time. |

## 10. Finance — expenses, transactions, P&L

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Per-cycle expenses | `expenses` → `POST`, `GET cycle/:cropId`, `GET cycle/:cropId/financials` | `finance/ExpensesScreen` | `expenses` | Category-tagged; break-even shown. **Gated conceptually** by `costManagement` (ON). |
| Farm transactions ledger | `transactions` → `POST`, `GET`, `GET farm/:farmId/summary`, `GET :id`, `PATCH :id`, `DELETE` | `finance/TransactionsScreen` | `transactions` | Income/expense with all/income/expense filters + summary. |
| Crop P&L | `pnl` → `GET crop/:cropId` | `engines/CropPnlScreen` | *(computed from `expenses` + `harvests`)* | CoP/kg, break-even count, profit/margin/ROI, productivity t/ha via `india` EconomicsService. **Owner/manager only** (financial role). |

**Gotcha:** all financial reads require `VIEW_FINANCIALS` (owner/manager). Viewer sees financials only if the owner grants it per-farm.

## 11. Reports & analytics

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Dashboard summary | `reports` → `GET dashboard` | `main/HomeScreen`, `main/ReportsScreen` | *(aggregates)* | Active/total ponds, low-stock, today's feed. **Redis-cached 5 min.** |
| Cycle analysis | `reports` → `GET cycle/:id/analysis` | `reports/CycleAnalysisScreen` | *(aggregates)* | FCR (total feed / harvest — a pond-total proxy, exact only for single-cycle ponds), survival %, growth chart. **Gated** by `cycleAnalysisReport` (ON). |
| Financial report | `reports` → `GET financials` | `main/ReportsScreen` | *(aggregates)* | Revenue/expense/profit across all cycles. `VIEW_FINANCIALS`-gated; uses 10000 page size to avoid `take=50` truncation. |

## 12. Alerts & decision engines

All engines are **pure/request-driven** (no persisted cron). Each is a per-pond compute plus an optional persisted snapshot.

| Engine | Backend | Frontend | Entity | What it computes / gotcha |
|---|---|---|---|---|
| **Feed advisor** | `feed-advisor` → `POST compute`, `POST`, `GET pond/:pondId`, `PATCH :id/actual` | `engines/FeedAdvisorScreen` | `feed_plans` | Daily ration: `biomass×FR%` × tray-residue × molt-peak (×0.75) × env factors (low-DO, ammonia, temp), zeroed on fasting; split per-meal. `nh3` input is **free/un-ionised ammonia**, not TAN. |
| **Harvest timing** | `harvest-timing` → `POST optimize`, `GET pond/:pondId` | `engines/HarvestTimingScreen` | `harvest_recommendations` | 30-day day-by-day projection maximizing `net = gross − feedCost − riskLoss`; also a partial-harvest (10–90% thinning) optimizer when overstocked. Many tunable constants (ADG decay ×0.97/day, density taper). |
| **Disease early-warning** | `disease-risk` → `POST compute`, `POST`, `GET pond/:pondId`, `GET pond/:pondId/latest` | `engines/DiseaseRiskScreen` | `disease_risk_snapshots` | Maps boolean indicators → 7 diseases (WSSV/AHPND/EHP/WFD/Luminous/RMS/LSS) via weighted signatures; `score=100×Σweights`, bands Low/Watch/Critical (30/60). Indicator derivation happens upstream. |
| **Aeration & power** | `aeration` → `POST adequacy`, `POST night-do`, `POST power-cost` | `engines/AerationScreen` | *(stateless)* | `requiredHp = biomassKg/500` (~2 HP/t); overnight DO budget predicts night-DO minimum and back-solves aerator run-hours; grid/diesel cost. **All coefficients are uncalibrated heuristics** — and as of 2026-09-07 they say so at their own definitions in `aeration.service.ts` (provenance comments) and once in the UI, so the caveat no longer lives only in this file. |
| **Lunar molt** | `lunar` → `GET phase`, `POST risk` | `engines/LunarScreen` | *(stateless)* | Deterministic synodic moon-phase math (29.53d, no external API); molt-likelihood peaks at new/full, `moltRisk` from pond stressors. Explicitly a heuristic. |
| **Pond context** | `pond-context` → `GET :pondId` | *(consumed by engines/dashboards)* | *(aggregate)* | One snapshot: latest WQ, free-NH3, live population, biomass, running FCR, cumulative feed, DOC, targets + a completeness/freshness confidence score. |
| **Alert center / briefing** | `alert-center` → `GET briefing`, `GET live-briefing`, `POST emit` | `engines/MorningBriefingScreen`, `engines/EnginesHubScreen` | *(uses `alerts`)* | `emit` writes engine alerts into the alerts stream; `briefing` rolls unread alerts into one top-severity card per pond; **`live-briefing` recomputes alerts live** (free-NH3, DO, FCR>1.8, lunar) across accessible ponds — not persisted (a future cron *could* persist/push; none exists). |
| **Notifications / alerts** | `alerts` → `POST`, `GET me`, `GET me/count`, `PATCH me/read-all`, `GET :id`, `PATCH :id/read`, `DELETE :id` | `notifications/NotificationsScreen` | `alerts` | `createAutoAlert` saves + best-effort Expo push. **`*ForUser` methods enforce ownership; plain `findOne/markAsRead/remove` do NOT** — use the scoped variants. |
| **Push delivery** | `push` → `POST register`, `DELETE register` | *(SettingsScreen toggle)* | `users.push_token` | One Expo token/user; `sendToUser` POSTs to `exp.host` (10s timeout). Best-effort, never throws; reports dispatched not delivered. |
| Morning briefing (daily) | `alert-center` → `GET briefing` | `engines/MorningBriefingScreen` | `alerts` | Multi-pond digest of highest-severity alerts. |
| Daily routine checklist | *(client-side)* | `engines/DailyRoutineScreen` | — | Day's routine tasks (water check, feed, FCR) with done-state. |
| Engines hub | — | `engines/EnginesHubScreen` | — | Icon launcher; hides Crop P&L for non-financial roles. |

## 13. Tasks

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Task assignment & verification | `tasks` → `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE`, `POST :id/complete`, `POST :id/verify` | `tasks/TaskListScreen` | `tasks` | Tap advances status: open → in_progress → done; manager/owner verifies (`WRITE_MANAGEMENT`). |

## 14. Members & RBAC

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Farm membership | `farm-members` → `GET farm-members/mine`, `GET farm-members/users/lookup`, `GET farms/:farmId/members`, `POST …/members`, `PATCH …/members/:userId`, `DELETE …/members/:userId`, `POST …/transfer-ownership` | `farms/FarmMembersScreen`, `farms/AddWorkerScreen` | `farm_members` | Look up a user, add as worker; owner transfers ownership (demotes old owner to manager, atomic). |

**Roles** (`FarmRole`, ranked): `viewer`(0) < `worker`(1) < `manager`(2) < `owner`(3).

**Capabilities** (`backend/src/farm-access/farm-capability.ts` — single source of truth, `CAPABILITY_ROLES`):

| Capability | Roles allowed |
|---|---|
| `READ` | owner, manager, worker, viewer |
| `WRITE_OPERATIONAL` (field/operational logs) | owner, manager, worker |
| `WRITE_MANAGEMENT` (ponds/cycles/tasks/treatments lifecycle + verify) | owner, manager |
| `VIEW_FINANCIALS` (costs, transactions, P&L, reports) | owner, manager |
| `MANAGE_WORKERS` | owner, manager |
| `OWNER_ONLY` (farm/pond delete, ownership transfer, role changes) | owner |

**Enforcement — two paths, both via `FarmAccessService`:**
1. **Guard layer:** `@OwnsResource(entityType, paramName, ownerPath, capability)` decorator + `OwnershipGuard`. Loads the entity, resolves owner via `ownerPath` (e.g. `pond.farm.userId`); direct owner always passes, else `getRoleOnFarm` + `roleSatisfies(role, capability)`. Default capability `WRITE_OPERATIONAL`.
2. **Service layer:** `assertCanAccessFarm/assertCanAccessPond(userId, id, capability)` called inside services (e.g. reports financials → `VIEW_FINANCIALS`).

**Member management:** `canAssignRole`/`canManageMember` — owner assigns manager/worker/viewer; manager assigns/manages worker only; owner never assigned/removed here (dedicated `transferOwnership`).

**Gotchas:** legacy `farm.userId` treated as owner if no `FarmMember` row exists; if `farm_members` table is missing (pre-migration) it degrades to owner-only access rather than failing; `transferOwnership` OTP re-verification is a noted TODO (not yet implemented).

## 15. Reference data & calculators

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Reference data (species/hatcheries/broodstocks) | `reference` → CRUD under `species`, `hatcheries`, `broodstocks` | `reference/ReferenceScreen` | `species`, `hatcheries`, `broodstocks` | Tabbed manager, inline add. |
| Shrimp calculators (formula library) | `shrimp-calculations` → `POST fcr`, `adg`, `survival-rate`, `daily-feed`, `expected-harvest`, `growth-projection`, `cultivation-performance`, `free-ammonia`, `product-amount`; `GET biomass`, `recommended-feeding-rate` | `calculators/CalculatorHubScreen` + `CultivationPerformanceScreen`, `DailyFeedCalculatorScreen`, `ProductAmountScreen`, `FreeAmmoniaScreen`, `GrowthAndHarvestScreen` | *(stateless)* | Free-ammonia uses Bower & Bidwell 1978 pKa w/ salinity term. `normalizeShrimpSpecies` coerces free text → vannamei/monodon/indicus/scampi (defaults vannamei). Running-FCR/FR tables are in-cycle proxies, not final. |
| Data dictionary | `data-dictionary` → `GET` | *(feeds MeasurementsScreen)* | `data_dictionary` | Versioned param catalog + validation (see §4). |

## 16. India / regional

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| Economics (CoP, margin, ROI, break-even) | `india` → `POST economics` | *(surfaced in CropPnl/Reports)* | *(stateless)* | Break-even count by interpolating count↔price bands (clamps out-of-range). |
| Regional price feeds | `india` → `GET price`, `GET price-feeds`, `POST price-feeds` | *(surfaced in economics)* | `price_feeds` | **Crowdsourced/user-entered** (`enteredBy`), not an external market API; no scheduled refresh. `GET price-feeds` is `@Public()`; `GET price` requires auth. |

## 17. Simulations

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| What-if scenarios | `simulations` → `POST run`, `GET`, `GET :id`, `DELETE :id` | `simulation/SimulationListScreen`, `SimulationCreateScreen`, `SimulationResultsScreen` | `simulations` | FeedChange/PriceChange/StockingDensity on the active crop → baseline vs simulated net profit, persisted. **Baseline pulled from farm-level transaction SUMs (not crop-scoped)**; FeedChange FCR heuristic `growthImprovement/200`; stocking-density warning hardcoded at ratio > 1.2. |

## 18. Content & misc

| Feature | Backend | Frontend | Entity | Notes |
|---|---|---|---|---|
| News / advisories | `news` → `POST/GET/GET :id/PATCH/DELETE` | `news/NewsListScreen`, `news/NewsDetailScreen` | `news_articles` | |
| Shop (browse) | `products` (§9) | `shop/ShopScreen` | `products` | Category filter; checkout deferred. |
| Health checks | `health` → `GET`, `GET liveness`; root `app` → `GET`, `GET liveness` | — | — | For Render.com probes. |
| Settings / language / sync toggles | *(profiles + push)* | `settings/SettingsScreen`, `AboutScreen`, `HelpScreen` | `profiles`, `users` | 6-language picker (incl. Telugu), offline-sync/push/email toggles, logout. |
| Home dashboard | `reports` (§11) | `main/HomeScreen` | *(aggregate)* | Farm summary metrics, moon phase, per-farm glance cards, first-run welcome trigger. |
| Quick log | *(routes to logs)* | `main/QuickLogScreen` | — | Center-tab modal; auto-picks pond and routes to water/feed/routine/sampling/measurements. |
| More menu | — | `main/MoreScreen` | — | Profile/settings/notifications + tools (calculators, simulations, reports, disease encyclopedia, news). |

---

## Launch flags

`frontend/src/config/features.ts` — the only feature gating. Policy: every in-app feature flips on once finished + device-smoke-tested; only external-dependency features stay off at launch.

| Flag | State | Meaning |
|---|---|---|
| `pondDimensionHistory` | **ON** | Pond dimension-history link (PondDashboard). |
| `cycleAnalysisReport` | **ON** | Cycle Analysis link (CycleDetail). |
| `feedingTrayChecks` | **ON** | Tray-check action (PondDashboard). |
| `diseaseDiagnosis` | **ON** | Diagnose CTA (DiseaseList). |
| `costManagement` | **ON** | Per-cycle cost + break-even suite. |
| `boundaryMap` | OFF | Farm boundary draw/edit on a map — not built. |
| `marketplaceCheckout` | OFF (deferred) | Needs vendor partnerships + payment gateway. |
| `iotSensors` | OFF (deferred) | Needs sensor hardware + MQTT pipeline. |
| `traceabilityPublic` | OFF (deferred) | Needs public web/QR infrastructure. |
| `expertConsultation` | OFF (deferred) | Needs recruited expert panel + payments. |

Only 4 screens actually branch on a flag: `PondDashboardScreen` (`pondDimensionHistory`, `feedingTrayChecks`), `CycleDetailScreen` (`cycleAnalysisReport`), `DiseaseListScreen` (`diseaseDiagnosis`). The 5 OFF flags have no live code paths.

---

*Maintenance: this map is generated from module/screen enumeration. When you add a `*.module.ts` + `*.controller.ts` or a `screens/**/**.tsx`, add a row here in the matching domain. Keep the `@Controller` prefix and screen basename literal — they are the load-bearing anchors.*
