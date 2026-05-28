# Slice 38 — Dark mode toggle UI

**Status:** Draft for review
**Date:** 2026-05-27
**Tier:** Compressed-to-Mega-Slice (5 new + 5 edited + 3 test = 13 files)
**Prerequisite slice:** 37 (domain palettes + dark mode closeout)
**Unblocks:** slice 39+ visual smoke testing of the queued reskin philosophy decisions (link blue, AlignmentChip tiers, BioPortrait gradient, industry rainbow, finance green, MetricCardShell retune)

## 1. Goal

Ship a user-facing **System / Light / Dark** toggle on the settings page so the dark-mode token plumbing built in slices 33–37 becomes visually verifiable in the running app. Until this slice lands, dark mode exists in the codebase but cannot be toggled — there is no way to validate slices 38+ visual decisions against real screens.

## 2. Non-goals

- **Cross-device sync.** Theme is a per-device preference; no `user_preferences` table.
- **Per-screen overrides.** Single global override; no "dark mode only on detail pages" etc.
- **Themed transitions / animations.** Instant repaint on toggle. Animation infrastructure does not exist; not building it.
- **Visual reskin philosophy decisions.** Token values stay as slice 37 shipped them. This slice only ships the toggle; tuning happens in later slices.
- **Inline-script anti-FOUC trick.** The codebase uses JS-object styles, not CSS variables — inline-script preload pattern doesn't pair with this architecture.

## 3. User stories

- As a developer doing slice 39+ visual smoke testing, I can toggle System / Light / Dark on either platform without rebuilding.
- As a user who prefers dark interfaces, I can pick Dark and have it persist across reloads / app restarts.
- As a user whose OS theme changes (auto night shift, OS-level dark mode schedule), I can leave the toggle on "System" and have Chiaro follow along.

## 4. User-facing decisions captured during brainstorming

| Decision | Pick | Why |
|---|---|---|
| Mode states | Tri-state: **System / Light / Dark** | Matches iOS/Android/macOS/Chrome/GitHub convention. `BrandModeOverrideContext` already supports `BrandMode \| null` shape. |
| Web persistence | **Cookie** (`chiaro_brand_mode`) | Server reads via `cookies()` from `next/headers` in root layout, server-renders correct mode from first paint. Eliminates FOUC. ~15 lines. |
| Mobile persistence | **AsyncStorage** (`chiaro_brand_mode`) | Already a dep. Reuse existing `loaded`-gate splash to await hydration → no flash. |
| Toggle UI placement | Settings page row | Matches conventions; minimal surface; settings page already exists and is sparse. |
| Toggle UI affordance | **Segmented control** (3 buttons in a row) | Compact, scannable, iOS/Android familiar. Cross-platform via Pressable. |
| Toggle UI scope | Single location | No header quick-toggle in v1 — adds surface area + design work without proportional value. |

## 5. Architecture

Three layers; each platform-specific API stays in its app, not in the shared package.

### 5.1 `@chiaro/officials-ui` (shared, platform-agnostic)

Adds three exports alongside the existing `brand-hooks.ts`:

- **`<BrandModeProvider>`** — manages internal `useState<BrandMode | null>`; takes `defaultMode` + optional `onChange`. Renders `BrandModeOverrideContext.Provider` (already exported from `brand-hooks.ts`) and a new sibling `BrandModeSetterContext.Provider`.
- **`useBrandModeSetter()`** — exposes `{ setMode, override }` from the setter Context. Throws if mounted outside `<BrandModeProvider>`.
- **`<BrandModeThemeRow>`** — segmented control UI. Reads current mode via `useBrandModeSetter()`, applies via `setMode`. Themes itself via `useBrandTokens()`.

`brand-hooks.ts` is **not modified**. The existing `BrandModeOverrideContext` is the integration surface.

### 5.2 `apps/web` (web glue)

- **`apps/web/lib/brand-mode-cookie.ts`** — `server-only` helper exporting `readBrandModeCookie()` → reads `next/headers` cookies, returns `BrandMode | null`.
- **`apps/web/lib/brand-mode-cookie.client.ts`** — client helper exporting `writeBrandModeCookie(mode)` → writes `document.cookie` with `Max-Age=31536000; path=/; SameSite=Lax`. Empty value (max-age=0) when `mode === null`.
- **`apps/web/app/layout.tsx`** — converted to `async`, awaits cookie read, wraps `<QueryProvider>` with `<BrandModeProvider defaultMode={...} onChange={writeBrandModeCookie}>`.

### 5.3 `apps/mobile` (mobile glue)

- **`apps/mobile/lib/brand-mode-storage.ts`** — exports `readBrandMode()` + `writeBrandMode(mode)`. `null` → `AsyncStorage.removeItem`.
- **`apps/mobile/app/_layout.tsx`** — extends the existing `loaded` gate to also await `readBrandMode()` before flipping. Wraps with `<BrandModeProvider defaultMode={brandMode} onChange={writeBrandMode}>`.

### 5.4 Settings page edits

- **`apps/web/app/settings/page.tsx`** — adds `<BrandModeThemeRow />` as a new `<li>`.
- **`apps/mobile/app/(app)/settings/index.tsx`** — adds `<BrandModeThemeRow />` inside the existing `<View>`.

## 6. Component contracts

### `<BrandModeProvider>`

```tsx
interface BrandModeProviderProps {
  defaultMode: BrandMode | null         // null = follow system
  onChange?: (mode: BrandMode | null) => void | Promise<void>
  children: React.ReactNode
}
```

Behavior:
- Initial state from `defaultMode`. Persistence happens at the app glue layer.
- `setMode` updates internal state synchronously, then fires `onChange(mode)` as fire-and-forget (`void onChange?.(mode)`). State is the source of truth; persistence is best-effort.
- Exposes `BrandModeOverrideContext` (existing) for token consumers and `BrandModeSetterContext` (new) for the setter.

### `useBrandModeSetter()`

```tsx
function useBrandModeSetter(): {
  override: BrandMode | null
  setMode: (mode: BrandMode | null) => void
}
```

Throws `'useBrandModeSetter must be used inside <BrandModeProvider>'` outside the Provider — strict, like other Setter Contexts in the codebase.

### `<BrandModeThemeRow>`

No props. Renders a labelled segmented control with 3 buttons. Token references:

| Element | Token |
|---|---|
| Label "Theme" | `semantic.text.muted` |
| Container border + inter-segment separator | `semantic.border.default` |
| Container bg / unselected bg | `semantic.bg.card` |
| Selected segment bg | `semantic.accent.bg` |
| Selected segment text | `semantic.accent.primary` |
| Unselected segment text | `semantic.text.body` |

Accessibility:
- Each button: `accessibilityRole="button"`, `accessibilityState={{ selected }}` (native), `aria-pressed={selected}` (web, per Gotcha #22 — RNW 0.19 does NOT auto-translate `accessibilityState.selected` to `aria-pressed`).

## 7. Data flow

### 7.1 First paint — web

1. Browser request → async `RootLayout` server component calls `readBrandModeCookie()` → resolves to `'light' | 'dark' | null`.
2. `<BrandModeProvider defaultMode={resolved}>` server-rendered with the Context override populated.
3. `useBrandTokens()` in every component reads the override (it wins over `useColorScheme()`).
4. Server emits HTML with mode-correct inline styles. ✅ No flash.
5. Client hydrates with same `defaultMode` prop → `useState` starts equal → no mismatch, no re-paint.

**Edge case:** first-time visitor with no cookie, OS in dark mode. Server has no signal, renders light. Client hydrates, `useColorScheme()` returns `'dark'`, re-renders to dark. Single-frame flash. Disappears as soon as user toggles anything (cookie persists). Documented as accepted v1 cost.

### 7.2 First paint — mobile

1. App boot → `RootLayout` renders `<ActivityIndicator/>` (existing loading gate).
2. Two parallel `useEffect`s: `supabase.auth.getSession()` and `readBrandMode()`. Combined gate `loaded && brandModeReady`.
3. Both promises resolve → flip the gate.
4. `<BrandModeProvider defaultMode={brandMode}>` mounts with correct mode. `<Slot/>` renders. ✅ No flash through splash.

### 7.3 Toggle interaction

1. User taps a segment → `setMode(value)`.
2. `useState` updates synchronously → `BrandModeOverrideContext` re-renders all token consumers → UI repaints.
3. In parallel: `onChange(value)` fires.
   - Web: `document.cookie = ...` (sync, no await needed for subsequent SSRs).
   - Mobile: `AsyncStorage.setItem(...)` (or `removeItem` for `null`).

## 8. Error handling

| Failure | Behavior |
|---|---|
| Cookie / AsyncStorage read fails | Caught, Sentry breadcrumb, treat as `null` → fall through to `useColorScheme()`. |
| Storage returns garbage string | Guarded at the helper: `v === 'light' || v === 'dark' ? v : null`. |
| Storage write fails | Fire-and-forget rejection caught by Sentry. In-memory state remains correct; reload would revert. Acceptable edge case. |
| Provider not mounted | `useBrandTokens()` keeps working (falls through to `useColorScheme()`). `useBrandModeSetter()` throws. |

**Non-issues:**
- Hydration mismatch on web: server and client both initialize from `defaultMode` — agree by construction.
- Concurrent toggles: `setMode` is synchronous React state. Last call wins.
- System theme changes mid-session: `useColorScheme()` already subscribes to OS events when override is `null`. No extra wiring.

## 9. Testing

All vitest, in `packages/officials-ui/test/`.

### `brand-mode-provider.test.tsx` (~6 cases)
- `defaultMode={null}` → consumer follows `useColorScheme()` mock.
- `defaultMode='light'` → consumer sees light tokens regardless of system.
- `defaultMode='dark'` → consumer sees dark tokens regardless of system.
- `setMode('dark')` → Context updates → consumer re-renders with dark.
- `setMode(null)` → consumer falls back to system.
- `onChange` called with new value on every setMode (incl. `null`).

### `brand-mode-theme-row.test.tsx` (~5 cases)
- Renders three buttons labelled "System", "Light", "Dark".
- Initial selection reflects `override` (parametrized over 3 values).
- Tapping "Dark" calls `setMode('dark')`.
- Tapping "System" calls `setMode(null)`.
- Selected segment has `aria-pressed="true"` on web.

### `use-brand-mode-setter.test.tsx` (~1 case)
- Throws clear error when used outside `<BrandModeProvider>`.

### Out of scope
- Cookie round-trip integration on web — no Next.js test harness in workspace.
- AsyncStorage round-trip on mobile — covered by manual smoke.
- Visual regression / dark mode screenshots — slice 39+ scope.

### Manual smoke checklist (added to `docs/superpowers/mobile-dod-checklist.md` + new web equivalent)

Web:
- Hard-reload with cookie `chiaro_brand_mode=dark` → page renders dark from first paint, no flash.
- Hard-reload with no cookie + OS dark mode → page renders light, snaps to dark after hydration (accepted single-frame flash).
- Toggle System → Light → Dark → System on settings page; verify token surface updates everywhere.

Mobile:
- Kill app, relaunch with `AsyncStorage['chiaro_brand_mode']='dark'` → splash, then UI renders dark. No flash.
- Toggle on settings page; verify token surface updates.
- Change OS theme with override=System → app follows.

## 10. Implementation surface

**New files (5):**
- `packages/officials-ui/src/brand-mode-provider.tsx`
- `packages/officials-ui/src/settings/brand-mode-theme-row.tsx`
- `apps/web/lib/brand-mode-cookie.ts`
- `apps/web/lib/brand-mode-cookie.client.ts`
- `apps/mobile/lib/brand-mode-storage.ts`

**Edited files (5):**
- `packages/officials-ui/src/index.ts` (add exports)
- `apps/web/app/layout.tsx` (async + Provider wrap)
- `apps/mobile/app/_layout.tsx` (gate + Provider wrap)
- `apps/web/app/settings/page.tsx` (theme row)
- `apps/mobile/app/(app)/settings/index.tsx` (theme row)

**New test files (3):**
- `packages/officials-ui/test/brand-mode-provider.test.tsx`
- `packages/officials-ui/test/brand-mode-theme-row.test.tsx`
- `packages/officials-ui/test/use-brand-mode-setter.test.tsx`

**Total: 13 files.** Compressed-to-Mega-Slice tier per `feedback_workflow_tiers.md` (upper edge of the 4–7 compressed band).

## 11. Risks + open questions

- **Sentry-on-AsyncStorage-reject**: low priority. If `@sentry/react-native` capture surfaces excess noise from storage rejections, downgrade to `console.warn` for v1.
- **Cookie `SameSite` flag**: `Lax` is the safe default. `Strict` would break theme on links from external sites; not a concern here.
- **Theme row token color contrast**: `accent.bg` + `accent.primary` text — verify contrast meets WCAG AA at implementation time. If marginal, swap selected text to `text.primary`.

## 12. Slice closeout criteria

- All 12 new tests pass.
- `pnpm -r typecheck` green.
- `pnpm --filter @chiaro/web build` green.
- Manual smoke checklist (§9) walked on web (Chrome/Safari) + mobile (iOS sim or Android dev client).
- CLAUDE.md gets a slice 38 entry in the "Slices delivered" log; mobile DoD checklist updated.

## 13. What this slice unblocks

Slice 39+ visual smoke testing of the seven queued reskin decisions in `project_chiaro_slice38_visual_reskin_roadmap.md`. With the toggle live, you can walk each decision (link blue vs accent, AlignmentChip tiers, BioPortrait gradient, industry rainbow, finance green, MetricCardShell retune, etc.) and judge against rendered screens instead of imagined ones.
