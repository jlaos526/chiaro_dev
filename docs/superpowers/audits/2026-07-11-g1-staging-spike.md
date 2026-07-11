# G1 staging-deploy spike — 2026-07-11

**Scope (audit G1, roadmap strategic item):** stand up a hosted staging environment end-to-end once — `supabase link` → `db push` → Edge Function deploy → secrets → seeds → a deployed apps/web build pointed at it — and record every breakage. The breakage list IS the deliverable; the companion promotion runbook is `docs/superpowers/staging-promotion-runbook.md`.

**Environment stood up this session:**

| Piece | Value |
|---|---|
| Supabase project | `chiaro-staging`, ref `ebxlyxxudxapswuoonhm`, region us-east-2, Postgres 17.6 |
| DB access (IPv4) | session pooler `aws-1-us-east-2.pooler.supabase.com:5432`, user `postgres.<ref>` |
| Edge Function | `calibrate-location` deployed; `GEOCODIO_KEY` set via `supabase secrets set` |
| Auth config | confirmations ON, min password 8, `site_url=https://chiaro-dev-web.vercel.app`, allow-list vercel + localhost (set via Management API PATCH `/v1/projects/{ref}/config/auth`) |
| Web | https://chiaro-dev-web.vercel.app — Vercel, Root Directory `apps/web`, env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Seeds | tiger (42,509 districts) + officials (429 H + 97 S; 3 expected DC/territory delegate skips) + state-officials (6,260 — the gap to the 7,989 source files is NH's unmatchable districts per Gotcha #8 + non-current people) + issue-catalog (13 topics / 31 lenses) |

## Breakage list

1. **Direct DB host is IPv6-only.** `db.<ref>.supabase.co` does not resolve from IPv4-only machines (ENOTFOUND). Use the **session pooler** (port 5432, user `postgres.<ref>`); note the pooler host is region-instanced — this project lives on `aws-1-us-east-2`, and the `aws-0-…` host name (which older Supabase docs/examples assume) rejects the tenant. Probe both on a new project.
2. **`supabase login` cannot run in a non-TTY shell** (agent shells, CI): `LegacyLoginMissingTokenError`. Run it in a real terminal once per machine (token lands in the Windows Credential Manager under `Supabase CLI:supabase`), or mint a PAT and use `SUPABASE_ACCESS_TOKEN`.
3. **`seed:state-officials` has an undocumented data prerequisite.** The loader (`openstates-yaml-loader.ts`) is non-recursive and expects ONE flat directory of person YAMLs; the `openstates/people` repo nests `data/<state>/legislature/*.yml`. A fresh machine falls back to the committed test fixtures and hits the pre-flight abort (`lower=4 (min 4500)`). Required procedure (now in the promotion runbook + CLAUDE.md quick start): shallow-clone the repo, flatten `data/*/legislature/*.yml` into one dir (7,989 files as of 2026-07-11), export `OPENSTATES_DATA_DIR=<flat dir>`.
4. **Windows: the openstates/people clone fails checkout without `core.longpaths=true`.** Committee filenames exceed MAX_PATH (the failures are all in `data/*/committees/` — files the people seed doesn't even read, but the failed checkout aborts the clone with a non-zero exit that breaks command chains). Fix: `git clone -c core.longpaths=true …` (or set it repo-local and `git checkout -f HEAD`).
5. **Seed wall-times exceed a 10-minute execution window** against a remote DB: cold TIGER (download + WAN insert) ran ~15 min across two windows; `state-officials` (~7.4k sequential upserts through the pooler) runs 15–25 min alone. All seeds are idempotent/resumable, so re-running continues safely — but any future scheduled-ingest design (audit C34) and any tool-capped shell must budget for this. Bulk/batched inserts for the state-officials upsert loop would be the fix if this becomes routine.
6. **Local `~/.cache/tiger` was cold on this machine** — the slice-55 cache only helps machines that have seeded since it shipped. First hosted seed re-downloaded all ~203 Census zips (now cached for future runs).
7. **`seed:issue-catalog` uses a different env contract than the other seeds** — it ignores `SUPABASE_DB_URL` and requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (it writes through a PostgREST service-role client). A chain that exports only the DB URL fails at the last step. Both env vars now in the runbook §4.
8. **Non-breakages worth recording (traps that did NOT fire):** all 63 migrations applied cleanly to hosted PG17 — including `create trigger` on `auth.users` (0002; hosted permits it) and PostGIS (0003+); `supabase functions deploy` bundled via Docker fine; Vercel auto-detected the pnpm@9.12.0 workspace with Root Directory `apps/web` and the Next 15 middleware auth gate works deployed (`/` 307→`/sign-in`); Vercel injects HSTS automatically (S71 should account for headers Vercel already provides).

## Verification (all against the live hosted stack + deployed web)

| Check | Result |
|---|---|
| Migrations 0001–0063 `db push` | clean, zero edits |
| districts seeded | 42,509 rows |
| officials seeded | 429 house + 97 senate (P000610/R000600/N000147 skipped — DC/territory delegates, by design) |
| admin-created (pre-confirmed) users sign in with confirmations ON | PASS |
| direct-API signup with 6-char password | 422 rejected (slice-69 C54 enforced hosted-side) |
| calibrate #1 via deployed Edge Function (real address) | 200; NY-12 + senate + state + county + place resolved; 7 `user_districts` rows |
| calibrate #2 within 60s | **429 `calibrating_too_frequently` — slice-69 pre-geocode throttle live** |
| cross-user `profiles` SELECT (user B → user A) | 0 rows (migration 0063 U19 live) |
| self `profiles` SELECT | 1 row |
| anon `rpc/get_rep_issue_alignment` | 401 denied (0063 U20 live) |
| deployed web root | 307 → `/sign-in` (middleware live on Vercel); `/sign-in` 200 |

## Decisions made

- **Web host: Vercel** (user-selected). Free Hobby tier, Root Directory `apps/web`, no custom build config needed.
- **Sentry deferred to S70** — no DSNs wired on staging yet, per the roadmap's "all Sentry edits in one slice" ruling.
- **Hosted auth diverges from config.toml by design** (confirmations ON hosted / OFF local) — exactly as slice 69 documented; `supabase config push` must NOT be used until that divergence is reconciled.
- Legacy JWT anon/service_role keys used (project also provisions `sb_publishable_`/`sb_secret_` pairs; the app's supabase-js usage takes the legacy anon JWT).

## Follow-ups surfaced

- **Scheduled ingest (audit C34) is now unblocked** — a live demo exists; seeds are all manual today.
- Productize the session verification script (11 checks above) as a repo script for future promotions.
- S70/S71 now have a real origin to verify against; S71 should diff its header plan against what Vercel already injects.
- `NEXT_PUBLIC_SITE_URL` (sign-out fallback, C50) not set on Vercel — falls back to request origin, which is correct for a single domain; set it when a custom domain lands.
- Free-tier project pauses after ~1 week idle; unpause is one dashboard click.
