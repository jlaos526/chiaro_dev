# Location Calibration Foundation — Design

**Date:** 2026-05-05
**Status:** Draft for review
**Slice:** Second vertical slice — multi-tier district resolution, calibration UI on web + mobile, district-boundary map preview, edit-from-Settings.

## Goal

Stand up the smallest end-to-end slice of Chiaro that proves the **location** pillar works on the same stack slice 1 established:

1. A signed-up user with a completed profile can calibrate their home location on web or mobile.
2. Calibration resolves the address to **multi-tier districts** — federal house, federal senate (by state), state senate, state house, county, place — via GeocodIO.
3. Districts persist in a canonical `districts` table; the user is linked through a junction table; the user's address + lat/lng are stored privately under self-only RLS.
4. The home screen renders a district list and a map preview with per-tier checkbox toggles (Leaflet on web, `react-native-maps` on mobile). The Settings screen surfaces an Edit Address sub-page.
5. RLS is enforced and tested at the same rigor as slice 1.

No officials data, no bills, no alignment calibration, no notifications. The only purpose of this slice is to lock in the location data model, geocoding boundary, and TIGER ingest pipeline that every later civic-engagement feature builds on.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Slice scope | Location foundation only — no officials, no bills |
| 2 | Visible outcome | District code on home + interactive map preview + Edit-from-Settings |
| 3 | Geocoder + district resolution | GeocodIO (live API) end-to-end for address → districts; TIGER 2024 shapefiles ingested locally for boundary geometry |
| 4 | Map renderer | Leaflet on web, `react-native-maps` on mobile (separate app-local components) |
| 5 | Address-derived storage | `home_address_text` + `home_location` (rooftop `geography(Point)`) on `user_locations`; districts via junction (see #6) |
| 6 | Schema split | Hybrid — `user_districts` junction is public-readable (slice 3 "find users in NY-12"), `user_locations` (address + coords) is self-only |
| 7 | District tiers in scope | federal_house, federal_senate, state_senate, state_house, county, place |
| 8 | Address input | Web: typed full address. Mobile: typed address + GPS button (`expo-location`) |
| 9 | Mobile parity in slice 2 | Yes — both apps ship in this slice |
| 10 | Calibration trigger | Inserted as post-profile-fill step `/calibrate`; "Skip for now" allowed (session-cookie suppresses redirect); Settings/address always available |
| 11 | GeocodIO test strategy | Live in CI on every PR; pinned API field flags |
| 12 | Server-side geocoding | Supabase Edge Function `calibrate-location` (single deploy target for both apps; GeocodIO key never leaves the server) |

## Architecture

### Monorepo additions

```
packages/
  db/
    supabase/
      migrations/
        0003_districts.sql            # canonical districts + PostGIS extension + tier enum
        0004_districts_rls.sql        # public-readable; no client writes
        0005_user_locations.sql       # self-only RLS
        0006_user_districts.sql       # public-readable junction; no client writes
      tests/
        districts_rls.test.sql
        user_locations_rls.test.sql
        user_districts_rls.test.sql
        tiger_ingest.test.sql
      functions/
        calibrate-location/
          index.ts                    # Deno Edge Function
          index.test.ts               # Deno test (Layer 3)
      seed/
        tiger-ingest.ts               # Node script — downloads + ingests TIGER 2024
  location/                           # NEW feature package
    src/
      schema.ts                       # zod schema for address input
      types.ts                        # DistrictTier enum, response types
      queries.ts                      # getMyLocation, getMyDistricts
      index.ts
    test/
      integration.test.ts             # Layer 2 — real Supabase + live GeocodIO

apps/web/
  app/
    calibrate/page.tsx                # client component
    settings/
      layout.tsx                      # settings shell
      page.tsx                        # settings index (links to address; sign-out)
      address/page.tsx                # edit address
  components/DistrictMap.tsx          # Leaflet wrapper
  middleware.ts                       # extended: redirects uncalibrated users to /calibrate

apps/mobile/
  app/(app)/
    calibrate.tsx                     # form + GPS button
    settings/
      _layout.tsx
      index.tsx
      address.tsx
  components/DistrictMap.tsx          # react-native-maps wrapper
  lib/location-permissions.ts         # expo-location permission flow
```

### Dependency direction (extends slice 1)

```
apps/web    ─┐
              ├─→ packages/location ─→ packages/supabase-client ─→ packages/db (types)
apps/mobile ─┘                                          ↑
                                                        │
                            Edge Function (server) ─────┘
                                    │
                                    └─→ GeocodIO (HTTPS, server-only key)
```

`packages/location` exposes only client-facing query functions and types. The calibration *mutation* is `client.functions.invoke('calibrate-location', { address | { lat, lng } })`. The Edge Function is the only place the GeocodIO key is read; it lives in `packages/db/supabase/functions/` because the function is part of the data layer's public contract.

### Why an Edge Function (not Next.js Route Handler)

GeocodIO's API key cannot ship in mobile or web client bundles. The two server choices are a Next.js Route Handler (web app) or a Supabase Edge Function:

- A Route Handler on the web app would force the **mobile app** to call the *deployed web URL* — bad coupling, awkward auth threading.
- An Edge Function is a single deploy target, identically reachable from both apps via `supabase-js`, with the user's JWT already authenticated by Supabase before the handler runs.

The Edge Function lives at `packages/db/supabase/functions/calibrate-location/` so it ships and tests with the schema it depends on.

## Database

### Migration `0003_districts.sql`

```sql
create extension if not exists postgis;

create type district_tier as enum (
  'federal_house', 'federal_senate',
  'state_senate', 'state_house',
  'county', 'place'
);

create table public.districts (
  id              uuid                primary key default gen_random_uuid(),
  tier            district_tier       not null,
  state           text                not null check (state ~ '^[A-Z]{2}$'),
  code            text                not null,
  name            text                not null,
  geometry        geography(MultiPolygon, 4326) not null,
  source_version  text                not null,
  unique (tier, code)
);

create index districts_geometry_gix on public.districts using gist (geometry);
create index districts_tier_state on public.districts (tier, state);
```

### Migration `0004_districts_rls.sql`

```sql
alter table public.districts enable row level security;

create policy "districts_select_all" on public.districts
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.districts from anon, authenticated;
```

Writes happen exclusively via the seed script running as the postgres role.

### Migration `0005_user_locations.sql`

```sql
create table public.user_locations (
  id                  uuid          primary key references auth.users(id) on delete cascade,
  home_address_text   text          not null,
  home_location       geography(Point, 4326) not null,
  geocodio_response   jsonb         not null,
  calibrated_at       timestamptz   not null default now()
);

alter table public.user_locations enable row level security;

create policy "user_locations_select_self" on public.user_locations
  for select to authenticated
  using (id = (select auth.uid()));

revoke insert, update, delete on public.user_locations from anon, authenticated;
```

Writes happen exclusively via the Edge Function (service-role).

### Migration `0006_user_districts.sql`

```sql
create table public.user_districts (
  user_id      uuid           not null references auth.users(id) on delete cascade,
  district_id  uuid           not null references public.districts(id) on delete cascade,
  tier         district_tier  not null,
  created_at   timestamptz    not null default now(),
  primary key (user_id, district_id)
);

create index user_districts_district on public.user_districts (district_id);
create index user_districts_tier on public.user_districts (tier);

alter table public.user_districts enable row level security;

create policy "user_districts_select_all" on public.user_districts
  for select to authenticated using (true);

revoke insert, update, delete on public.user_districts from anon, authenticated;
```

### Schema rationale

- **Junction over JSON.** Multi-tier districts are a many-to-many relationship; a junction table gives referential integrity, fast filter by district (slice 3 "users in NY-12"), and lets `districts.geometry` be queried once and reused. JSON would duplicate display data per user and lose foreign-key integrity.
- **Public-readable `user_districts`** per Q6c. Districts are not sensitive — they're effectively a coarse public attribute. The sensitive data (exact address + rooftop coords) is isolated in `user_locations` with self-only SELECT.
- **`tier` denormalized on `user_districts`** for fast filter without joining `districts`. Trivial to keep consistent (only the Edge Function writes; tier comes from the canonical row at insert time).
- **`geocodio_response jsonb`** stored as audit/debug cache. Lets us re-derive districts after a TIGER refresh without re-paying GeocodIO; lets debugging trace exactly what the vendor returned. Acceptable size (~3-5 KB per row); compresses well in Postgres TOAST.
- **`source_version` on `districts`** so a future TIGER 2026 ingest can run idempotently (truncate-and-reload by version).
- **`(select auth.uid())`** continues the slice 1 performance pattern.
- **No insert policy on `user_districts` or `user_locations`.** Like slice 1's `profiles` table, only a single trusted writer (the Edge Function) creates rows; eliminates a class of "wrong user_id on insert" bugs.

## Edge Function — `calibrate-location`

### Inputs

```ts
type CalibrateInput =
  | { address: string }                  // typed path (web + mobile)
  | { lat: number; lng: number }         // GPS path (mobile)
```

The user's JWT is read from the `Authorization: Bearer <token>` header. Supabase Edge Functions verify the JWT before the handler runs; the function uses `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` for DB writes.

### Sequence

```
1. authenticate (verify JWT, extract user_id)
2. call GeocodIO with fields=cd118,state_legislative_districts,census2020
3. begin TXN
   a. delete from user_districts where user_id = $uid
   b. upsert user_locations (id, home_address_text, home_location, geocodio_response, calibrated_at)
        on conflict (id) do update
   c. for each tier in TIERS:
        select districts.id where tier = $1 and code = extractCode(geocodio, $1)
        if found: insert user_districts (user_id, district_id, tier)
        else:     log.warn({ tier, code, user_id })
4. commit
5. respond { home_location, districts: [{ tier, code, name }, ...] }
```

### `extractCode` mapping

| Tier | Source field in GeocodIO response |
|---|---|
| `federal_house` | `congressional_districts[0].district_number` → `"<state>-<NN>"` |
| `federal_senate` | Two rows per state — `code = "<state>-S1"` and `code = "<state>-S2"`, both with `geometry = state boundary`. User's calibration inserts both into `user_districts`. Each senator (slice 3+) references one of the two rows. |
| `state_senate` | `state_legislative_districts.senate[0].district_number` → `"<state>-SS-<NN>"` |
| `state_house` | `state_legislative_districts.house[0].district_number` → `"<state>-SH-<NN>"` (Nebraska skipped — unicameral) |
| `county` | `census.2020[0].full_fips` (5-digit county FIPS) |
| `place` | `census.2020[0].place_fips` (7-digit place FIPS) |

The exact field paths are pinned to GeocodIO's `cd118` flag set; the live test in CI is the schema-drift trip-wire.

### Output

```ts
type CalibrateResponse = {
  home_location: { lat: number; lng: number }
  districts: Array<{ tier: DistrictTier; code: string; name: string; state: string }>
}
```

### HTTP status codes

| Code | When |
|---|---|
| 200 | Success |
| 400 | Address missing / unparseable / GeocodIO returned no candidates |
| 401 | No JWT or invalid JWT |
| 422 | GeocodIO returned coords but no district fields (rare; e.g., territories) |
| 502 | GeocodIO 5xx or timeout (>10s) |
| 500 | DB error or unexpected exception |

## Client wiring

### `packages/location/src/`

```ts
// schema.ts
export const addressInputSchema = z.object({
  address: z.string().trim().min(5).max(200),
})
export const gpsInputSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
})

// types.ts
export const DISTRICT_TIERS = [
  'federal_house', 'federal_senate',
  'state_senate', 'state_house',
  'county', 'place',
] as const
export type DistrictTier = typeof DISTRICT_TIERS[number]

// queries.ts
export async function getMyLocation(client: ChiaroClient)
  : Promise<{ home_address_text: string; home_location: GeoJSONPoint; calibrated_at: string } | null>

export async function getMyDistricts(client: ChiaroClient)
  : Promise<Array<{ id: string; tier: DistrictTier; code: string; name: string; state: string; geometry: GeoJSONMultiPolygon }>>
```

`getMyDistricts` joins `user_districts` ⇒ `districts` and emits geometry as GeoJSON via `ST_AsGeoJSON`. One round-trip per home render.

### Web

- **Middleware update.** Slice 1's matcher already runs on every request. Add a check after auth: if `profile.completed && !user_locations_exists && path !== '/calibrate' && cookie['chiaro_skip_calibrate'] !== '1'` → redirect to `/calibrate`. Cookie is session-scoped, set when user clicks "Skip for now," cleared on signout.
- **`/calibrate` page.** Client component. Single text input. On submit → `client.functions.invoke('calibrate-location', { address })` → on success → `router.push('/')`. On 400/4xx → render error inline. On 502 → render "Geocoding service is temporarily unavailable, try again."
- **`/settings`.** Server component shell. Index page lists "Address" + "Sign out." (Sign-out lives here in slice 2 as a natural settings home; the slice 1 standalone `/sign-out` page can be removed in this slice or kept — leaning toward keeping for back-compat.)
- **`/settings/address`.** Client component. Shows current `home_address_text` + `calibrated_at`. Edit form re-runs the same Edge Function call.

### Mobile

- **`app/(app)/calibrate.tsx`.** Form with text input + "Use my current location" button. GPS path: `expo-location` → check permission → `Location.getCurrentPositionAsync({ accuracy: Balanced })` → submit `{ lat, lng }` to Edge Function. On any GPS error, fall back to typed-address path.
- **`app/(app)/_layout.tsx`.** Existing guard extended: same uncalibrated-redirect logic as web, with `AsyncStorage.getItem('chiaro_skip_calibrate')` mirroring the web cookie.
- **`app/(app)/settings/`.** New stack. `index.tsx` lists Address + Sign out. `address.tsx` is the edit form.
- **`lib/location-permissions.ts`.** Wraps `expo-location` permission request with user-friendly error messages and "Open settings" deep-link if permission previously denied.

### Home screen changes (both apps)

A new `<DistrictPanel>` component (app-local — *not* shared between web and mobile this slice; reuse pushed to slice 3+ when earned).

- **Profile filled but uncalibrated** *and* skip-cookie set: banner "Calibrate to see your reps" → `/calibrate`. (No banner if cookie unset, because middleware will have already redirected.)
- **Calibrated**: district list (one row per tier) + `<DistrictMap>` + "Edit address" link → `/settings/address`.

Plain-text district rendering only — no avatars, no "your senator is X." Officials are slice 3+.

### `<DistrictMap>` component (per app)

**Inputs:** `Array<{ id, tier, name, code, geometry: GeoJSON }>`. **Behavior:**

- Checkbox row above the map — one per tier the user is in. All checked by default.
- Map renders OSM raster tiles + polygon overlays for *checked* tiers.
- Per-tier color (federal_house=indigo, federal_senate=teal, state_senate=plum, state_house=violet, county=olive, place=ochre).
- Initial bounds = `fitBounds` over the union of checked polygons.
- No pan-to-tier, click-polygon, search, or zoom controls beyond the renderer's defaults. Slice 3+ work.

## End-to-end calibration flow (both apps, identical contract)

1. Authenticated user with `profiles.completed = true` lands on `/calibrate` (via middleware redirect, or via Skip-then-banner re-entry, or via Settings/address Edit).
2. User submits `{ address }` (or `{ lat, lng }` from mobile GPS).
3. Client calls `client.functions.invoke('calibrate-location', input)`.
4. Edge Function authenticates, calls GeocodIO, opens transaction, replaces `user_districts`, upserts `user_locations`, commits.
5. Client receives `{ home_location, districts }`.
6. Client navigates to `/` (web) or pops back to home tab (mobile).
7. Home renders `<DistrictPanel>` with the new districts and map.

## Error handling — consolidated user-facing surface

| Scenario | Edge Function | Web UI | Mobile UI |
|---|---|---|---|
| User submits empty / invalid address | 400 | Inline error: "Enter a complete address (street, city, state, ZIP)." | Same |
| GeocodIO doesn't recognize the address | 400 | Inline error: "We couldn't find that address. Double-check spelling." | Same |
| GeocodIO returns coords but no district fields | 422 | "We can't resolve districts for that location yet." with "Contact support" link | Same |
| GeocodIO is down / timed out | 502 | Banner: "Address lookup is temporarily unavailable. Try again." + Retry button | Same |
| User unauthenticated | 401 | Middleware kicks them to `/sign-in` first; this state is unreachable in normal flow | Same — guard layout redirects |
| GPS permission denied (mobile only) | n/a (client-side) | n/a | "Location access is off. Enable it in Settings, or enter your address manually." with deep-link |
| GPS unavailable (mobile only) | n/a | n/a | "Couldn't get your location. Enter your address instead." — auto-falls back to typed input |
| DB transaction rollback (e.g., constraint violation) | 500 | Banner: "Something went wrong saving your location. Try again or contact support." | Same |
| TIGER ingest gap (district missing for a tier) | 200 (logged warning, not an error) | Tier silently absent from district list + map | Same |

## Environment variables

| Variable | Where set | Purpose |
|---|---|---|
| `GEOCODIO_KEY` | Edge Function runtime (Supabase project settings) + GitHub Actions secret + per-developer `.env.local` | GeocodIO API key (server-only — never exposed to client) |
| `TIGER_VERSION` | `packages/db/supabase/seed/tiger-ingest.ts` const | Currently `"TIGER 2024"`; bump when re-ingesting |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function runtime (auto-injected by Supabase) | Bypasses RLS for `user_locations` / `user_districts` writes |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Mobile (existing) | Unchanged from slice 1 |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Web (existing) | Unchanged from slice 1 |

`.env.example` updated at repo root and `apps/web` to document the new key.

## Testing

### Layer 1 — pgTAP (`packages/db/supabase/tests/`)

| File | Asserts |
|---|---|
| `districts_rls.test.sql` | anon + authenticated SELECT succeed; INSERT/UPDATE/DELETE denied for both |
| `user_locations_rls.test.sql` | self SELECT succeeds; cross-user SELECT returns 0 rows; all writes denied for `authenticated`; cascade delete on `auth.users` removes the row |
| `user_districts_rls.test.sql` | authenticated SELECT all rows; all writes denied; cascade delete on `auth.users` and `districts` |
| `tiger_ingest.test.sql` | post-ingest: ≥1 federal_house per state+DC, exactly 2 federal_senate per state (S1 + S2; geometry = state boundary), ≥1 state_senate + state_house per state (Nebraska state_house = 0 explicitly), all geometry non-null and `ST_IsValid` |

### Layer 2 — Vitest in `packages/location` (real local Supabase + live GeocodIO)

| # | Test | What it covers |
|---|---|---|
| 1 | `getMyLocation()` returns null pre-calibration | Empty-state read |
| 2 | `getMyDistricts()` returns [] pre-calibration | Junction baseline |
| 3 | `client.functions.invoke('calibrate-location', { address: <fixed urban address> })` writes `user_locations` + ≥4 `user_districts` rows | E2E happy path |
| 4 | Re-calibrate with different address → old `user_districts` removed, new ones inserted | Idempotent re-calibration |
| 5 | Calibrate as user A, then `getMyLocation()` as user B → null | RLS on `user_locations` |
| 6 | Calibrate as user A, then `getMyDistricts()` as user B → A's districts visible | `user_districts` is public-readable per Q6c |
| 7 | Edge Function called without auth → 401 | JWT enforcement |
| 8 | Submit malformed address → 400, no DB writes | Transaction rollback |

### Layer 3 — Edge Function direct unit tests (Deno test runner, fixture GeocodIO)

`packages/db/supabase/functions/calibrate-location/index.test.ts`:

- Happy path with fixture GeocodIO response → asserts emitted SQL matches expected.
- 502 from GeocodIO → function returns 502; no DB writes.
- Missing tier in GeocodIO response → logs warning, succeeds for present tiers.
- Address normalization edge cases (leading/trailing whitespace, "PO Box," all-caps).

### Layer 4 — Live GeocodIO smoke (`pnpm test:geocodio:live`)

5 fixed addresses (urban-rich-tier, rural, PO box, known-bad, just-ZIP). Asserts response shape: `congressional_districts[0].district_number` present, `state_legislative_districts.senate[0].district_number` present, `census.2020[0].full_fips` present. Runs in CI on every PR (Q10) and as a manual `pnpm` script.

### Layer 5 — App-level e2e

**Out of scope** (same as slice 1).

### Manual mobile verification (Definition of Done gate, no CI automation)

- EAS dev build succeeds: `eas build --profile development --platform ios`.
- Real device or simulator: GPS button → permission prompt → coords → districts populate.
- Map renders polygons; checkbox toggles update visibility.
- Settings → Address → Edit → re-calibrates.

## CI pipeline updates (`.github/workflows/ci.yml`)

```
job: db (extended)
  - supabase start
  - supabase db reset                   # applies migrations 0001-0006
  - pnpm db:seed-tiger                  # NEW — TIGER 2024 ingest (cached by TIGER_VERSION)
  - supabase test db                    # pgTAP (slice 1 + 4 new files)
  - supabase gen types typescript --local > packages/db/src/types.ts
  - git diff --exit-code packages/db/src/types.ts

job: functions (NEW)
  - supabase functions serve calibrate-location &
  - cd packages/db/supabase/functions/calibrate-location && deno test

job: test (extended; depends-on: db, functions)
  - supabase start
  - pnpm db:seed-tiger
  - pnpm -r test                        # vitest (live GeocodIO via local function)
  env:
    GEOCODIO_KEY: ${{ secrets.GEOCODIO_KEY }}

job: build (unchanged)
  - pnpm -r build
  - pnpm -r typecheck
```

`pnpm db:seed-tiger` is a Node script that downloads the TIGER 2024 shapefile bundle, unzips, and runs `shp2pgsql | psql` per tier. **Cached** via `actions/cache` keyed on `TIGER_VERSION` to skip re-download on every run; ingest into PostGIS still happens per fresh DB.

## Risks and known unknowns

1. **TIGER ingest pipeline time.** Cold CI run: download (~50 MB) + ingest could take 60–120 s. Cache mitigates re-download, but ingest is per fresh DB. Mitigation: incremental ingest only on `TIGER_VERSION` bump; consider snapshot restore in slice 3 if it bites.
2. **GeocodIO breaking schema changes.** Live tests catch this in CI immediately, but every PR fails simultaneously when it happens. Mitigation: pinned `cd118` field flag (vs the floating `congressional_districts`); document the upgrade procedure in the spec.
3. **State-legislative coverage gaps.** TIGER state-legislative data has occasional missing districts post-redistricting. Mitigation: `tiger_ingest.test.sql` row-count assertion catches gaps at CI; runtime falls back to logged warnings (calibration still succeeds for the present tiers).
4. **Edge Function cold start.** First calibration after deploy may take 1–3 s. Acceptable for a one-time-per-user action; not optimized in this slice.
5. **GeocodIO free-tier exhaustion.** If parallel CI runs hit the limit, tests fail with 429s. Free tier is 2.5 k/day vs ~6 calls/PR run; if it bites, upgrade to the paid plan.
6. **`react-native-maps` + Expo SDK 54 native module compatibility.** Not yet validated. Mitigation: smoke-test on a real device before merging the mobile half. If it doesn't work cleanly, fall back to a static SVG thumbnail on mobile (Q4 option a) for this slice; revisit interactive map in slice 2.5.
7. **Skip-cookie/AsyncStorage state divergence.** A user who skips on web but logs in on mobile (or vice versa) may see different gates. Mitigation: documented as known divergence; cross-device sync of UI state isn't a slice-2 concern. The redirect only fires once per session anyway.
8. **`geocodio_response jsonb` retention.** Storing raw third-party responses raises a small data-retention question. Mitigation: vendor responses don't contain PII beyond what the user already submitted; deletion follows the user's row via cascade. Re-evaluate when the privacy slice arrives.

## Out of scope (deferred)

- Officials data — `public_figures` table, admin UI, "your senator is X" rendering on home and district detail pages
- Bills + votes — bill model, `Bill_Detail` mockup, vote tracking
- Alignment calibration — Likert survey, radar chart, importance dots (the `Calibration/` mockup)
- Notifications — push, email, in-app
- Pre-auth onboarding redesign — local-first calibration synced on signup (mockup faithful)
- Map polish — pan-to-tier, click-polygon, search-on-map, vector tiles, custom basemap
- "Find users in district NY-12" UX — slice 3+ social feature; the schema is ready
- Avatar uploads — Supabase Storage + `avatar_url` on profiles
- OAuth providers — Apple, Google
- Magic-link auth, password-reset UI
- Live username-availability check, bio fields, account deletion
- Rich settings — only Address + Sign-out in this slice; theme, notifications, privacy, etc. punted
- App-level e2e — Detox / Playwright
- ZIP-only fallback input — full address required (rooftop precision implied by Q5)
- District boundary refresh after redistricting — manual `TIGER_VERSION` bump procedure documented but no automation

## Definition of done

- Fresh clone → `pnpm install` → `cd packages/db && supabase start` → `pnpm db:seed-tiger` → `pnpm dev` runs both apps locally.
- **Web**: signup → `/profile/edit` → `/calibrate` → submit address → home renders district list + map with checkbox toggles → Settings → Address → Edit re-runs calibration → home reflects new districts.
- **Web**: "Skip for now" on `/calibrate` → home shows uncalibrated banner CTA → clicking it returns to `/calibrate`.
- **Mobile** (manual on device or simulator): same end-to-end flow; GPS button additionally tested on the calibrate screen.
- **EAS dev build** for mobile succeeds for at least one platform (iOS or Android).
- pgTAP: slice 1 tests + 4 new files all green.
- Vitest: slice 1 tests + new `packages/location/test/integration.test.ts` all green.
- Edge Function deno tests green.
- Live GeocodIO smoke green in CI.
- Generated `packages/db/src/types.ts` committed and not drifted in CI.
- A second user calibrating with a different address sees their own districts only on home; cannot read user A's `user_locations`; *can* read user A's `user_districts` (per Q6c).
- The `chiaro_skip_calibrate` cookie / AsyncStorage entry clears on signout.
