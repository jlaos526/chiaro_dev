# Mobile On-Device DoD Checklist

> Slice 2.5 / 3.5 follow-up. Run once per significant mobile-touching slice.
> Last updated: 2026-05-15 (covers slices 1–3).

## Build the APK

Prerequisites:
- [Expo account](https://expo.dev/) (free tier sufficient)
- `eas-cli` installed locally (`npm i -g eas-cli`)
- Logged in: `eas login`
- Linked to the project: `cd apps/mobile && eas init` (or verify `extra.eas.projectId` matches `f4d18da9-9c95-4c6a-8a34-c77189eca749`)

Build command:
```bash
cd apps/mobile
eas build --profile development --platform android
```

This produces an APK with the development client (Metro can connect). Build
queues on Expo's free tier may take 15–45 minutes. The CLI prints a build URL;
the APK download link appears there when ready.

iOS device builds need Apple Developer credentials and an interactive
provisioning step; defer until a paid Apple account is available.

## Install on device

1. Enable "Install from unknown sources" on the Android device (Settings →
   Security → Install unknown apps → allow your file manager / browser).
2. Download the APK from the EAS build URL on the device's browser.
3. Open the APK → Install.
4. Start Metro from dev machine: `pnpm --filter @chiaro/mobile dev` (or
   `cd apps/mobile && npx expo start --dev-client`).
5. Open the installed Chiaro app on the device → tap "Enter URL manually"
   if needed and paste the Metro URL printed in the terminal.

## Smoke checklist

Run through each scenario on a real Android device. Tick once verified.

### Auth (slice 1)

- [ ] Sign up with a fresh email → land on `/profile/edit`
- [ ] Fill display name + username → save → redirect to `/calibrate`
- [ ] Sign out → return to `/sign-in`
- [ ] Sign in with same credentials → home loads

### Calibration (slice 2)

- [ ] Tap "Use my location" → GPS permission prompt appears with the
      string from `app.config.ts:14-15` ("Chiaro uses your location to
      find the elected officials representing your address.")
- [ ] Grant → reverse geocode resolves → calibrate completes → home loads
- [ ] **GPS-denied path:** sign up a fresh user, deny GPS permission,
      verify fallback UX in `lib/location-permissions.ts:11` (typed-address
      form should appear instead of crashing)
- [ ] Type a known full address in the manual form → resolves → districts
      appear

### Districts (slice 2)

- [ ] Home shows district list grouped (Federal / State / Local)
- [ ] Map panel renders with district polygons + home pin
- [ ] Tier toggles work (federal_house / federal_senate / state_* /
      county / place)
- [ ] No console errors; no "Map container is already initialized" RN
      warnings

### Officials (slice 3)

> Prereq: run `pnpm seed:officials` against the dev Supabase instance
> the app is pointed at, so the officials table is populated.

- [ ] Home shows "Your officials" card with ~3 federal officials
      (1 house + 2 senate) below the District panel
- [ ] Each row shows portrait/initials, name, party badge (D/R/I/L/G/ID),
      and chamber · state metadata
- [ ] Tap "See all officials →" → `/officials` list grouped by chamber
- [ ] Tap any official → `/officials/[id]` detail page:
   - Photo + name + party + chamber/state/district/term info
   - "Open official site →" deep-links to gov.gov in browser
   - Twitter link (if present) deep-links to X/Twitter
- [ ] Back navigation works
- [ ] Portrait fallback: official with no `portrait_url` shows initials
      in the `OfficialAvatar` (synthesized test data or admin-cleared
      portrait_url)

### Settings (slice 2)

- [ ] Open Settings from home
- [ ] Edit Address sub-page → change address → save → districts refresh
      on home (TanStack staleTime is 5 min; pull-to-refresh or restart
      app to force refetch)
- [ ] Sign out from Settings

### Edge cases

- [ ] Kill app and reopen → still signed in (token persists via AsyncStorage)
- [ ] Background then foreground → no auth refresh loops
- [ ] Disable network → graceful error messages; no white-screen crashes

## Telemetry (deferred but flagged)

The audit called out "error-reporting hookup (Sentry/PostHog) — debugging
on-device without telemetry is painful." Not in slice 3 scope; tracked for
slice 4+. Until then, capture device logs via `adb logcat | grep -i chiaro`
or Metro's terminal output for crash diagnosis.

## After the run

If any item fails:
1. Note the device (model, Android version) + reproducible steps
2. Capture a screenshot or short screen recording
3. Open a slice 3.5 / 3.6 follow-up task

If everything passes, this DoD is satisfied. Note the date and the Chiaro
version (from `app.config.ts:7`) in the team channel / planning doc.
