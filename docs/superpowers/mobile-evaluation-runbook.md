# Mobile evaluation runbook — Android Studio PC + macOS/Xcode

> Slice 64 (optimization-roadmap S64). How to stand up Chiaro device evaluations on
> two machines: **Android** via Android Studio (emulator or USB device) on a Windows
> PC, and **iOS** via Xcode (Simulator or free-team iPhone) on a MacBook Pro.
> The smoke checklist itself lives in `mobile-dod-checklist.md` — this doc gets a
> build running and connected to a working backend.

## Strategy

- **Local dev-client builds** (`npx expo run:android` / `npx expo run:ios`), not EAS
  cloud builds. Both machines have full native toolchains, so local builds give
  minutes-long iteration instead of 15–45 min EAS free-tier queues. `expo-dev-client`
  is already a dependency and `newArchEnabled: true` + Hermes are the configured
  runtime — what you evaluate is what production ships.
- **Each machine self-hosts the backend.** The repo's local Supabase stack runs
  per-machine (Docker). There is no hosted/staging Supabase project yet (audit G1),
  and the primary dev VM is not reachable from your LAN.
- **iOS needs NO Apple Developer account** for Simulator work. A free Apple ID
  personal team is enough for a USB-connected iPhone (7-day provisioning). The paid
  account decision only matters for TestFlight/distribution — still deferred.
- **Expo Go is NOT the evaluation vehicle**: Sentry's native module isn't in Expo Go,
  and dev-client is the production-equivalent runtime. Use it only for throwaway UI
  checks.

## 0. Common prerequisites (both machines)

| Tool | Version | Notes |
|---|---|---|
| Node | 22.x | matches CI; `nvm install 22` / `nvm-windows` |
| pnpm | 9.12.0 | `corepack enable` activates the pinned version from `packageManager` |
| Docker | current Desktop (or OrbStack on macOS) | required by `supabase start` |
| Supabase CLI | **2.98.1** | pinned in CI since slice 63 — install the same: `npm i -g supabase@2.98.1` (or brew/scoop pin) |
| git | any recent | clone the repo |

API keys to have on hand (free-tier; see root `.env.example`):

| Key | Needed for | Without it |
|---|---|---|
| `GEOCODIO_KEY` | the `calibrate-location` Edge Function | **calibration fails → you can't get past onboarding.** Required. |
| `CONGRESS_GOV_API_KEY` | `pnpm seed:officials` | no federal officials → home card empty. Required for a meaningful evaluation. |
| others (OpenSecrets, OpenFEC, NY Senate, OpenStates) | finance/scorecard/state-bill seeds | those cards show empty states — acceptable for a first pass |

## 1. Backend bootstrap (identical on both machines)

```bash
git clone <repo> chiaro && cd chiaro
corepack enable
pnpm install                          # workspace deps

pnpm db:start                         # boots local Supabase (API 54321, DB 54322)
pnpm db:reset                         # applies all migrations

# Seeds, in order. TIGER is the slow one (~5-15 min, ~51 Census shapefiles;
# cached under ~/.cache/tiger so re-runs are fast).
pnpm seed:tiger
CONGRESS_GOV_API_KEY=<key> pnpm seed:officials
pnpm seed:state-officials             # no key needed (GitHub YAML repo)
pnpm seed:issue-catalog               # issue-priorities quiz catalog (no key)
# Optional extras for fuller cards: seed:bills-votes, seed:scorecards,
# seed:finance, seed:state-bills-full (see CLAUDE.md Quick start).

# Capture keys for the app env:
cd packages/db && supabase status --output env | grep -E 'ANON_KEY|API_URL' && cd ../..
```

Create `apps/mobile/.env` (copy `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321    # see per-platform note below!
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
# EXPO_PUBLIC_SENTRY_DSN_MOBILE=<optional — dev-client builds report errors if set>
```

Serve the Edge Function (separate terminal, leave running — calibration depends on it):

```bash
cd packages/db
printf 'GEOCODIO_KEY=%s\n' "<your key>" > /tmp/edge-env.env   # Windows: any temp path
supabase functions serve calibrate-location --env-file /tmp/edge-env.env
```

## 2. MacBook Pro — iOS

One-time setup:

1. Install **Xcode** from the App Store (latest; SDK 54 requires Xcode 16.1+ — anything
   current on the latest macOS is fine). Launch once to accept the license and install
   the iOS platform + Simulator runtime (Xcode ▸ Settings ▸ Components).
2. `xcode-select --install` if prompted for command-line tools.
3. No CocoaPods install needed — `expo run:ios` manages pods itself.

Build + run on Simulator (no Apple account needed):

```bash
cd apps/mobile
npx expo run:ios          # prebuilds ios/, installs pods, builds, boots Simulator,
                          # installs the dev client, starts Metro
```

- `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` works as-is — the Simulator
  shares the Mac's network stack.
- First build is slow (full native compile); subsequent `npx expo start --dev-client`
  sessions reuse the installed client and only reload JS.
- **GPS flow on Simulator**: Simulator ▸ Features ▸ Location ▸ Custom Location…
  (enter a real US address's lat/lng so districts resolve). The permission prompt
  must show the WhenInUse string from `app.config.ts`.

Physical iPhone (optional, free Apple ID):

```bash
npx expo run:ios --device     # pick the USB-connected iPhone
```

- First run: Xcode will prompt to add your free Apple ID under Signing (personal
  team); on the phone, trust the developer profile (Settings ▸ General ▸ VPN &
  Device Management). Builds expire after 7 days — rebuild to refresh.
- On-device, `127.0.0.1` points at the phone. Either use the Mac's LAN IP in
  `.env` (`http://<mac-lan-ip>:54321`) or keep the Simulator for backend-dependent
  flows and use the device for feel/gesture/perf checks.

## 3. Windows PC — Android

One-time setup:

1. Install **Android Studio** (latest). In the SDK Manager install: Android SDK
   Platform (latest stable API), SDK Platform-Tools, Android Emulator. In Device
   Manager create an AVD (e.g. Pixel 8, latest stable API, x86_64 image) — a
   mid-range profile is also worth having since the audit flagged mid-range jank
   as the test target.
2. Environment variables (System Properties ▸ Environment Variables):
   - `ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME = <Android Studio dir>\jbr` (Studio's bundled JDK 17)
   - Add `%ANDROID_HOME%\platform-tools` to `PATH` (for `adb`)
3. Clone + bootstrap the repo per section 1 (this PC runs its own Supabase too).

Build + run on the emulator:

```bash
cd apps/mobile
npx expo run:android      # prebuilds android/, gradle build, installs on the
                          # running emulator (start the AVD first), starts Metro
```

- **CRITICAL env difference**: in `apps/mobile/.env` set
  `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321` — inside the emulator,
  `127.0.0.1` is the emulator itself; `10.0.2.2` is the host machine's loopback.
- Cleartext `http://` works in dev-client/debug builds (debug manifest allows it).
  A `preview`/release build pointed at plain-HTTP local Supabase would fail —
  evaluation uses dev clients, so this doesn't bite.

Physical Android device (optional):

1. Enable Developer options + USB debugging on the phone; plug in; accept the
   RSA prompt (`adb devices` should list it).
2. `adb reverse tcp:54321 tcp:54321` — now the phone's `127.0.0.1:54321` reaches
   the PC's Supabase, so the default `.env` URL works (Metro's 8081 is reversed
   automatically by expo).
3. `npx expo run:android --device`.

## 4. Daily evaluation loop

```bash
# terminal 1 (repo root): backend up
pnpm db:start            # if not already running
# terminal 2 (packages/db): edge function
supabase functions serve calibrate-location --env-file <env file>
# terminal 3 (apps/mobile): JS only — the dev client is already installed
npx expo start --dev-client
```

Open the Chiaro dev client on the emulator/Simulator/device → it connects to Metro
(scan QR or it auto-launches). `r` in the Metro terminal reloads; shake / Cmd-D /
Ctrl-M opens the dev menu.

Then run the smoke checklist: `docs/superpowers/mobile-dod-checklist.md`.

## 5. Known issues you WILL hit (queued fixes — don't re-triage)

These are confirmed audit findings scheduled in the optimization roadmap
(`docs/superpowers/plans/2026-06-10-optimization-roadmap.md`); expect them until
S65/S66 land:

| Symptom | Finding | Fix slice |
|---|---|---|
| After calibrating (or Skip), app bounces back to /calibrate forever — kill + relaunch to escape | U1 | S65 |
| Home / Officials / Settings don't scroll; content below the fold unreachable | C8/U0 | S65 |
| Officials list text is black-on-dark in dark mode | U3 | S65 |
| Sign-up success ("check your email") renders as a red error banner | U6 | S65 |
| Keyboard covers form inputs (no KeyboardAvoidingView) | U5 | S65 |
| Default Expo icon + flat cream splash, then a spinner chain on cold start | C14/C10 | design track / S66 |
| First load feels network-chatty (multi-second cold start on slow links) | C10/C18 | S66/S70+ |
| District map polygons slow to load/render (multi-MB geometry) | C9/C16 | S67 |

## 6. Troubleshooting

- **Calibrate returns "geocoder unavailable" / 502** → the Edge Function terminal
  isn't running or the env file lacks `GEOCODIO_KEY`.
- **"supabaseKey is required" red screen** → `apps/mobile/.env` missing/typo'd;
  restart Metro with `npx expo start --dev-client --clear` after env changes
  (env is inlined at bundle time).
- **Android: network request failed on every query** → you used `127.0.0.1` in the
  emulator; switch to `10.0.2.2` (or `adb reverse` on a physical device).
- **Officials card empty** → `seed:officials` didn't run (needs
  `CONGRESS_GOV_API_KEY`) or you calibrated to an address outside seeded data.
- **Issue-priorities flow shows no topics** → `pnpm seed:issue-catalog` not run.
- **iOS build fails on a Sentry upload step** → expected without `SENTRY_AUTH_TOKEN`;
  the plugin warns and continues for dev builds. Don't set the secret just for this.
- **Stale native config after pulling a slice that touched app.config.ts** →
  `npx expo prebuild --clean` then `expo run:<platform>` again.
