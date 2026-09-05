# Phase 2 — must have (execution plan)

Scope is spec §4 (`docs/superpowers/specs/2026-09-03-phased-remediation-research.md`).
This file only records the stage split and file ownership; the spec is the requirement source.

Branch: `feat/phase2-must-have` off master `8fabec3`.

## Stage A — backend (parallel, 4 agents)

| Agent | Scope (spec) | Owns |
|---|---|---|
| A1 | §4.3 activity endpoint | `backend/src/activity/**`, migration `1780600400000` (index only, if needed) |
| A2 | §4.1 farm archive/delete | `backend/src/farms/**`, migration `1780600100000-AddFarmArchivedAt` |
| A3 | §4.7 inventory backend + D1-D14 backend half, feed->inventory link | `backend/src/inventory/**`, `backend/src/feed-logs/**`, migration `1780600200000-AddInventoryIcon` |
| A4 | §4.5/§4.6 latest-per-column + chemistryOnly, §4.2 `pendingJoins`/own-leave on team-overview | `backend/src/water-quality/**`, `backend/src/team-overview/**` |

Shared files NO agent edits (I apply after): `backend/src/app.module.ts`,
`backend/src/farm-access/route-capabilities.spec.ts`, `backend/src/farm-access/farm-capability.ts`.
Agents report the entries they need in their final message.

## Stage B — frontend (parallel, after Stage A APIs land)

| Agent | Scope | Owns |
|---|---|---|
| B1 | §4.1 archive/delete UI + first-save-lock confirm | Farms/Pond screens |
| B2 | §4.2 team hub + badges | `AllWorkersScreen`, Team tab |
| B3 | §4.3 ActivityScreen + day view + CSV | new screens, `utils/csv.ts` |
| B4 | §4.4 cycle history | `CycleListScreen`, `CycleDetailScreen` |
| B5 | §4.5/§4.6 chemistry screen + history + WQ prefill | water quality screens |
| B6 | §4.7 inventory UI + §4.8 PondPicker | inventory screens, `PondPicker` |

Shared frontend files I own: `src/i18n/locales/*`, `src/navigation/**`, `src/api/client.ts`,
`src/query/client.ts`. Agents append i18n keys to `en.json` only and list the rest for me.

## Stage C — gate, PR, deploy, OTA
`npx tsc --noEmit` + `npx jest --maxWorkers=2 --forceExit` per package,
`bash scripts/check-calculator-i18n.sh`, migrations hand-run on prod, PR, merge, OTA.

## Constraints
OTA-only frontend (no new native dep). Do not touch auth. Six locales must stay at parity.
