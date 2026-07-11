# Multi-setup development & version control

The canonical reference for operating Chiaro across more than one machine
(e.g. the Android/Windows evaluation PC + the iOS/macOS MacBook, plus
developer laptops). Every setup follows this document so the repo stays the
single source of truth and machines differ only in their **local, untracked**
state.

Companion docs: per-machine toolchain setup lives in
[`mobile-evaluation-runbook.md`](./mobile-evaluation-runbook.md); the
executable setup path is the `eval-machine-setup` skill. This doc owns the
**cross-machine conventions** those two assume.

## 1. The core principle — shared vs per-machine

Most multi-setup friction comes from a file landing on the wrong side of this
line. Keep them separated:

| Travels in git (shared, one source of truth) | Per-machine (local, never committed) |
|---|---|
| App code, `app.config.ts`, `eas.json` | `apps/mobile/.env`, `packages/db/.env*.local` |
| `.env.example` files (the **contract/shape**) | Real API keys (Geocodio, Congress, Google Maps, …) |
| DB **migrations** (`packages/db/supabase/migrations`) | Generated `apps/mobile/android/` + `ios/` |
| Seed scripts, generated `packages/db/src/types.ts` | Local Supabase container + seeded data |
| This doc, the runbook, the setup skill | Local caches (`~/.cache/tiger`, OpenStates clone) |

If a new machine needs a file to run, it belongs in git **or** in
`.env.example` — never pasted ad hoc.

## 2. Version-control conventions

1. **Native dirs are gitignored — Continuous Native Generation (CNG).**
   `/apps/mobile/android` and `/apps/mobile/ios` are **not** committed.
   `app.config.ts` + Expo config plugins are the source of truth; each machine
   (and EAS) regenerates native code via `expo prebuild`. This is Expo's
   default for new projects and prevents two real problems: committing a
   machine-specific generated tree (constant phantom diffs), and leaking the
   Google Maps API key that prebuild bakes into `AndroidManifest.xml`.
   Native config (permissions, keys, Gradle) is expressed through
   `app.config.ts`/plugins, **never** by hand-editing files under `android/`
   (they're wiped on the next `prebuild --clean`).

2. **Secrets never enter git.** `.env` files are gitignored; the matching
   `.env.example` is the committed contract and must list **every** variable
   (empty value + a one-line comment). Adding a new env var = update
   `.env.example` in the same change. A machine is "configured" when its
   `.env` covers everything in `.env.example`.

3. **The database schema is the migrations directory.** Never hand-edit a
   hosted or local DB. Schema changes are new numbered files under
   `packages/db/supabase/migrations/` and applied with `supabase db push`
   (hosted) or `pnpm db:reset` (local). `packages/db/src/types.ts` is
   generated (`pnpm db:gen-types`) — never hand-edited; CI guards drift via
   `pnpm db:check-types-drift`.

4. **Integrate via PR + green CI, not local squash.** Local squash-merges
   bypass CI and let breakage accumulate silently (see CLAUDE.md Gotcha #30).
   Every change — including eval-enablement fixes — lands on a branch through a
   PR whose CI is green.

## 3. Shared hosted Supabase — the backend all setups point at

All machines read/write **one hosted Supabase project** instead of each
running its own local stack. This removes per-machine seeding (TIGER,
OpenStates, Congress) and the Android `10.0.2.2` host-loopback gotcha, because
every setup uses the same real `https://` URL.

**One-time provisioning (owner, from any machine):**

```bash
supabase login
supabase link --project-ref <project-ref>     # from packages/db
supabase db push                               # apply migrations 0001–0060
# seed once against the hosted DB (SUPABASE_DB_URL = hosted pooler URL):
pnpm seed:tiger && pnpm seed:officials && pnpm seed:state-officials && pnpm seed:issue-catalog
supabase functions deploy calibrate-location   # deploy the Edge Function
supabase secrets set GEOCODIO_KEY=<key>         # server-side secret, hosted
```

**Per-machine (every setup, including the Mac):**

```bash
# apps/mobile/.env — only two values differ from .env.example, no loopback math:
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<hosted anon key — public by design>
```

The anon key is publishable (RLS enforces access), so it's safe to share
across machines via the team secret store. Service-role keys and
`GEOCODIO_KEY`/`CONGRESS_GOV_API_KEY` stay server-side (hosted secrets / seed
machine only).

**Local Supabase is the offline fallback.** A machine can still run its own
stack (`pnpm db:start` + the full seed set + `supabase functions serve`) when
disconnected; the runbook covers that path and its `10.0.2.2` requirement.

## 4. New-machine quickstart

```bash
git clone <repo> chiaro && cd chiaro
pnpm install
cp apps/mobile/.env.example apps/mobile/.env       # then fill the 2 hosted values
cd apps/mobile && npx expo run:android             # or run:ios on macOS (regenerates native dirs)
```

Day-to-day after the first native build: `npx expo start --dev-client`
(no rebuild unless native config in `app.config.ts` changes).

## 5. Build paths

- **Local dev-client (primary).** `npx expo run:android` / `run:ios`. Needs the
  native toolchain (Android Studio / Xcode) per the runbook.
- **EAS dev build (no-toolchain option).** `eas build --profile development`
  produces an installable dev client so a machine/evaluator without a native
  toolchain can still run the app. `eas.json` already defines the
  `development`, `development-simulator`, `preview`, and `production` profiles.
- **Env sync for EAS:** manage shared non-secret vars with `eas env:*` and pull
  them locally with `eas env:pull` instead of copying `.env` by hand.

## 6. Known setup gaps (already triaged)

These were discovered standing up the Android machine and are fixed at the repo
level so no future setup rediscovers them:

- `react-native-gesture-handler` must be `~2.28.0` for RN 0.81 (the SDK-54
  version) — `~2.20.0` fails to compile.
- Android requires a Google Maps API key (`GOOGLE_MAPS_API_KEY`, read by
  `app.config.ts`); without it the home `DistrictMap` crashes at mount. iOS
  uses Apple Maps and is unaffected unless a component forces `PROVIDER_GOOGLE`.
- `runtimeVersion` must be a literal (not a `policy`) for local/bare builds;
  the `appVersion` policy is EAS-only.
- The OpenStates loader requires `roles[].title`, which the live
  `openstates/people` repo omits for default roles — seeds 0 legislators
  unless a default title is derived.
- The loader is also NON-recursive: `seed:state-officials` needs
  `OPENSTATES_DATA_DIR` pointing at a FLATTENED directory of
  `data/*/legislature/*.yml` (the repo nests per state). Procedure in
  `docs/superpowers/staging-promotion-runbook.md` §4.
- Cloning `openstates/people` on Windows needs `core.longpaths=true` —
  committee filenames exceed MAX_PATH and abort the checkout otherwise
  (G1 spike, 2026-07-11).
