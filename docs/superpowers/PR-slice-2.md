# Slice 2 — Location Calibration Foundation (PR description)

> **Working draft.** When ready to open the PR, paste the body below into the GitHub PR editor. Adjust the title/branch as needed.

---

**Title:** `feat: slice 2 — location calibration foundation`
**Base:** `master`
**Head:** `feat/location-calibration-foundation`

## Summary

Slice 2 lands the location pillar end-to-end on web and mobile:

- A signed-up user with a completed profile can **calibrate their home location** on either app.
- Calibration resolves the address to **multi-tier districts** (federal house, federal senate, state senate, state house, county, place) via **GeocodIO** in a Supabase **Edge Function**.
- The user's address + rooftop coords persist privately under self-only RLS (`public.user_locations`); their district links persist publicly under a junction table (`public.user_districts`) so slice 3+'s "follow others in NY-12" use case works as a join.
- Home screen renders a **district list** + a **boundary map** with per-tier checkbox toggles (Leaflet on web, `react-native-maps` on mobile).
- Settings screen surfaces an **Edit Address** sub-page; sign-out clears the skip cookie / AsyncStorage flag on both apps.

The slice ships behind the same RLS rigor as slice 1 (pgTAP at the policy layer + Vitest at the integration layer), plus a new live-GeocodIO Layer-2 suite that exercises the full client → Edge Function → DB path.

## Commits (33 since plan landed)

| Phase | Commits |
|---|---|
| Spec + plan + PR draft | `1c10326` spec, `03847a2` plan, `7ddacf9` PR draft |
| Schema + RLS | `d331ed9` `362df0d` `b2619e9` `508e3bc` `292a854` `e443196` `ab6f502` |
| TIGER ingest | `5d77154` `2beda33` `9ebb2bd` |
| Location package + view | `13ed0aa` `b095618` |
| Edge Function | `890448f` `ee68f03` `ad5741d` `40c3e15` `93dd96d` `f72fc99` |
| Web | `66e269a` `6b9322c` `5088c1e` `797a68e` |
| Mobile | `9f3afd7` `ab34627` `0256132` `7410496` `1a4bc27` |
| CI | `775180f` |
| Smoke-test polish (react-leaflet 5 bump + UX) | `088343c` `9b0c78c` `86a75fc` |

Full diff stats (vs `master`): ~58 files changed, +8,200 / -40 (most of the line count is the regenerated `Database` type and `pnpm-lock.yaml`; hand-authored code is ~3,700 lines split roughly evenly between schema/SQL, Edge Function, web, and mobile).

## What's new (technical surface)

### Database

- **4 new migrations** (`0003_districts.sql` through `0006_user_districts.sql`) plus a **GeoJSON view migration** (`0007_districts_geojson_view.sql`) added during implementation because PostgREST returns `geometry` as WKB hex by default — the view exposes it as parsed JSONB GeoJSON via `ST_AsGeoJSON(...)::jsonb`. RLS on the view inherits from the underlying table (security-invoker default in PG 15+).
- **PostGIS 3.3.7** enabled. `district_tier` enum with 6 values: `federal_house`, `federal_senate`, `state_senate`, `state_house`, `county`, `place`.
- **TIGER 2024 ingest pipeline** at `packages/db/supabase/seed/`. Per-state Census shapefiles → in-process `shapefile`-lib parse → idempotent `INSERT ... ON CONFLICT (tier, code) DO UPDATE`. Federal_senate is synthesized as two rows per state (`<state>-S1` / `<state>-S2`) sharing the state boundary geometry.
- **Verified row counts:** federal_house **439**, federal_senate **100**, state_senate **1947**, state_house **4838**, county **3144**, place **32041**.
- **Test coverage:** 49/49 pgTAP green (slice 1's 9 + 4 new RLS files + 1 new ingest-coverage file).

### Edge Function (`calibrate-location`)

Single Deno function at `packages/db/supabase/functions/calibrate-location/`. Sequence per request:

1. Verify JWT in `Authorization: Bearer ...` header (returns 401 if missing/invalid).
2. Validate body — accepts `{ address: string }` or `{ lat, lng }`.
3. Call GeocodIO v1.7 (`fields=cd,stateleg,census2020`, 10s timeout via `AbortController`).
4. Service-role bypass RLS: `delete user_districts where user_id = X` → upsert `user_locations` (with `SRID=4326;POINT(lng lat)` WKT) → loop-insert new `user_districts` rows joining on `(tier, code)` against canonical `districts`.
5. Return `{ home_location, districts }`.

Live integration test suite at `packages/location/test/integration.test.ts` — **8/8 PASS** against real local Supabase + live GeocodIO. The Layer 2 tests are the GeocodIO schema-drift trip-wire (per design Q10).

### `packages/location` (new workspace package)

`@chiaro/location` exports zod input schemas (address / GPS), `DistrictTier` type + tuple, and `getMyLocation` / `getMyDistricts` queries. The latter is a two-step join (user_districts → districts_geojson view) because PostgREST nested-selects choke on geometry columns.

### Web app (`apps/web`)

- New routes: `/calibrate`, `/settings`, `/settings/address`.
- New components: `<DistrictMap>` (Leaflet wrapper with checkbox-toggled GeoJSON overlays + auto-fit bounds) and `<DistrictPanel>` (home-screen panel — empty-state CTA or list+map).
- **Middleware update:** authenticated-but-uncalibrated users redirect to `/calibrate` unless on the allowlist (`/calibrate`, `/sign-out`, `/profile/edit`, `/settings`, `/settings/address`) or holding the `chiaro_skip_calibrate=1` session cookie.
- **Sign-out from `/settings`** clears the cookie before calling `supabase.auth.signOut()`.
- New deps: `leaflet@^1.9.4`, `react-leaflet@^4.2.1`, `@types/leaflet@^1.9.12`, `@chiaro/location` (workspace).

### Mobile app (`apps/mobile`)

- New routes inside the `(app)` group: `calibrate.tsx`, `settings/{_layout, index, address}.tsx`.
- New components: `<DistrictMap>` (`react-native-maps` wrapper with toggle-row + per-tier polygons) and `<DistrictPanel>` (mobile home panel).
- New helper: `lib/location-permissions.ts` — wraps `expo-location` permission flow; returns a `GpsResult` discriminated union; provides `openOSPermissionSettings()` deep-link.
- **`(app)/_layout.tsx` calibration gate:** authenticated-but-uncalibrated users get redirected to `/calibrate` unless on the calibrate or settings routes or the AsyncStorage skip flag is set.
- **`app.config.ts`** gained `NSLocationWhenInUseUsageDescription` (iOS), `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (Android), and the `expo-location` plugin entry.
- New deps: `expo-location@~17.0.1`, `react-native-maps@1.18.0`, `@chiaro/location` (workspace).

### CI

`.github/workflows/ci.yml` extended:
- `db` job: TIGER cache step + `pnpm db:seed-tiger` after migrations apply.
- New `functions` job (depends on db): boots Supabase + runs Deno tests for the Edge Function via `denoland/setup-deno`.
- `test` job: depends on `[db, functions]`, sets `GEOCODIO_KEY` from secrets, seeds TIGER, serves the Edge Function in background, then runs `pnpm -r test` (which now includes the Layer 2 live-GeocodIO suite).
- `build` job unchanged.

## Notable deviations from the original spec / plan

These all surfaced during implementation. Each is a pragmatic improvement, not scope creep — flagging here so reviewers don't have to re-derive the rationale.

1. **TIGER 2024 CD119 per-state files (not CD118 nationwide).** Census restructured the directory between the spec being written and this slice landing — `tl_2024_us_cd118.zip` no longer exists; CD119 ships as 51 per-state files. `tiger-config.ts` parameterizes per-state URLs accordingly.
2. **GeocodIO v1.7 `census["2020"]` shape.** The spec's `extractDistricts` assumed an array with flat `full_fips`/`place_fips`/`place_name` keys. GeocodIO actually returns a single object per year with `county_fips` (5-char FIPS — exactly what TIGER stores) and a nested `place: { fips, name }` block. Fixed in `f72fc99`.
3. **Code-convention parity between TIGER and Edge Function.** TIGER stores zero-padded `CA-01` for federal_house but strips leading zeros for state legislative districts (`NY-SS-27`). The Edge Function's `extractDistricts` was originally inconsistent — fixed in `ee68f03` to pad federal and strip state-leg.
4. **`districts_geojson` view added (migration 0007).** Not in the original spec — needed because PostgREST returns `geometry` as WKB hex. Security-invoker view inherits RLS from `public.districts`.
5. **Edge Function uses sequenced delete/upsert/insert, NOT a SQL transaction.** Deno + supabase-js can't open `BEGIN/COMMIT` over PostgREST. Failure window is sub-second; recovery is "user re-calibrates" (the delete is idempotent). Documented in spec § Risks #5 and inline in the handler.
6. **Federal_senate excludes DC** (50 states × 2 = 100 rows, not 51 × 2 = 102). DC has no senators; `ingestFederalSenate` filters DC explicitly.
7. **`districts_rls.test.sql` got `ON CONFLICT (tier, code) DO NOTHING`** on its `NY-01` fixture insert so it coexists with TIGER-seeded data once that's loaded.
8. **DELETE-denial assertions added to RLS tests** for `user_locations` and `user_districts`. Spec said "INSERT/UPDATE/DELETE denied"; the original test files only covered INSERT and UPDATE.
9. **`@chiaro/location` workspace dep wired into `apps/web/package.json`** during Task 14 (plan added it to mobile but missed web).
10. **Slice 1 home Sign-Out button removed in favor of a Settings link** on mobile — keeps the skip-flag clear logic in one place (Settings/index).
11. **`react-leaflet` bumped 4.2.1 → 5.0.0.** v4 + React 19 strict-mode triggers `Map container is already initialized` because `L.map()` is called twice on the same div during the dev double-mount and v4 doesn't clear `_leaflet_id` on cleanup. v5 is the React 19-targeted release. Discovered during the manual web smoke (commit `088343c`).
12. **Smoke-test UX polish on the home district panel + map** (commits `9b0c78c` web, `86a75fc` mobile parity): home pin (CircleMarker on web / Marker on mobile, coords pulled from `geocodio_response.location` since PostgREST returns the geography column as WKB hex); Federal/State/Local groupings in both the panel list and the toggle row; Senate-before-House within Federal; sort-by-code within tier; U.S. Senate toggles default off; initial map view zoomed to the county boundary instead of the multi-state union; friendly tier labels in toggles ("U.S. House" not "federal_house") and "City / Place" → "City" in the list. None of these are spec deviations — they're refinements that emerged from actually using the feature.

## Test plan / verification

### Pre-merge checklist

- [ ] **CI green** (run after pushing the branch):
  - [ ] `db` job: 49/49 pgTAP + TIGER ingest verified
  - [ ] `functions` job: Deno tests green
  - [ ] `test` job: 19/19 vitest (slice 1's 11 + slice 2's 8 location integration) — needs `GEOCODIO_KEY` repo secret to be set first
  - [ ] `build` job: typecheck + builds across all packages
- [ ] **GitHub Actions secret added:** `GEOCODIO_KEY` set in repo Settings → Secrets and variables → Actions. Same key from local `.env.local` works.
- [x] **Manual web smoke test passed 2026-05-06** (live local stack). Full flow verified: signup → profile fill → calibrate redirect → submit `350 5th Ave, New York, NY 10118` → home renders district list (Federal/State/Local groups, Senate-before-House) + Leaflet map zoomed to county with home pin → toggle polygons (Senate toggles default off, on adds state outline) → Settings → Home address (pre-filled with "Last updated …") → change to `1600 Pennsylvania Ave NW, Washington, DC 20500` → save → home reflects DC districts (state legislature + state house gracefully absent — DC has neither) → Sign out (cookie cleared) → second-user skip flow → banner CTA → click banner → back to `/calibrate`. To re-run:
  ```
  cd packages/db && supabase start
  pnpm db:seed-tiger          # if data not already loaded
  pnpm --filter @chiaro/web dev   # in another terminal — Edge Function hot-reloads via supabase_edge_runtime_db
  ```
- ⏭ **Manual mobile smoke test (Task 24) — DEFERRED to slice 2.5.** Mobile is code-complete and typechecks across all 6 packages; the EAS dev build infrastructure (`eas.json`, `expo-dev-client`, `expo-updates`, EAS project `f4d18da9-9c95-4c6a-8a34-c77189eca749` registered as `@jlaos/chiaro`) is in place. On-device verification is deferred for two reasons: (1) iOS physical-device builds need interactive Apple Developer credentials that proved cumbersome in this session; (2) slice 1 shipped on the same precedent ("mobile build is EAS-only — out of scope" per slice 1 spec; "still untested on a real device/simulator" per slice 1 lessons memo). Slice 2 inherits and extends that posture. The mobile UI logic mirrors web (same `getMyDistricts`/`getMyLocation` queries, same Edge Function call, same RLS contract); web smoke proved the data-layer end-to-end. Mobile-specific risks (RN-maps polygon coords, GPS permission UX, native marker styling, EAS build viability) are filed for slice 2.5 to verify before merging slice 2.5's own work. **To re-pick up:** `cd apps/mobile && eas build --profile development --platform android` for an Android APK is the simplest path (no Apple Developer drama). Walk through:
  1. Sign up + fill profile → calibrate redirect.
  2. Tap **Use my current location** → permission prompt → calibrate completes.
  3. Type `350 5th Ave, NY 10118` for a second user → calibrate succeeds.
  4. Toggle map polygons.
  5. Settings → Home address → edit + save.
  6. Sign out clears skip flag → next sign-in shows calibrate gate normally.

### Post-merge

- Slice 2 inherits the same merge mechanics as slice 1 (FF or squash). After merge, **delete the feature branch locally and on origin**.
- The `.superpowers/brainstorm/616-1778023515/` directory (visual-companion artifacts from the slice 2 brainstorm) is gitignored — no cleanup needed.

## Out of scope (deferred to slice 3+)

Mirroring the spec's "Out of scope" — flagging for review:

- Officials data (`public_figures` table, "your senator is X" rendering)
- Bills + votes
- Alignment calibration (Likert survey, radar chart)
- Notifications, pre-auth onboarding redesign, OAuth, magic-link
- Map polish (pan-to-tier, click-polygon, search, vector tiles)
- "Find users in NY-12" social UX (the schema is ready)
- App-level e2e (Detox / Playwright)
- ZIP-only fallback input
- Avatar uploads, bio fields, account deletion
- District boundary refresh automation
- **Mobile on-device DoD (Task 24)** — deferred from slice 2 to slice 2.5 (see Test plan above for rationale + steps to re-pick up)

## Known gaps + risks

These are documented in detail in the design doc; reproducing the highlights here:

1. **GeocodIO breaking schema changes** would fail every PR simultaneously. Live tests catch it immediately. Mitigation: pinned `cd,stateleg,census2020` field flags; document the upgrade procedure.
2. **TIGER seed pipeline has no retry/skip on per-state 404s.** A single missing state file aborts the run. Mitigation filed as future cleanup; spec § Risks #1.
3. **`react-native-maps` + Expo SDK 54 compat** not yet validated on a real device. Manual gate in Task 24.
4. **Skip-cookie/AsyncStorage divergence across web ↔ mobile** is documented; cross-device sync of UI state isn't in scope.
5. **Edge Function cold-start latency** (1-3s) on first calibration after deploy — acceptable for a one-time-per-user action.

## What's next

After merge, slice 3 picks up location-aware features: officials directory, "your senators / your reps" join, follow social graph. The schema is ready — `user_districts` is public-readable specifically to support this; `districts` has stable codes that GeocodIO matches.
