# Slice 59 — Route bug-fixes + test coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three route-level bugs (web 500 on bad id, mobile dark-mode `#fff`, middleware allowList) and back-fill the render/guard tests that let them hide (audit track T5).

**Architecture:** Per-area tasks. Web route tests follow the `apps/web/test/app/home-page.test.tsx` pattern (mock `next/navigation` redirect + `createSupabaseServerClient` + domain fns + client islands, then call the async server page directly). Mobile tests use jest-expo with top-level `jest.mock` (NEVER `resetModules` — Gotcha #11). No schema.

**Tech Stack:** Next 15 App Router (RSC), Expo Router, react-native-web, vitest + jsdom, jest-expo, TanStack Query (mocked).

**Branch:** `slice-59-route-bugs-tests` (spec `4c98117` committed).

**Conventions:** Sequential implementers (Gotcha #25). After editing a web page, the web vitest suite is the gate. The `redirect()`/`<Redirect>` mocks let tests assert navigation without a real router.

---

### Task 1: Web bugs — B1 (state-officials 500 guard) + B13 (middleware allowList)

**Files:**
- Modify: `apps/web/app/state-officials/[id]/page.tsx`
- Modify: `apps/web/middleware.ts`
- Test: `apps/web/test/app/officials-route-guards.test.tsx` (B1's not-found case lands here in Task 2; this task adds a middleware test)
- Test: `apps/web/test/middleware.test.ts` (new, for B13)

Context: `state-officials/[id]/page.tsx:16` `const official = await fetchOfficial(supabase, id)` — `fetchOfficial` (`packages/officials/src/queries.ts:54`) does `if (error) throw error`, so a bad id throws → 500. Fix: wrap ONLY the fetch in try/catch; `redirect('/')` in the catch (so Next's `redirect()` control-flow throw propagates OUT, never re-caught — no `isRedirectError` dance needed because redirect isn't inside the try). `middleware.ts:35` allowList lacks `/issues` + `/legal`.

- [ ] **Step 1: B13 failing test** — `apps/web/test/middleware.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
// The allowList is a module-local const; assert the gate logic via the exported
// matcher behavior. Simplest: import the allowList check by re-deriving it from
// the same predicate. Read middleware.ts first; if allowList isn't exported,
// export it (or a `isAllowlisted(path)` helper) so it's testable.
import { isAllowlisted } from '../middleware'

describe('middleware calibrate-redirect allowList', () => {
  it('allows /issues and /legal (+ subpaths) for uncalibrated users', () => {
    expect(isAllowlisted('/issues')).toBe(true)
    expect(isAllowlisted('/legal/privacy')).toBe(true)
    expect(isAllowlisted('/legal/terms')).toBe(true)
  })
  it('still gates a non-allowlisted path', () => {
    expect(isAllowlisted('/officials/abc')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — verify FAIL.** `pnpm --filter @chiaro/web test middleware`. Expected: `isAllowlisted` not exported / `/issues` not allowed.

- [ ] **Step 3: Implement B13** — in `middleware.ts`, extract the allowList check into an exported helper and add the two paths:
```ts
const ALLOW_LIST = ['/calibrate', '/sign-out', '/profile/edit', '/settings', '/settings/address', '/issues', '/legal']
export function isAllowlisted(path: string): boolean {
  return ALLOW_LIST.some(p => path === p || path.startsWith(p + '/'))
}
```
and replace the inline `allowList.some(...)` at `:37` with `isAllowlisted(path)`.

- [ ] **Step 4: Implement B1** — in `state-officials/[id]/page.tsx`, wrap the fetch:
```tsx
  let official
  try {
    official = await fetchOfficial(supabase, id)
  } catch {
    redirect('/')
  }
```
Keep the subsequent `if (!isStateLevel(official.chamber)) redirect('/officials/${id}')` and the `fetchOfficialDistrictOffices` call as-is (they run after a successful fetch). (`redirect` is already imported at `:1`.)

- [ ] **Step 5: Run — verify PASS.** `pnpm --filter @chiaro/web test middleware` + `pnpm --filter @chiaro/web typecheck`. (B1's behavioral test lands in Task 2.)

- [ ] **Step 6: Commit.**
```bash
git add apps/web/app/state-officials/ apps/web/middleware.ts apps/web/test/middleware.test.ts
git commit -m "fix(slice-59): state-officials not-found guard + middleware allowList /issues+/legal (B1,B13)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Web tests — F1 detail pages + F2 cross-route guard

**Files:**
- Create: `apps/web/test/app/officials-detail-page.test.tsx`, `apps/web/test/app/state-officials-detail-page.test.tsx`
- Modify: `apps/web/test/app/officials-route-guards.test.tsx` (F2 upgrade)

Context: mirror `apps/web/test/app/home-page.test.tsx` — `vi.hoisted` a `redirectMock`, `vi.mock('next/navigation', () => ({ redirect: redirectMock }))`, mock `@/lib/supabase/server`'s `createSupabaseServerClient` (fake `auth.getUser`), mock `@chiaro/officials`' `fetchOfficial`/`isStateLevel`/etc., mock the client islands the page imports (read each `page.tsx` + its `*Client.tsx` imports to get the exact set), then `await Page({ params: Promise.resolve({ id }) })` and assert. (Next 15 `params` is a Promise — check how the page destructures it.)

- [ ] **Step 1: Read** `apps/web/app/officials/[id]/page.tsx` + `state-officials/[id]/page.tsx` fully — list every import that must be mocked (islands like `BioHeaderClient`, domain fns like `fetchOfficial`, `fetchOfficialDistrictOffices`, `isStateLevel`, `STATE_NAMES`). Note how `params` + `user` are obtained.

- [ ] **Step 2: Write `state-officials-detail-page.test.tsx`** (full — this is the worked example; B1 + happy path):
```tsx
import { describe, expect, it, vi } from 'vitest'
const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn((_: string) => { throw new Error('REDIRECT') }) }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
let mockUser: { id: string } | null = { id: 'u1' }
let officialResult: { ok: true; official: any } | { ok: false }
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) } })),
}))
vi.mock('@chiaro/officials', async (orig) => ({
  ...(await orig<any>()),
  fetchOfficial: vi.fn(async () => { if (!officialResult.ok) throw new Error('not found'); return officialResult.official }),
  fetchOfficialDistrictOffices: vi.fn(async () => []),
}))
// mock the page's client islands as simple divs (fill from Step 1):
// vi.mock('../../app/state-officials/[id]/SomeClient', () => ({ SomeClient: () => <div /> }))
import Page from '../../app/state-officials/[id]/page'

const STATE = { id: 's1', chamber: 'state_house', /* …minimal fields the page reads… */ }

describe('state-officials/[id] page', () => {
  it('redirects to / when the id is not found (B1 — no 500)', async () => {
    mockUser = { id: 'u1' }; officialResult = { ok: false }
    await expect(Page({ params: Promise.resolve({ id: 'bad' }) })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })
  it('redirects to /sign-in when no user', async () => {
    mockUser = null; officialResult = { ok: true, official: STATE }
    await expect(Page({ params: Promise.resolve({ id: 's1' }) })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })
  it('redirects a federal official to /officials/[id]', async () => {
    mockUser = { id: 'u1' }; officialResult = { ok: true, official: { ...STATE, chamber: 'federal_house' } }
    await expect(Page({ params: Promise.resolve({ id: 's1' }) })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/officials/s1')
  })
  it('renders for a valid state official', async () => {
    mockUser = { id: 'u1' }; officialResult = { ok: true, official: STATE }; redirectMock.mockClear()
    const el = await Page({ params: Promise.resolve({ id: 's1' }) })
    expect(el).toBeTruthy(); expect(redirectMock).not.toHaveBeenCalled()
  })
})
```
(Note: `redirectMock` throws so control-flow stops at the redirect like the real `redirect()`. Adjust the `STATE` fixture + island mocks to the actual page per Step 1.)

- [ ] **Step 3: Write `officials-detail-page.test.tsx`** — same pattern for the federal page: `!user → /sign-in`; not-found → `/` (if the federal page guards it; assert whatever its current behavior is — it does `if (!official) redirect('/')`); a state-chamber official → redirect `/state-officials/[id]`; valid federal → renders. Mock the federal page's islands (BioHeaderClient etc.) per its imports.

- [ ] **Step 4: Upgrade `officials-route-guards.test.tsx` (F2)** — keep the `isStateLevel` predicate test; add a short comment that the page-level redirect flows are now covered by `officials-detail-page.test.tsx` + `state-officials-detail-page.test.tsx` (cross-reference), OR move the cross-route assertions here. Simplest: leave the predicate test, replace the Playwright-deferral comment with a note pointing to the two new page tests.

- [ ] **Step 5: Run — verify PASS.** `pnpm --filter @chiaro/web test` (the 2 new files + the guard file green; B1's redirect now proven).

- [ ] **Step 6: Commit.**
```bash
git add apps/web/test/app/
git commit -m "test(slice-59): web officials/state-officials detail page render+redirect tests (F1,F2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Web tests — F1 issues + calibrate + settings render smoke

**Files:**
- Create: `apps/web/test/app/issues-page.test.tsx`, `apps/web/test/app/calibrate-page.test.tsx`, `apps/web/test/app/settings-page.test.tsx`

Context: same `home-page.test.tsx` pattern. These pages are simpler (a stepper island / a calibrate client / settings rows). For each: mock `next/navigation` redirect + `createSupabaseServerClient` + the page's islands/hooks, render, assert it mounts (and the `!user → /sign-in` redirect where the page guards auth).

- [ ] **Step 1: Read** `apps/web/app/issues/page.tsx`, `apps/web/app/calibrate/page.tsx`, `apps/web/app/settings/page.tsx` — list the islands/hooks each imports.

- [ ] **Step 2: Write the 3 test files** — each follows this shape (fill the mocks per Step 1):
```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
let mockUser: { id: string } | null = { id: 'u1' }
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) } })),
}))
// mock the page's island(s) as divs, e.g.:
// vi.mock('../../app/issues/IssuesStepperClient', () => ({ IssuesStepperClient: () => <div data-testid="issues-stepper" /> }))
import Page from '../../app/issues/page'
describe('issues page', () => {
  it('redirects to /sign-in when no user', async () => { mockUser = null; await Page(); expect(redirectMock).toHaveBeenCalledWith('/sign-in'); mockUser = { id: 'u1' } })
  it('mounts the stepper island for an authed user', async () => {
    const el = await Page(); const { container } = render(el)
    expect(container.querySelector('[data-testid="issues-stepper"]')).toBeTruthy()
  })
})
```
(If a page doesn't guard auth — e.g. settings might not — drop the `/sign-in` case + assert the mount only. Match each page's real behavior.)

- [ ] **Step 3: Run — verify PASS.** `pnpm --filter @chiaro/web test`.

- [ ] **Step 4: Commit.**
```bash
git add apps/web/test/app/
git commit -m "test(slice-59): web issues/calibrate/settings page render smoke tests (F1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Mobile bug — B2 (`#fff` → `semantic.bg.app`)

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx` (`:67`), `apps/mobile/app/(app)/state-officials/[id].tsx` (`:34`)

Context: both render `<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>`. Replace `#fff` with `useBrandTokens().semantic.bg.app`.

- [ ] **Step 1: Read** both screens — confirm whether `useBrandTokens` is already imported/called; the hook MUST be called at the top of the component (before any early return/loading branch) for Rules-of-Hooks. `useBrandTokens` comes from `@chiaro/officials-ui`.

- [ ] **Step 2: Implement** — in each screen, add `const { semantic } = useBrandTokens()` near the other top-level hooks, and change the SafeAreaView style to `{ flex: 1, backgroundColor: semantic.bg.app }`. (If the screen already calls `useBrandTokens`, reuse it.)

- [ ] **Step 3: Verify.** `pnpm --filter @chiaro/mobile test` (existing mobile tests still green; the officials-detail-alignment test renders one of these screens — confirm it still passes) + `pnpm -r typecheck`.

- [ ] **Step 4: Commit.**
```bash
git add "apps/mobile/app/(app)/officials/[id].tsx" "apps/mobile/app/(app)/state-officials/[id].tsx"
git commit -m "fix(slice-59): mobile detail screens use semantic.bg.app not #fff (B2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Mobile tests — F3 calibrate + F4 nav guards + F6 home nav

**Files:**
- Create: `apps/mobile/test/calibrate.test.tsx`, `apps/mobile/test/nav-guards.test.tsx`, `apps/mobile/test/home-nav.test.tsx`

All jest-expo, top-level `jest.mock` (Gotcha #11), no `resetModules`. jest-expo cannot render `@chiaro/officials-ui` components — mock them to capture callback props.

- [ ] **Step 1: F3 — `calibrate.test.tsx`.** The calibrate handlers are internal; mock `@chiaro/officials-ui`'s `CalibrateScreen` to capture `onSubmit`/`onGpsSubmit`, then invoke them. Mock: `expo-router` (`useRouter` → `{ replace: jest.fn() }`), `expo-router/drawer`, `@/lib/supabase` (`supabase.functions.invoke`), `@/lib/location-permissions` (`getCurrentLocation`), `@chiaro/officials-ui/src/nav/BackButton.tsx`, AsyncStorage, `@react-native-async-storage/async-storage`. Keep `@chiaro/location` real (the `addressInputSchema`). Assertions:
```tsx
// after rendering <CalibratePage/> and capturing onSubmit from the CalibrateScreen mock:
it('maps 400/422/502 invoke errors to messages', async () => {
  invokeMock.mockResolvedValueOnce({ error: { context: { status: 400 } } })
  await expect(captured.onSubmit('350 5th Ave, New York, NY 10118')).rejects.toThrow(/double-check spelling/i)
  invokeMock.mockResolvedValueOnce({ error: { context: { status: 422 } } })
  await expect(captured.onSubmit('350 5th Ave, New York, NY 10118')).rejects.toThrow(/can't resolve districts/i)
})
it('replaces to / on success', async () => {
  invokeMock.mockResolvedValueOnce({ error: null })
  await captured.onSubmit('350 5th Ave, New York, NY 10118')
  expect(replaceMock).toHaveBeenCalledWith('/')
})
it('GPS path: getCurrentLocation → invoke {lat,lng} → replace', async () => {
  getCurrentLocationMock.mockResolvedValueOnce({ ok: true, lat: 40.7, lng: -73.9 })
  invokeMock.mockResolvedValueOnce({ error: null })
  await captured.onGpsSubmit()
  expect(invokeMock).toHaveBeenCalledWith('calibrate-location', { body: { lat: 40.7, lng: -73.9 } })
  expect(replaceMock).toHaveBeenCalledWith('/')
})
it('GPS path surfaces a permission failure', async () => {
  getCurrentLocationMock.mockResolvedValueOnce({ ok: false, message: 'Location permission denied' })
  await expect(captured.onGpsSubmit()).rejects.toThrow(/permission denied/i)
})
```
Use a valid address that passes `addressInputSchema` (mirror the one in existing mobile/web tests).

- [ ] **Step 2: F4 — `nav-guards.test.tsx`.** Two guards:
  - **App calibration gate** (`(app)/_layout.tsx` returns `<Redirect href="/calibrate">`): mock `expo-router` (`Redirect` → a component capturing `href`; `useSegments` → return value per case), `@/lib/supabase` (`auth.getUser` → user; `.from('user_locations').select(...)` → `{ count }`), AsyncStorage (`getItem` → null), `@chiaro/officials-ui/src/nav/BrandDrawer.tsx` (→ a marker). Render `<AppLayout/>`, wait for the effect, assert: count=0 + segments not calibrate/settings → `<Redirect href="/calibrate">` rendered; count=1 → BrandDrawer rendered; segments includes 'settings' (uncalibrated) → BrandDrawer (exempt).
  - **Root auth redirect** (`_layout.tsx` `useEffect` → `router.replace`): mock `expo-router` (`useRouter` → `{ replace }`, `useSegments`, `Slot`), `@/lib/supabase` (`auth.getSession` → `{ data: { session: null }}`, `onAuthStateChange` → `{ data: { subscription: { unsubscribe(){} }}}`), `@/lib/brand-mode-storage` (`readBrandMode` → resolves a mode), `@/lib/sentry` (`initSentry` no-op, `ErrorBoundary` passthrough), `@/lib/query-client` (`QueryProvider` passthrough), `@chiaro/officials-ui` (`BrandModeProvider`/`ChiaroClientProvider` passthrough), `react-native-gesture-handler`. Render `<RootLayout/>`, wait for loaded, assert `replace('/(auth)/sign-in')` when session null + not in `(auth)` group; and `replace('/(app)')` when session present + segments `['(auth)']`.
  (The root layout is mock-heavy — if it proves intractable in jest-expo within a reasonable attempt, cover the app calibration gate fully + add a focused root-redirect assertion or note the limitation; do NOT refactor app source for testability in this slice.)

- [ ] **Step 3: F6 — `home-nav.test.tsx`.** Mock `@chiaro/officials-ui`'s `OfficialsCard` (or `MyIssuesCard`/home composite) to capture its `onSelect`, mock `expo-router` `useRouter` → `{ push }`, render the home screen `app/(app)/index.tsx` default export, then:
```tsx
it('builds the issue-positions deep link when a subCascadeSlug is present', () => {
  captured.onSelect({ officialId: 'o1', subCascadeSlug: 'finance' })
  expect(pushMock).toHaveBeenCalledWith('/officials/o1?cat=issue-positions&sub=finance')
})
it('builds the plain detail link with no slug', () => {
  captured.onSelect({ officialId: 'o1' })
  expect(pushMock).toHaveBeenCalledWith('/officials/o1')
})
```
(The home screen has other deps — mock them as needed to render: the profile alert, MyIssuesCard, DistrictPanel, supabase. Match what `app/(app)/index.tsx` imports.)

- [ ] **Step 4: Run — verify PASS.** `pnpm --filter @chiaro/mobile test`.

- [ ] **Step 5: Commit.**
```bash
git add apps/mobile/test/
git commit -m "test(slice-59): mobile calibrate + nav-guards + home-nav tests (F3,F4,F6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: officials-ui test — F5 `RepAlignmentSection`

**Files:**
- Create: `packages/officials-ui/test/issues/RepAlignmentSection.test.tsx`

Context: `RepAlignmentSection.tsx` calls `useRepAlignment(client, officialId)` → `{ data: alignment = null }`, `useMySelections(client)` → `{ data: selections }`, computes `hasSelections = (selections?.length ?? 0) > 0`, owns `expanded` state, renders `<RepAlignmentStrip alignment hasSelections onSetup onExpand expanded />` + `{expanded && alignment != null && alignment.overallPct != null && <IssueRadarOverlay alignment repName />}`.

- [ ] **Step 1: Write the test** — mock `@chiaro/issues` (`useRepAlignment`, `useMySelections`), `../client-context.tsx` (`useChiaroClient` → `{}`), and the two children to capture props:
```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
let mockAlignment: any; let mockSelections: any[] | undefined
vi.mock('@chiaro/issues', () => ({
  useRepAlignment: () => ({ data: mockAlignment }),
  useMySelections: () => ({ data: mockSelections }),
}))
vi.mock('../../src/client-context.tsx', () => ({ useChiaroClient: () => ({}) }))
let stripProps: any
vi.mock('../../src/issues/RepAlignmentStrip.tsx', () => ({
  RepAlignmentStrip: (p: any) => { stripProps = p; return <button onClick={p.onExpand}>strip hasSelections={String(p.hasSelections)}</button> },
}))
vi.mock('../../src/issues/IssueRadarOverlay.tsx', () => ({ IssueRadarOverlay: () => <div data-testid="overlay" /> }))
import { RepAlignmentSection } from '../../src/issues/RepAlignmentSection.tsx'

describe('RepAlignmentSection', () => {
  it('passes hasSelections=false when the user has no selections', () => {
    mockAlignment = null; mockSelections = []
    render(<RepAlignmentSection officialId="o1" onSetup={() => {}} />)
    expect(stripProps.hasSelections).toBe(false)
  })
  it('shows the overlay only when expanded and alignment has an overallPct', () => {
    mockAlignment = { overallPct: 72, axes: [] }; mockSelections = [{}]
    render(<RepAlignmentSection officialId="o1" repName="Rep X" onSetup={() => {}} />)
    expect(screen.queryByTestId('overlay')).toBeNull()       // collapsed
    fireEvent.click(screen.getByText(/strip/))               // toggle expand
    expect(screen.getByTestId('overlay')).toBeTruthy()
  })
  it('suppresses the overlay when overallPct is null even if expanded', () => {
    mockAlignment = { overallPct: null, axes: [] }; mockSelections = [{}]
    render(<RepAlignmentSection officialId="o1" onSetup={() => {}} />)
    fireEvent.click(screen.getByText(/strip/))
    expect(screen.queryByTestId('overlay')).toBeNull()
  })
})
```
(Adjust the relative mock paths to match how the package's other tests reference `src/` — check a sibling like `test/issues/RepAlignmentStrip.test.tsx`.)

- [ ] **Step 2: Run — verify PASS.** `pnpm --filter @chiaro/officials-ui test RepAlignmentSection`.

- [ ] **Step 3: Commit.**
```bash
git add packages/officials-ui/test/issues/RepAlignmentSection.test.tsx
git commit -m "test(slice-59): RepAlignmentSection container test (F5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify-all + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-59 entry), `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T5 done)

- [ ] **Step 1: Full verification sweep.** Run, expecting green:
- `pnpm -r typecheck`
- `pnpm --filter @chiaro/officials-ui test` (record total — +~3 from F5)
- `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test` (the new route tests — record total)
- `pnpm --filter @chiaro/mobile test` (the new jest-expo tests)

- [ ] **Step 2: CLAUDE.md** — add the slice-59 entry after the slice-58 entry:
```markdown
- **Slice 59 — Route bug-fixes + test coverage (audit T5)** (2026-06-07): Mega Slice (~20 files). Fourth audit-track remediation. **Bugs:** B1 web `state-officials/[id]/page.tsx` wraps `fetchOfficial` in try/catch → `redirect('/')` (a bad/stale id was throwing a 500 — `fetchOfficial` `.single()`-throws; redirect lives in the catch so Next's control-flow throw isn't swallowed); B2 mobile `officials/[id].tsx` + `state-officials/[id].tsx` SafeAreaView `backgroundColor` `#fff` → `useBrandTokens().semantic.bg.app` (dark-mode break + the last 2 mobile inline-hex sites); B13 `middleware.ts` allowList gains `/issues` + `/legal` (uncalibrated users were bounced from the issues flow + legal pages). **Tests:** F1 web render/redirect tests for `officials/[id]`, `state-officials/[id]`, `issues`, `calibrate`, `settings` (the `home-page.test.tsx` pattern — `await Page()` the async server component, mock `next/navigation` redirect + islands); F2 page-level cross-route guard (state↔federal redirect + B1 not-found) upgrading `officials-route-guards.test.tsx`; F3 mobile calibrate status→message branches + GPS path; F4 mobile nav guards (root auth redirect + app calibration gate exemptions); F5 `RepAlignmentSection` container (CTA-when-empty / overlay-toggle / suppressed-when-overallPct-null); F6 mobile home `subCascadeSlug` deep-link builder. sign-in/sign-up web render tests deferred (thin AuthForm wrappers, tested upstream). No schema (pgTAP stays 490).
```

- [ ] **Step 3: Mark audit T5 done** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, prepend `✅ SHIPPED (slice 59). ` to the T5 row's Note cell.

- [ ] **Step 4: Commit.**
```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-59): CLAUDE.md slice entry + mark audit T5 done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)
- [ ] All 4 CI jobs green. `build` + `test` exercise the web + mobile + officials-ui changes.
- [ ] `git log --oneline master..HEAD` shows spec + plan + Tasks 1–7.
- [ ] PR title: "Slice 59 — Route bug-fixes + test coverage (audit T5)". Squash-merge + delete branch; sync master.

## Notes
- **B1 redirect nuance:** keep `redirect('/')` in the `catch` (not inside the `try`) so Next's `redirect()` control-flow throw propagates — no `isRedirectError` handling needed. The test's `redirectMock` throws to emulate this.
- **Async server components** are tested by calling them directly (`await Page(args)`) — vitest needs no special RSC support (the `home-page.test.tsx` precedent).
- **jest-expo** can't render `@chiaro/officials-ui` — mock those components to capture callback props (Gotcha #11; no `resetModules`).
- If the F4 root-layout test proves too mock-heavy to be worthwhile, prioritize the app calibration-gate coverage + a focused root assertion; do not refactor app source for testability in this slice.
