# Chiaro

Civic-engagement app: address → districts → elected officials → (future) bills + votes. pnpm workspaces + Turborepo monorepo; Next.js 15 + React 19 (web), Expo + react-native (mobile), Supabase Postgres + PostGIS + Edge Functions (backend).

## Quick start

```bash
pnpm install                           # workspace deps; uses pnpm 9.x

# Local backend
pnpm db:start                          # boot local Supabase (port 54321; DB 54322)
pnpm db:reset                          # apply all migrations 0001–0013
pnpm db:test                           # pgTAP suite (106 tests across 10 files)
pnpm seed:tiger                        # ingest TIGER 2024 district geometries (~5–15 min, ~51 Census shapefiles)
pnpm seed:officials                    # ingest federal officials from Congress.gov v3 (requires CONGRESS_GOV_API_KEY)

# App dev
pnpm --filter @chiaro/web dev          # Next.js on http://localhost:3000
pnpm --filter @chiaro/mobile dev       # Expo Metro

# Verify before push
pnpm -r typecheck                      # 8 packages
pnpm test                              # full workspace tests via turbo (see Gotchas: don't use `pnpm -r test`)
pnpm --filter @chiaro/web build        # Next 15 build
```

## Architecture

```
apps/
  web/                # Next 15 App Router, RSC + 'use client' islands
  mobile/             # Expo Router (typedRoutes), iOS + Android
packages/
  db/                 # Supabase migrations, Database type, seed scripts (TIGER + Congress.gov), Edge Functions
  supabase-client/    # ChiaroClient wrapper + auth helpers (signUp/signIn/getSession)
  profile/            # citizen profile domain (queries + types)
  location/           # districts + user_locations (queries, TanStack hooks, district groups, schema)
  officials/          # federal officials domain (queries, TanStack hooks, types, zod schemas)
  ui-tokens/          # shared design tokens (COLORS, MAP_COLORS, PARTY_COLOR/LABEL/SHORT)
```

Dependency direction is strict — see Gotchas #4.

## Slices delivered

- **Slice 1 — auth + profile** (2026-05-05): signup/signin, profile completion. Migrations 0001–0002.
- **Slice 2 — location calibration** (2026-05-07): GeocodIO Edge Function, districts ingest, Leaflet/react-native-maps. Migrations 0003–0008.
- **Slice 3 — officials** (2026-05-15): federal house + senate via Congress.gov v3, TanStack Query hooks, home card + list + detail (web + mobile). Migrations 0009–0013.
- **Slice 3.5 — cleanup** (2026-05-15): DistrictPanel TanStack migration, inline color → `@chiaro/ui-tokens`, on-device DoD checklist, CI test hygiene.

Specs live in `docs/superpowers/specs/`. Plans in `docs/superpowers/plans/`. Audits in `docs/superpowers/audits/`. Mobile DoD checklist at `docs/superpowers/mobile-dod-checklist.md`.

## Environment variables

| Var | Needed by | Notes |
|---|---|---|
| `CONGRESS_GOV_API_KEY` | `pnpm seed:officials` | Free signup at api.data.gov. Server-side only. |
| `GEOCODIO_KEY` | `calibrate-location` Edge Function + slice 2 live integration tests | Required for real address resolution. CI gets it from a repo secret. |
| `SUPABASE_DB_URL` | Seed scripts | Defaults to local Supabase (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` | Integration tests (officials, location) | Pull locally via `supabase status --output env --workdir packages/db`. CI captures from `supabase status` output of the workflow-started instance. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web` build | Build collects page data even without a live backend; placeholder strings are fine. |

See `.env.example` files at repo root + `apps/web/`.

## Testing

- **pgTAP**: `pnpm db:test` → 106 tests across 10 files. Requires `pnpm db:start` and `pnpm db:reset`. Some tests (TIGER ingest assertions) require `pnpm seed:tiger` to have run first.
- **Vitest**: `pnpm test` → turbo-managed, runs each package's test script. Officials integration tests need Supabase env vars exported first.
- **CI** (`.github/workflows/ci.yml`): 4 jobs — `db` (migrations + pgTAP + officials-ingest fixture suite), `build` (Next 15), `functions` (Deno tests for Edge Function), `test` (full workspace tests). Each job boots a fresh local Supabase via `supabase/setup-cli`.

## Gotchas

1. **Supabase JS `storageKey` collision** — if you `createClient(url, anonKey)` and `createClient(url, serviceKey)` in the same process without explicit `auth.storageKey` per client, both share the default key. Calling `anon.auth.signInWithPassword(...)` overwrites the `svc` client's session, and subsequent `svc.from(t).delete()` returns HTTP 403 silently. `svc.auth.admin.*` still works because it uses the API key directly. The `Multiple GoTrueClient instances detected` warning is the bug signal. Pass `{ auth: { persistSession: false, storageKey: 'unique-string' } }` to each `createClient`. See `packages/officials/test/queries.integration.test.ts:24–35` for the pattern.

2. **TIGER district code format** — house: `${STATE}-${2-digit zero-padded number}` (`CA-12`, `CA-01`). At-large house: `${STATE}-AL` (`WY-AL`, NOT `${STATE}-0`). Senate: two rows per state with codes `${STATE}-S1` and `${STATE}-S2` (same geometry; officials-ingest collapses both lookups to a single `federal_senate:${STATE}` key). See `packages/db/supabase/seed/tiger-config.ts:33–37` and `officials-ingest.ts` `districtKey()` / `loadDistrictMap()`.

3. **PostGIS column types are strict** — `districts.geometry` is `geography(MultiPolygon, 4326)`. A bare `POLYGON(...)` literal fails the type check. Always use `MULTIPOLYGON(((...)))` in test seeds. `user_locations.home_location` is `geography(Point, 4326)` — use `POINT(...)`.

4. **Workspace dependency direction is one-way** — `@chiaro/officials` depends on `@chiaro/db` (for `Database` type), so `@chiaro/db` may NOT import from `@chiaro/officials`. Turborepo refuses to build cyclic workspace deps. Congress.gov-specific normalize logic lives in `packages/db/supabase/seed/normalize.ts`, NOT in `@chiaro/officials`.

5. **Officials ingest defensive guards** — `officials-ingest.ts` enforces pre-flight count check (`MIN_HOUSE_COUNT=400`, `MIN_SENATE_COUNT=95`) + threshold guard on deactivations. If a re-ingest would deactivate >max(5, 1% of active), the script aborts and prints `Refusing to deactivate N officials … re-run with --allow-deactivations=N`. Pass `--allow-deactivations=N` (exact match required) to acknowledge an expected mass-deactivation event like a congressional turnover.

6. **TIGER seed is a prerequisite for full pgTAP green** — `pnpm db:reset` alone leaves 4 `tiger_ingest.test.sql` tests failing (they assert specific row counts that require TIGER data). CI's `db` job runs `seed:tiger` before `db:test`. Locally, expect those 4 failures unless you also ran `seed:tiger`.

7. **`pnpm test` not `pnpm -r test`** — `pnpm -r test` runs packages in parallel and races on the shared local Supabase, causing intermittent failures (e.g., the ingest happy-path's deactivation sweeps officials seeded by a parallel test). The canonical command is `pnpm test`, which goes through turbo and respects `^test` topological serialization (see `turbo.json`). If you must use pnpm-recursive directly: `pnpm -r --workspace-concurrency=1 test`.

## Code style

- TypeScript strict mode everywhere (`tsc --noEmit`).
- ES2022 / ESNext modules; `moduleResolution: "Bundler"` + `allowImportingTsExtensions: true` — relative imports use the `.ts` extension (e.g. `./types.ts`, not `./types`).
- Domain packages follow a stable shape: `types.ts` (Database-derived row types + domain types), `queries.ts` (raw async fetchers taking a `ChiaroClient`), `keys.ts` (TanStack hierarchical query-key factory), `hooks.ts` (TanStack `useQuery` wrappers, 5 min staleTime / 30 min gcTime), `schemas.ts` (zod for external-payload validation).
- Inline hex colors are forbidden — pull from `@chiaro/ui-tokens` (`COLORS.brand.*`, `COLORS.neutral.*`, `MAP_COLORS.*`, `PARTY_*`).
- pnpm version pinned via `packageManager: pnpm@9.12.0`.

## Memory + spec-driven workflow

This project uses the superpowers brainstorming → writing-plans → subagent-driven-development workflow. New slices land as: spec at `docs/superpowers/specs/YYYY-MM-DD-<slice>-design.md`, plan at `docs/superpowers/plans/YYYY-MM-DD-<slice>.md`, then per-task implementer + spec-reviewer + code-quality-reviewer subagents. Audits at `docs/superpowers/audits/YYYY-MM-DD-audit.md` track follow-ups between slices.
