# 2026-07-12 — Lighthouse baseline (live origin)

First measured-performance capture of the deployed app (slice 79.5 demo-readiness;
the S67/S70/S79 optimization arc previously had no live numbers). Run against the
production Vercel origin with Lighthouse 12, **mobile emulation (default throttling)**,
headless Chrome, unauthenticated `/sign-in` (the only meaningful page reachable
without a session until the S83 Playwright harness can capture authenticated pages).

| Category | Score |
|---|---|
| Performance | **63** |
| Accessibility | **95** |
| Best practices | **96** |

| Metric | Value |
|---|---|
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 2.9 s |
| Total Blocking Time | 430 ms |
| Cumulative Layout Shift | **0.382** |
| Speed Index | 5.2 s |

## Reading it

- **CLS 0.382 is the headline finding** — the sign-in card shifts on load
  (Inter font swap + the auth card mounting after hydration are the likely
  contributors). This is exactly S80 card-shell territory; carry it into that
  slice as a measurable target (< 0.1).
- TBT 430 ms on emulated mobile: hydration cost of the RNW bundle on a
  low-end profile. The S70 bundle cuts (74–135 kB/route) landed before this
  baseline, so this IS the improved number — no "before" exists.
- Desktop preset scores substantially higher (mobile emulation throttles CPU
  4×); this baseline deliberately keeps the harsher default so future
  captures are comparable.
- Authenticated pages (home, officials detail — where the S79 SSR-prefetch
  work lives) need a scripted session to capture; add to the S83 Playwright
  harness (`lighthouse --extra-headers` with a session cookie, or
  playwright-lighthouse).

Raw JSON not committed (387 KB); re-run with:

```bash
CHROME_PATH="C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
npx lighthouse@12 https://chiaro-dev-web.vercel.app/sign-in \
  --only-categories=performance,accessibility,best-practices \
  --output=json --chrome-flags="--headless=new"
```
