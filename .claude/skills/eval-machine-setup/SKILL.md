---
name: eval-machine-setup
description: Set up THIS machine for Chiaro mobile device evaluations — detects platform (Windows/Android Studio or macOS/Xcode), installs/verifies the toolchain, bootstraps the local Supabase backend + seeds, writes apps/mobile/.env with the platform-correct URL, and builds the dev client. Use when the user asks to "set up this machine for mobile evaluation", "prepare for device testing", or similar.
---

# Chiaro evaluation-machine setup

Drive the setup interactively, top to bottom. **Check before installing** (every
tool may already exist), **ask before anything needing admin rights or an
account**, and **verify each phase before moving on**. The companion reference is
`docs/superpowers/mobile-evaluation-runbook.md` — consult it for rationale; this
skill is the executable path.

Ask the user up front (one question): which platform is this machine for —
**Android (Windows PC + Android Studio)** or **iOS (macOS + Xcode)** — and
whether they'll use an **emulator/Simulator** or a **physical device**.

## Phase 1 — Core toolchain (both platforms)

Verify, install only what's missing (winget on Windows, brew on macOS; confirm
with the user before each install):

| Tool | Check | Target |
|---|---|---|
| git | `git --version` | any recent |
| Node | `node --version` | **22.x** (`winget install OpenJS.NodeJS` pinned to 22 / `brew install node@22`) |
| pnpm | `corepack enable && pnpm --version` | 9.12.0 via corepack (repo `packageManager` pin — do NOT install pnpm globally) |
| Docker | `docker info` | Docker Desktop running (macOS: OrbStack also fine). Needs user login/launch. |
| Supabase CLI | `supabase --version` | **2.98.1** exactly: `npm i -g supabase@2.98.1` (matches the CI pin) |

If the repo isn't cloned yet: `git clone <repo-url> chiaro && cd chiaro`, then
`pnpm install` (expect ~2-4 min).

## Phase 2 — Platform toolchain

### Android (Windows)
1. Android Studio: check `Test-Path "$env:LOCALAPPDATA\Android\Sdk"`. If absent:
   `winget install Google.AndroidStudio`, then have the USER open Studio once —
   the first-run wizard installs SDK Platform + Platform-Tools + Emulator
   (Claude cannot click through this).
2. Env vars (set at user scope via `[Environment]::SetEnvironmentVariable(..., 'User')`,
   then verify in a FRESH shell):
   - `ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME = <Android Studio install dir>\jbr`
   - append `%ANDROID_HOME%\platform-tools` to `PATH`
3. Verify: `adb --version` works.
4. AVD: ask the user to create one in Studio's Device Manager (Pixel-class,
   latest stable API, x86_64) if `emulator -list-avds` (under
   `%ANDROID_HOME%\emulator`) is empty. A mid-range profile is the better
   evaluation target.
5. Physical device instead: Developer options + USB debugging on the phone,
   plug in, `adb devices` shows it, run `adb reverse tcp:54321 tcp:54321`.

### iOS (macOS)
1. Xcode: `xcodebuild -version`. If missing, the USER installs it from the App
   Store (multi-GB; Claude cannot do this), launches once to accept the license
   (`sudo xcodebuild -license accept`) and installs the iOS platform when
   prompted (Xcode ▸ Settings ▸ Components).
2. `xcode-select --install` if `xcode-select -p` errors.
3. No CocoaPods setup needed — `expo run:ios` manages pods.
4. Physical iPhone instead of Simulator: needs a free Apple ID added in Xcode
   (Settings ▸ Accounts) for personal-team signing; builds expire after 7 days.

## Phase 3 — Backend (this machine runs its own)

Ask the user for two API keys before starting (offer the signup URLs from the
root `.env.example` if they don't have them):
- `GEOCODIO_KEY` — **required**; without it calibration fails and the app is
  stuck at onboarding.
- `CONGRESS_GOV_API_KEY` — required for a meaningful officials evaluation.

Then, from the repo root:

```bash
pnpm db:start          # first run pulls Docker images (~minutes)
pnpm db:reset
pnpm seed:tiger        # ~5-15 min first time; cached under ~/.cache/tiger after
CONGRESS_GOV_API_KEY=<key> pnpm seed:officials
pnpm seed:state-officials
pnpm seed:issue-catalog
```

(Windows shells: set env vars with `$env:CONGRESS_GOV_API_KEY='...'` first.)

Verify: `cd packages/db && supabase status` shows the API on 54321; capture the
`ANON_KEY`.

## Phase 4 — App env + Edge Function

1. Write `apps/mobile/.env`:
   - `EXPO_PUBLIC_SUPABASE_URL` = `http://10.0.2.2:54321` for the **Android
     emulator**; `http://127.0.0.1:54321` for **iOS Simulator** or a USB Android
     device with `adb reverse`.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = the captured ANON_KEY.
2. Serve the Edge Function in a dedicated terminal the user keeps open:
   ```bash
   cd packages/db
   # write a one-line env file containing GEOCODIO_KEY=<key>, then:
   supabase functions serve calibrate-location --env-file <that file>
   ```

## Phase 5 — Build the dev client + smoke

```bash
cd apps/mobile
npx expo run:android     # or: npx expo run:ios  (add --device for a phone)
```

First build = full native compile (several minutes). Day-to-day afterwards only
needs `npx expo start --dev-client`.

Smoke (do these WITH the user, then hand off to
`docs/superpowers/mobile-dod-checklist.md`):
1. Sign-up screen renders with brand styling.
2. Create a throwaway account → profile → calibrate with a real US address →
   districts resolve (proves Supabase URL + Edge Function + GEOCODIO_KEY).
3. Home shows officials (proves seeds).

**Set expectations**: the runbook §5 "known issues you WILL hit" table lists
confirmed pre-existing bugs (calibration-gate bounce — escape by killing +
relaunching the app; non-scrolling screens; dark-mode list text) with their fix
slices. Do not debug those; point the user at the table.

## Troubleshooting quick hits

Use runbook §6. The top three: Android "network request failed" = wrong host
(use 10.0.2.2); "supabaseKey is required" = .env missing → restart Metro with
`--clear`; calibrate 502 = Edge Function terminal not running / key missing.
