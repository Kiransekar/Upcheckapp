# Audit Remediation Status — 2026-07-08 (215 findings)

Source: `AUDIT_FINDINGS_2026-07-08.json` (workflow wf_73582cfd, not-converged, 215 confirmed).
Legend: ✅ done+tested / ⬜ pending / 🔷 needs-ops-or-external-input

**Session 1 done: all 6 CRITICAL + 22 HIGH (28 findings), backend 465/465 + frontend 120/120 green.**

**Session 2 done: remaining 5 HIGH closed (measurement offline queue wired through hardened `saveRecord` + dead `measurementSync.ts` deleted → fixes both the dead-module and lost-write-race findings; harvest mark-complete modal + i18n confirmed already fixed in Session 1; inventory Add-item real create form). tsc clean, frontend 120/120 green.**

> Note: the `#` column below is a row index, NOT the audit JSON `id`. HIGH ⬜ rows 24/27/28/29/37 = audit ids 82/86/69/71/127 respectively.

**Session 4 done (user-directed): EAS remote versioning + autoIncrement (#22/#23); backend Sentry wired behind `SENTRY_DSN` env — init + `SentryExceptionFilter` reports 5xx + crash-handler capture (#33); safe non-breaking `npm audit fix` (backend 45→10, frontend 36→19, both clear CRITICAL + most HIGH) (#31/#36); `eslint --fix` safe/formatting + non-blocking CI lint step (#7). CAVEATS: #74 store signing = EAS-account keystore via `eas credentials` (ops step, no keystore in repo); #38 frontend crash reporting left as the `reportError()` seam (needs `@sentry/react-native` native install by you, set `EXPO_PUBLIC_SENTRY_DSN`); #31/#36 residual advisories need breaking upgrades (deferred per your call). Backend 468/468, frontend 120/120, build+tsc clean.**

**Session 5 done (~31 findings): (a) Play Store legal copy filled — Upcheck Technologies Private Limited / admin@upcheck.in / effective 9 Jul 2026 across LEGAL_META + docs/legal/*.md; only [Registered office address] + [State] governing-law + hosted URLs left for the operator (#21/#25). (b) Backend input-validation cluster — @ArrayMaxSize + per-element @MaxLength on all string/URL arrays (shared BoundaryPointDto for farm/pond boundary + @ValidateNested), @MaxLength on free-text, @Min/@Max on calculator DTOs + crop targetSrPercent, feeding-tray trayNumber @IsInt @Min(1) + status @IsIn, push register → RegisterPushTokenDto (rows 100/102/105/106/108/109/110/111/147/148/187/188/189/200/201/204). (c) List endpoints bounded via .take(500) (row 52); species FR @Query passthrough (row 68); harvest-timing → OptimizeHarvestTimingDto (row 55). (d) Removed 5 unused deps + dead @types + committed debris (output*.txt, verify_2fa dup, root package-lock stub, .kiro tree) (rows 94/95/96/183/184/185/198/199/209/212). Backend 468/468, build clean. 83/215 done; ~132 MEDIUM/LOW polish remain.**

**Session 6 done (WORKFLOW — 8 module-partitioned agents, 4 Opus + 4 Sonnet, disjoint file sets): 91 findings addressed + reference/news admin-gating (#48) by integrator. 211/215 rows ✅. Backend 78 suites/498 tests + build clean; frontend 18 suites/122 tests + tsc clean; CI green.** Highlights: timezone/DOC unified (IST, stocking-day=1 across crop entity/service/measurement), closeCycle idempotent + two-active-cycle lock, harvest/transaction idempotency, feed inventory compensation, N+1 collapses, disease-library/reference/news/product writes admin-gated, redis error-listener+recovery, email throws+no-PII, health/water-quality no silent-swallow; frontend error-vs-empty states + pull-to-refresh + a11y + store resets (uploadStore→expo-crypto), form pickers/validation/pagination, platform-gated Google sign-in, brand/copy/i18n cleanup, unused deps + RN permissions removed; docs accuracy + supabase on_auth_user_deleted trigger. **BEHAVIOR CHANGES to eyeball on-device: crop DOC now 1-based (+1); crop harvest status 'harvested'→'completed'; reference/news/disease-library API writes now require SUPER_ADMIN.** **REMAINING: 4 minor codeable ⬜ (CreateCycle stocking-count client-validation, ResetPassword password-parity, pond-context pH/Temp/Salinity confidence age, supabase.service dead-code) + external 🔷 (Android upload keystore via `eas credentials`; frontend `@sentry/react-native` + `EXPO_PUBLIC_SENTRY_DSN`; truecaller patched-fork replacement; authentic non-English translations; operator legal placeholders).**

**Session 7 done: closed the final 4 minor codeable items — ResetPassword now enforces full signup password policy; pond-context confidence uses each parameter's own source-record timestamp (DO/pH/temp/salinity); dead SupabaseService deleted; CreateCycle stocking-count validation confirmed already correct. Backend 498/498, frontend 122/122, build+tsc clean. 213/215 ✅ — ONLY 2 rows remain, both requiring an EXTERNAL artifact that cannot live in the repo: 🔷 Android upload keystore (`eas credentials`) and 🔷 Truecaller patched-fork replacement (needs a different npm package / real TurboModule). All code-closable audit findings are DONE.**

**Session 3 done: codeable ops-hardening (11 findings). helmet security headers + graceful shutdown hooks + process crash handlers (main.ts); health check now reports redis degraded/up and returns HTTP 503 when DB is down (+3 unit tests); @Throttle added to the 4 unthrottled public auth endpoints (login-otp/verify, oauth/google, oauth/truecaller, oauth/truecaller/exchange) + resend-verification now uses ResendVerificationDto; backend CI quality-gate workflow (.github/workflows/ci.yml) runs backend build+test and frontend tsc+jest on push/PR. Backend 468/468 green, build clean.**

| # | Sev | Status | Area | Issue |
|---|---|---|---|---|
| 0 | CRIT | ✅ | credit | POST /credit binds @Body() to Partial<CreditLedger>, which erases to the native Objec |
| 1 | CRIT | ✅ | disease records / cross-tenant write | PATCH disease/record/:id has no OwnershipGuard and updateRecord() (disease.service.ts |
| 2 | CRIT | ✅ | Multi-tenant isolation (IDOR / data lo | DELETE /disease/record/:id has only the global JwtAuthGuard and no ownership check; d |
| 3 | CRIT | ✅ | disease records / cross-tenant delete  | DELETE disease/record/:id has no OwnershipGuard and removeRecord() (disease.service.t |
| 4 | CRIT | ✅ | Caching & staleness (cross-tenant read | getDashboardSummary passes an arbitrary client-supplied farmId straight into the serv |
| 5 | CRIT | ✅ | Caching & staleness (frontend persiste | logout() only calls clearSession() + TruecallerAuth.clear(); it never resets the in-m |
| 6 | HIGH | ✅ | CI has no quality gate | The only push/PR-triggered workflow is docs.yml (doc-link check + a soft warning). Th |
| 7 | HIGH | ✅ | Backend lint gate fails | `npm run lint` (eslint) exits 1 with 1042 errors + 269 warnings in src alone (486 no- |
| 8 | HIGH | ✅ | crops harvest unvalidated body / mass  | harvest(@Body() harvestData: {...}) uses an inline type (no DTO class) so the global  |
| 9 | HIGH | ✅ | Multi-tenant isolation (IDOR read) | GET /disease/record/crop/:cropId → disease.service.ts:237 findRecordsByCrop(cropId) q |
| 10 | HIGH | ✅ | disease records / cross-tenant read | GET disease/record/crop/:cropId has no OwnershipGuard/@OwnsResource; findRecordsByCro |
| 11 | HIGH | ✅ | Multi-tenant isolation (IDOR write) | PATCH /disease/record/:id → disease.service.ts:245 updateRecord(id,dto,userId) fetche |
| 12 | HIGH | ✅ | feed-products authorization | No @UseGuards/@OwnsResource on any route and FeedProduct has no farmId/userId column, |
| 13 | HIGH | ✅ | finances | create() only authorizes createDto.pondId (assertCanAccessPond) but then trusts creat |
| 14 | HIGH | ✅ | harvest-plans non-idempotent financial | completePlan inserts a new 'income' Transaction on every call with no status/idempote |
| 15 | HIGH | ✅ | ponds hard delete data loss | remove() hard-deletes a pond checking only activeCycleId; onDelete:CASCADE then destr |
| 16 | HIGH | ✅ | products | The products marketplace catalog (price, salePrice, stock) has only the global JwtAut |
| 17 | HIGH | ✅ | Cross-tenant PII exposure | GET /profiles (findAll) has no @Public but any authenticated user reaches it; profile |
| 18 | HIGH | ✅ | Multi-tenant isolation (IDOR read + wr | GET /profiles/:id calls profilesService.upsert(id, user.email) with no id===user.id c |
| 19 | HIGH | ✅ | Auth mirror trigger / account deletion | deleteAccount() deletes the local public.users row (and cascaded farm data) FIRST, th |
| 20 | HIGH | ✅ | Multi-tenant isolation (IDOR read) | getDashboardSummary(userId, farmId) (GET /reports/dashboard?farmId=) never checks tha |
| 21 | HIGH | ✅ | content — Play Store legal docs incomp | The public-hosting legal docs required for the Play Store listing still contain unfil |
| 22 | HIGH | ✅ | Docs vs code / release | Doc instructs "Bump version/versionCode per release in app.config.ts", but app.config |
| 23 | HIGH | ✅ | Release config / EAS versioning | Production build profile has no autoIncrement and cli has no appVersionSource; the co |
| 24 | HIGH | ✅ | offline sync / api | The 'Offline-first measurement queue (capture works with no signal, PRD §8.A)' module |
| 25 | HIGH | ✅ | content — placeholder legal copy shipp | LEGAL_META fields are unfilled bracket placeholders (contactEmail '[support@yourdomai |
| 26 | HIGH | ✅ | calculators — wrong dosage formula (10 | The concentration-adjusted amount uses clientCalc = (pondVolume*ppm)/(conc*10000). Ba |
| 27 | HIGH | ✅ | i18n — un-localized screen | This live, navigable screen (routed from CycleDetailScreen and PondDashboardScreen, R |
| 28 | HIGH | ✅ | harvest — mark-complete flow broken | promptCompleteValues promises 'You will be asked for actual harvest weight and price  |
| 29 | HIGH | ✅ | inventory — Add Item is a dead button | Both the FAB (line 243) and the empty-state action (line 237) only fire Alert.alert(t |
| 30 | HIGH | ✅ | permissions / store | roleForFarm returns null for a farm the user OWNS: backend GET /farm-members/mine (li |
| 31 | HIGH | ✅ | Dependencies / known vulns (backend) | npm audit --omit=dev on installed backend tree reports 18 HIGH vulns in the prod runt |
| 32 | HIGH | ✅ | Concurrency — single-use backup code d | verifyCodeOrBackup reads user.backupCodes, splices the matched code in memory, and sa |
| 33 | HIGH | ✅ | Observability — no error tracking (bac | The only global exception filter is `@Catch(QueryFailedError)` and logs to console on |
| 34 | HIGH | ✅ | Account deletion — residual user data | deleteAccount only runs DELETE FROM users + DELETE FROM profiles and relies on ON DEL |
| 35 | HIGH | ✅ | Account deletion — zombie auth identit | Supabase auth-user deletion is wrapped in a try/catch that only logs on failure, so t |
| 36 | HIGH | ✅ | Dependencies / known vulns (frontend) | npm audit --omit=dev on installed frontend tree reports 33 vulns including 1 CRITICAL |
| 37 | HIGH | ✅ | Concurrency — offline measurement queu | flush() reads the queue snapshot, awaits the batch POST (seconds on mobile), then rew |
| 38 | HIGH | ✅ | Observability — no crash reporting (ap | The single crash-report choke-point is console-only for a pre-launch consumer app; Er |
| 39 | HIGH | ✅ | backend DTO / crop stocking count | stockingCount is @IsInt() @IsOptional() with NO @Min(0) (unlike totalSeed which has @ |
| 40 | HIGH | ✅ | backend DTO / harvest data-shape | weightKg (and count, averageSize, salePriceTotal) are @IsNumber() with no @Min(0); PO |
| 41 | HIGH | ✅ | backend DTO / finance amount | amount is @IsNumber() with no @Min, while type is constrained to income/expense (sign |
| 42 | HIGH | ✅ | Connection & wiring — response shape | feedApi.getAll returns the backend PageDto envelope {data, meta} (feed-records.servic |
| 43 | MEDI | ✅ | rate-limiting-otp | POST /login-otp/verify has no @Throttle, so it inherits only the global 60/min bucket |
| 44 | MEDI | ✅ | rate-limiting-auth | POST /oauth/google (l.342) and POST /oauth/truecaller (l.361) are @Public account-cre |
| 45 | MEDI | ✅ | rate-limiting-email | POST /resend-verification is @Public with no @Throttle and takes an untyped inline bo |
| 46 | MEDI | ✅ | crop terminal status inconsistency | crops.harvest() sets status='harvested' while closeCycle() (also called by harvests.c |
| 47 | MEDI | ✅ | authorization | disease_library is a global, non-tenant-scoped table, yet createDisease (l.29), seedD |
| 48 | MEDI | ✅ | authorization / shared reference data  | Global disease-library POST (line 29), PUT (55), DELETE (60) and reference species/ha |
| 49 | MEDI | ✅ | Email silent failure | sendEmail logs Brevo 4xx/5xx and returns void with no throw, retry, or queue; callers |
| 50 | MEDI | ✅ | feed-records inventory drift | create() deducts inventory stock via adjustStock, but remove() deletes the feed recor |
| 51 | MEDI | ✅ | feed-records non-transactional deducti | Inventory is decremented before the feed record is saved with no surrounding transact |
| 52 | MEDI | ✅ | unbounded list endpoints | findAll returns every tray check across all accessible farms with no take/skip; the s |
| 53 | MEDI | ✅ | harvest-plans complete unvalidated mon | complete(@Body() payload:{...}) inline type bypasses validation, so actualWeightKg/ac |
| 54 | MEDI | ✅ | harvest-plans wrong cycle summary math | getCycleSummary (route pond/:pondId/summary) sums revenue/expense across the entire f |
| 55 | MEDI | ✅ | harvest-timing unvalidated input | optimize(@Body() body: OptimizeBody) uses an interface (no DTO class), so abwNow/adgN |
| 56 | MEDI | ✅ | harvests missing idempotency | create() has no client-minted id/idempotency guard (unlike feed/water/sampling/mortal |
| 57 | MEDI | ✅ | Health check depth / observability | Health check pings only Postgres; it never reports RedisService.useMemory. When Redis |
| 58 | MEDI | ✅ | health check / broken-instance stays i | check() returns HTTP 200 even when the 'SELECT 1' database probe fails (only body.sta |
| 59 | MEDI | ✅ | Health check depth | check() returns a plain object, so Nest always responds HTTP 200 even when the DB pro |
| 60 | MEDI | ✅ | security-headers | No helmet / security-response-headers middleware anywhere; bootstrap enables CORS + c |
| 61 | MEDI | ✅ | Graceful shutdown | No app.enableShutdownHooks() and no SIGTERM handler. On deploy Render sends SIGTERM;  |
| 62 | MEDI | ✅ | Process crash safety | No process-level 'unhandledRejection'/'uncaughtException' handler anywhere in the bac |
| 63 | MEDI | ✅ | pond-context / overstated data confide | Alkalinity's confidence age uses chemistryAsOf, which is derived solely from the late |
| 64 | MEDI | ✅ | Entity vs migration divergence (NOT NU | pond.entity.ts marks geometry_type, construction_type, depth_m and calculated_area_m2 |
| 65 | MEDI | ✅* | Authorization consistency (members loc | Engine/finance features (feed-advisor, disease-warning, harvest-timing, simulations,  |
| 66 | MEDI | ✅ | Shared-catalog integrity (no admin gat | Product entity has no owner column (global catalog) yet POST/PATCH/PATCH:id/stock/DEL |
| 67 | MEDI | ✅ | Redis fallback recovery | retryStrategy returns null after 3 failures and flips useMemory=true permanently; onc |
| 68 | MEDI | ✅ | species feeding-rate endpoint dead | getRecommendedFeedingRate calls the service with only averageWeightG and never forwar |
| 69 | MEDI | ✅ | simulations / profit math not comparab | simulated totalCost = totalFeedCost + baselineOtherCosts, but baselineNetProfit (line |
| 70 | MEDI | ✅ | transactions | Financial write endpoints (POST /transactions, POST /expenses, POST /credit) have no  |
| 71 | MEDI | ✅ | water-quality lost measurement time | recordedAt is a @CreateDateColumn (server insert time) and the create DTO exposes no  |
| 72 | MEDI | ✅ | Backend e2e suite non-runnable | `npm run test:e2e` fails 6/6 tests. app.e2e-spec.ts uses TypeOrmModule.forRoot({type: |
| 73 | MEDI | ✅ | content — deletion doc overclaims casc | ACCOUNT_DELETION.md promises account deletion removes 'all farm data you own … (casca |
| 74 | MEDI | 🔷 | Release signing | The release buildType uses signingConfig signingConfigs.debug, so any locally produce |
| 75 | MEDI | ✅ | Docs vs code — frontend architecture | This doc states the frontend 'communicates indirectly with the backend database via t |
| 76 | MEDI | ✅ | Frontend has no lint/test scripts or e | frontend/package.json scripts define only expo start/android/ios/web — no `test` and  |
| 77 | MEDI | ✅ | i18n — hardcoded English in alerts | Login-failure alert bodies are hardcoded English while only the titles use t(): 'The  |
| 78 | MEDI | ✅ | cycles | The button labelled 'Record harvest' (cycles.btnRecordHarvest) navigates to 'HarvestH |
| 79 | MEDI | ✅ | cycles | fetchCycle() catches errors with only console.error; on API failure isLoading becomes |
| 80 | MEDI | ✅ | i18n — backend content rendered raw | The Lunar Molt 'What to do now' playbook is English-only in every language. step.text |
| 81 | MEDI | ✅ | farms | When a scanned QR has a valid prefix but the user lookup fails (not found), resolveUs |
| 82 | MEDI | ✅ | farms | load() swallows all API errors and sets members to [], so a network/server failure re |
| 83 | MEDI | ✅ | finance — pond id must be typed manual | The add-expense form requires formPondId as a raw text Input (placeholderPondId) and  |
| 84 | MEDI | ✅ | finance — invalid date crashes save si | formDate is a free-text field. handleSubmit builds the payload with new Date(formDate |
| 85 | MEDI | ✅ | harvest — no i18n | The entire screen has no useTranslation/t() — every string ('Harvest Plans', 'Mark Co |
| 86 | MEDI | ✅ | inventory — stock management is a stub | Add stock, reduce stock (lines 45-46), edit item (line 53) and stock history (line 17 |
| 87 | MEDI | ✅ | main | Dashboard summary fetch failure is swallowed (console.error) leaving summary null, so |
| 88 | MEDI | ✅ | main | load() catch sets ponds to [], so a network failure renders the 'No ponds / Create fa |
| 89 | MEDI | ✅ | onboarding | handleSaveStep creates a pond then a crop in two non-atomic API calls; if cropsApi.cr |
| 90 | MEDI | ✅ | settings | The offlineSync, pushNotifications and emailAlerts toggles only write to AsyncStorage |
| 91 | MEDI | ✅ | utils / date math | computeDOC does new Date(stockingDate) where stockingDate is 'YYYY-MM-DD', which JS p |
| 92 | MEDI | ✅ | offline sync | drainQueue counts transient failures toward MAX_SYNC_RETRIES. replayQueuedOp returns  |
| 93 | MEDI | ✅ | Auth mirror trigger — no DELETE sync | The auth->public.users mirror installs only INSERT (on_auth_user_created) and UPDATE  |
| 94 | MEDI | ✅ | Dependencies / two libs same job, one  | @getbrevo/brevo SDK is declared as a prod dependency but email.service.ts calls the B |
| 95 | MEDI | ✅ | Dependencies / unused heavy dep | argon2 (a native-compiled dependency) is declared but never imported in any .ts file; |
| 96 | MEDI | ✅ | Dependencies / unused heavy dep | nodemailer is declared as a prod dependency but is never imported anywhere in the rep |
| 97 | MEDI | ✅ | N+1 query | liveBriefing (endpoint GET alert-center live briefing) sequentially awaits pondContex |
| 98 | MEDI | ✅ | Concurrency — double cycle close / dup | closeCycle unconditionally sets status='completed' with no precheck that the crop is  |
| 99 | MEDI | ✅ | Concurrency — two active cycles per po | create() checks pond.activeCycleId then, later (line 78), sets it. There is no DB con |
| 100 | MEDI | ✅ | Unbounded array input | commonNames/symptoms/preventionMeasures/treatmentRecommendations/imageUrls/photoUrls  |
| 101 | MEDI | ✅ | N+1 query | getFarmIdsWithCapability loops over every accessible farm id and calls getRoleOnFarm( |
| 102 | MEDI | ✅ | Unbounded array input (DoS) | boundary: {latitude,longitude}[] is @IsArray() with no size cap and no @ValidateNeste |
| 103 | MEDI | ✅ | missing index | cropId column has no @Index, but it is the query filter in feeding-tray-checks.servic |
| 104 | MEDI | ✅ | N+1 query | createBatch (offline-sync ingest) processes items in a sequential for loop; each item |
| 105 | MEDI | ✅ | Unbounded array input (DoS) | images: string[] has @IsArray()/@IsString({each:true}) but no @ArrayMaxSize, so a req |
| 106 | MEDI | ✅ | Unbounded array input (DoS) | boundary array on pond creation has no @ArrayMaxSize and no element validation; unbou |
| 107 | MEDI | ✅ | missing index | pondId column has no @Index, but getDimensionHistory (ponds.service.ts:374) queries f |
| 108 | MEDI | ✅ | Unvalidated request body | register uses @Body() body: { token: string } — an inline TS type, not a class, so th |
| 109 | MEDI | ✅ | Missing string length limit | notes is @IsString() @IsOptional() with no @MaxLength, allowing arbitrarily large not |
| 110 | MEDI | ✅ | Unbounded array input (DoS) | photoUrls is @IsArray() with no @ArrayMaxSize and no per-element validation; an authe |
| 111 | MEDI | ✅ | Missing string length limit | title and description are @IsString() with no @MaxLength; a client can persist multi- |
| 112 | MEDI | ✅ | Observability — error logged then swal | Water-quality alert creation failures are caught and written with raw `console.error` |
| 113 | MEDI | ✅ | bundle bloat | react-native-maps@1.20.1 (heavyweight native module requiring Google Maps SDK linkage |
| 114 | MEDI | ✅ | Error boundary recovery | A single global ErrorBoundary wraps the whole NavigationContainer, and its "Try Again |
| 115 | MEDI | ✅ | Offline / error state — main dashboard | When the dashboard-summary fetch fails (offline or API error), `summary` stays null a |
| 116 | MEDI | ✅ | Pull-to-refresh — main dashboard | The dashboard useEffect fetches once on mount / selectedFarm change with no focus lis |
| 117 | MEDI | ✅ | Silent failure / error state | fetchSimulations catches errors with only `console.log` and leaves the list empty, so |
| 118 | MEDI | ✅ | Accessibility — missing labels | Icon-only controls (e.g. the arrow-left back button here) carry no accessibilityRole/ |
| 119 | MEDI | ✅ | Pull-to-refresh consistency | SimulationListScreen, FeedingTrayChecksScreen and PondDimensionHistoryScreen render F |
| 120 | MEDI | ✅ | Caching & staleness (in-memory store n | logout() never resets the in-memory notificationStore. notifications/unreadCount/unre |
| 121 | MEDI | ✅ | Ops — no backend CI gate before auto-d | `autoDeploy: true` ships every master commit straight to production, but no GitHub wo |
| 122 | MEDI | ✅ | Ops — free plan cold starts undocument | Service runs on Render `plan: free`, which spins the instance down after ~15 min idle |
| 123 | MEDI | ✅ | Content & copy — untranslated core sur | App offers 6 languages (Hindi/Tamil/Telugu/Bengali/Odia) and localizes all UI strings |
| 124 | MEDI | ✅ | Time & timezone — DOC day boundary | The `computedDOC` entity getter duplicates the same UTC-vs-IST DOC bug as crops.servi |
| 125 | MEDI | ✅ | Time & timezone — DOC convention misma | Crop/entity DOC uses stocking-day = 0 (`diffDays + initialAgeDays`), but measurement. |
| 126 | MEDI | ✅ | Time & timezone — DOC day boundary | computeDOC parses the DATE column `stockingDate` ('YYYY-MM-DD') as UTC midnight and d |
| 127 | MEDI | ✅ | Time & timezone — daily feed bucket | getDailyFeedUsage builds the day window with `setHours(0,0,0,0)`/`setHours(23,59,59,9 |
| 128 | MEDI | ✅ | backend DTO / date bounds | harvestDate is only @IsDateString with no upper bound or ordering against the crop's  |
| 129 | MEDI | ✅ | backend calc / DOC derivation | deriveDoc returns Math.floor((measuredAt - stocking)/day)+1 with no floor at 1; a mea |
| 130 | MEDI | ✅ | CI coverage | CONTRIBUTING promises 'Green CI/local gates' and the security/test checklist, but the |
| 131 | MEDI | ✅ | Content & copy — terminology (crop vs  | The same production batch is labeled 'Crop' and 'Cycle' interchangeably across the UI |
| 132 | MEDI | ✅ | Content & copy — misleading feature pr | Settings shows an 'Email Summaries — Weekly performance reports' toggle, but no weekl |
| 133 | MEDI | ✅ | Content & copy — brand naming | Product name is spelled two ways in user-facing copy: 'UpCheck' (settings.ts:41,65,71 |
| 134 | MEDI | ✅ | Google Sign-In web divergence | Same ungated GoogleLoginButton on the Login screen: rendered on web while Truecaller  |
| 135 | MEDI | ✅ | Google Sign-In web divergence | The GoogleLoginButton is rendered unconditionally on every platform, but signInWithGo |
| 136 | MEDI | ✅ | frontend form / stocking count validat | Client validation is only `!stockingCount // isNaN(parseInt(stockingCount))`; `parseI |
| 137 | MEDI | ✅ | Connection & wiring — pagination trunc | pondsApi.getAll(farmId) is called with no take param; backend /ponds is paginated wit |
| 138 | MEDI | ✅ | Connection & wiring — pagination trunc | Crop total feed is computed by summing feedApi.getByCrop(cropId), but /feed-records d |
| 139 | MEDI | ✅ | Connection & wiring — pagination trunc | feedApi.getByCrop/getAll are called once with no take param and the screen has no pag |
| 140 | MEDI | ✅ | Connection & wiring — pagination trunc | waterQualityApi.getAll(pondId) is called once with no take param and no pagination UI |
| 141 | LOW | ✅ | alerts / inconsistent severity vocabul | createAutoAlert types severity as 'info'/'warning'/'critical' and the entity comment  |
| 142 | LOW | ✅ | Dead auth code / latent bug | RolesGuard and PermissionsGuard read user.roles, but the global JwtAuthGuard sets req |
| 143 | LOW | ✅ | credit | recordRepayment does `row.repaid = round2(Number(row.repaid) + amount)` with no sign/ |
| 144 | LOW | ✅ | pii-in-logs | Recipient email addresses are logged at info level ('Email sent via Brevo API to ${to |
| 145 | LOW | ✅ | Dead email templates | sendVerificationEmail/sendPasswordResetEmail/sendOtpEmail/sendWelcomeEmail/sendPasswo |
| 146 | LOW | ✅ | feed-records fasting guard bypass on u | The fasting-day enforcement (quantityKg must be 0 when isFasting) runs only in create |
| 147 | LOW | ✅ | tray number validation | trayNumber is @IsNumber with no @Min/@IsInt, so zero, negative, or fractional tray nu |
| 148 | LOW | ✅ | feeding-tray-checks weak enum validati | remainingFeedStatus is validated only as @IsString despite the entity documenting a f |
| 149 | LOW | ✅ | finances | getCycleFinancials sums Number(amount) in JS floating point and returns totalRevenue/ |
| 150 | LOW | ✅ | measurement / DOC derived from unowned | create() verifies ownership of dto.pondId but deriveDoc looks up dto.cropId with no c |
| 151 | LOW | ✅ | pnl | computeCropPnl authorizes via cropsService.findOne (crop owner only) while expenses.g |
| 152 | LOW | ✅ | products | updateStock uses @Body('quantity') quantity: number with no DTO/validation and sets s |
| 153 | LOW | ✅ | Input validation | inviteFriend takes an inline { toEmail: string } with no DTO/@IsEmail, so the global  |
| 154 | LOW | ✅ | Push stale tokens | sendToUser only catches non-2xx from Expo; Expo returns HTTP 200 with body data[].sta |
| 155 | LOW | ✅ | sampling ignores requested crop | create() hard-codes cropId: pond.activeCycleId and ignores the DTO's optional cropId, |
| 156 | LOW | ✅ | calc DTO validation gaps | FCR/ADG/survival/feeding/expected-harvest DTOs have @IsNumber with no @Min, so negati |
| 157 | LOW | ✅ | biomass GET returns NaN | biomass reads query params via Number(stockCount)/Number(averageWeightG) with no vali |
| 158 | LOW | ✅ | Dead code / token cleanup | SupabaseService (~280 lines, a parallel auth/user/token data layer) is never injected |
| 159 | LOW | ✅ | Docs vs code — deep-link scheme | APP_FLOW.md says the password-reset flow uses deep link `upcheck://`, but the app's a |
| 160 | LOW | ✅ | Docs vs code — public endpoint surface | FEATURES.md claims '`GET price*` is `@Public()`', implying both GET /india/price and  |
| 161 | LOW | ✅ | Build config / stale comment | The comment claims truecaller-sdk:2.7.0 is "used by the native bridge in com.upcheck. |
| 162 | LOW | ✅ | Android permissions | RECORD_AUDIO is requested, but the camera is used only for QR scanning (frontend/src/ |
| 163 | LOW | ✅ | Deep links | A second intent-filter sets android:autoVerify="true" on the custom scheme "upcheckap |
| 164 | LOW | ✅ | Android permissions | SYSTEM_ALERT_WINDOW ("display over other apps") is declared in the production main ma |
| 165 | LOW | ✅ | Android permissions | WRITE_EXTERNAL_STORAGE (and READ_EXTERNAL_STORAGE line 3) are declared without androi |
| 166 | LOW | ✅ | committed-config | A live Supabase project URL (mcslntwchfucavjrrhnu.supabase.co) and publishable anon k |
| 167 | LOW | ✅ | Dependency version | @react-native-picker/picker is pinned ^2.11.4 while the installed Expo SDK 54 expects |
| 168 | LOW | ✅ | api / token refresh | Requests queued behind an in-flight refresh are retried via apiClient(originalRequest |
| 169 | LOW | ✅ | Inert lint suppressions hide stale-clo | react-hooks/exhaustive-deps is disabled here and in 4 screens (CreatePondScreen, Refe |
| 170 | LOW | ✅ | i18n — dead/orphan translation keys | All five non-English locales carry engines.lunar.stepPeak/stepPre/stepPost/stepNoHand |
| 171 | LOW | ✅ | auth | Reset-password validation only checks password.length < 8, weaker than the enforced s |
| 172 | LOW | ✅ | calculators — wasted API call | handleCalculate calls calculatorsApi.calculateCultivationPerformance and stores perfR |
| 173 | LOW | ✅ | cycles | Stocking date is a free-text Input with no validation and no date picker (inconsisten |
| 174 | LOW | ✅ | farms | During pendingFarmSetup this screen (the forced first-run route) has no header, back, |
| 175 | LOW | ✅ | harvest — dead code | Lines 259-261 are a no-op ternary (Alert.prompt !== undefined ? undefined : undefined |
| 176 | LOW | ✅ | logs — missing range validation on two | Nitrate (line 112) and Hardness (line 115) ParameterInput are rendered without a para |
| 177 | LOW | ✅ | notifications — hardcoded string | The timestamp row concatenates a literal ' at ' between date and time ({date} at {tim |
| 178 | LOW | ✅ | ponds | handleSave only validates namePrefix and depth; a rectangular/raceway/circular pond c |
| 179 | LOW | ✅ | ponds | DOC is computed 0-based here (calculateDOC returns floor(diff)) and in CycleDetailScr |
| 180 | LOW | ✅ | ponds | getDimensionHistory failure is swallowed to an empty list, so a network/server error  |
| 181 | LOW | ✅ | shop — products not interactive | The Shop lists products with price/sale-price/stock but product cards have no onPress |
| 182 | LOW | ✅ | Doc claim vs reality | Doc states "...`tsc --noEmit` clean, backend lint clean." tsc is clean, but backend l |
| 183 | LOW | ✅ | Dependencies / unused direct dep | ua-parser-js is a direct prod dependency (and flagged for a ReDoS advisory GHSA-9h5v- |
| 184 | LOW | ✅ | Dependencies / unused dep + misplaced  | zxcvbn (runtime dep, line 62) and its @types/zxcvbn (line 41) are never imported in a |
| 185 | LOW | ✅ | Dependencies / redundant deprecated ty | @types/otplib@10.0.0 is a deprecated stub types package, but the installed otplib@12  |
| 186 | LOW | ✅ | Ops — silent misconfig fallback in pro | When DATABASE_URL is unset the code logs a warning via console.error and silently fal |
| 187 | LOW | ✅ | Missing string length limit | name (and other string fields at lines 19/27/50/57) have no @MaxLength; a 1MB farm na |
| 188 | LOW | ✅ | Unbounded array input | priceBands array feeds an economics computation but has no @ArrayMaxSize; a large arr |
| 189 | LOW | ✅ | Widespread missing input caps | Only 3 of 88 DTOs use @MaxLength and the global ValidationPipe sets no default length |
| 190 | LOW | ✅ | Account deletion — no re-authenticatio | DeleteAccountDto (backend/src/auth/dto/delete-account.dto.ts) defines an optional pas |
| 191 | LOW | ✅ | Caching & staleness (stale cache after | getDashboardSummary caches the summary for 300s but no write path (feed record create |
| 192 | LOW | ✅ | bundle bloat | react-native-linear-gradient@2.8.3 is unused (no imports in frontend/src); expo-linea |
| 193 | LOW | ✅ | Dependencies / duplicate lib same job | react-native-linear-gradient is a prod dependency but every gradient usage in src imp |
| 194 | LOW | 🔷 | Dependencies / fragile patched fork | The patch-package patch hard-removes the TurboModule code path (`isTurboModuleEnabled |
| 195 | LOW | ✅ | UI overlap — status banners | OfflineIndicator (top: insets.top, zIndex 999) and SyncAttentionBanner (top: insets.t |
| 196 | LOW | ✅ | Caching & staleness (in-memory store n | uploadStore has no reset and is never cleared on logout; user A's pending/failed phot |
| 197 | LOW | ✅ | CI / build workflow | The APK build workflow runs `npm install -g expo-cli` (the legacy global CLI, depreca |
| 198 | LOW | ✅ | git hygiene / debris | Captured run-output and one-off debug scripts are committed to the repo: backend/outp |
| 199 | LOW | ✅ | git hygiene / duplication | backend/scripts/verify_2fa.ts and backend/verify_2fa.mjs are the same manual 2FA smok |
| 200 | LOW | ✅ | backend DTO / crop name shape | name is @IsString() only — an empty string '' (and unbounded 1000-char / emoji / RTL  |
| 201 | LOW | ✅ | backend DTO / SR upper bound | targetSrPercent is @Min(0) with no @Max(100); a survival-rate target of 150% is accep |
| 202 | LOW | ✅ | Content & copy — date formatting for I | Password-changed security email interpolates `new Date().toLocaleString()` with no lo |
| 203 | LOW | ✅ | backend DTO / sampling date & text bou | samplingDate is only @IsDateString (future dates accepted) and mbwG/notes have no @Ma |
| 204 | LOW | ✅ | backend calc DTO / survival over 100% | CalculateSurvivalRateDto has no @Min and no cross-check that harvestedCount <= initia |
| 205 | LOW | ✅ | docs accuracy | The reference feature matrix cites specific source lines that have drifted and are no |
| 206 | LOW | ✅ | Content & copy — chemical formula form | The calculator hub card title reads 'Free Ammonia (NH3)' with a plain digit, while th |
| 207 | LOW | ✅ | Content & copy — inconsistent severity | The disease log severity field placeholder suggests 'Mild, Moderate, Severe' (logs.ts |
| 208 | LOW | ✅ | Local notifications web divergence | scheduleDailyWaterQualityReminders/scheduleWeeklyChemistryReminder (the 'continuous-d |
| 209 | LOW | ✅ | git hygiene / debris | The repo-root package-lock.json is an empty stub ({name:'Upcheckapp', packages:{}}) w |
| 210 | IMPR | ✅ | Redis error handling | No client.on('error') listener is attached; the service leans on ioredis' internal 'U |
| 211 | IMPR | ✅ | Dark mode — dead code / false support | A full `dark` color-role palette is exported but never referenced anywhere; all 118 s |
| 212 | IMPR | ✅ | git hygiene / IDE artifacts | A Kiro IDE working-spec tree (11 files under .kiro/specs, including .config.kiro dotf |
| 213 | IMPR | ✅ | Content & copy — inconsistent example  | Date-field example/placeholder years are inconsistent across the app: stocking date e |
| 214 | IMPR | ✅ | Android native SDK in shared bundle | authStore (loaded on every platform at startup) imports TruecallerAuth, whose module  |
---

## Corrections

**Row 65 (audit #7, "Authorization consistency — members locked out") — marked `✅*`: was only PARTIALLY remediated when first ticked.**

The original pass moved `pnl`, `water-quality`, `feed-records` and `ponds.controller` onto the member-aware paths, but the engine and reporting services were left on the owner-only `pondsService.findOne` / `cropsService.findOne`. Twenty call sites were still owner-only across `crops`, `disease-warning`, `feed-advisor`, `harvest-timing`, `measurement`, `pond-context` and `reports`, so a `manager` could log water quality but was still 403'd starting a cycle, opening a feed plan, or viewing a disease warning on the same pond — the exact symptom the finding describes.

Completed in `fix/manager-role-capabilities` (W1 of `docs/FARM_ACCESS_REMEDIATION_PLAN.md`):

- All 20 sites moved to `findOneAccessible` / `verifyAccess` with an explicit capability matching the route guard.
- The six controllers that had **no `OwnershipGuard` at all** (`feed-advisor`, `disease-warning`, `measurement`, `pond-context`, `harvest-timing`, `reports`) now declare `@OwnsResource` per route, so the policy is enforced twice and visible where the route is defined.
- `PondsService.findOne` renamed to `findOneAsOwner`; the owner-only method no longer sits next to `findOneAccessible` under a name that invites misuse. `CropsService.findOne` keeps its name but is documented as the `VIEW_FINANCIALS` economics path.
- Fixed a gap the plan did not list: `measurement.edit()` authorized via `findOne`, which W1 moved to `READ` — that would have let a **viewer** edit measurements. It now asserts `WRITE_OPERATIONAL` explicitly.
- Two new regression specs: `farm-access/route-capabilities.spec.ts` pins every route's `@OwnsResource` metadata (including the two routes that intentionally have none), and `farm-access/w1-role-matrix.spec.ts` drives all four roles through the real access chain for each W1 operation.
