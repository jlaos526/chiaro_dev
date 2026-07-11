# Staging promotion runbook

How to promote the repo's backend + web to the hosted staging environment, and how to stand the whole environment up again from zero. Written from the 2026-07-11 G1 spike (`docs/superpowers/audits/2026-07-11-g1-staging-spike.md` has the breakage rationale for every step).

**Current staging facts:** Supabase `chiaro-staging` ref `ebxlyxxudxapswuoonhm` (us-east-2, PG17) · web https://chiaro-dev-web.vercel.app (Vercel, Root Directory `apps/web`).

## 0. One-time per machine

```bash
# In a REAL terminal (the login flow needs a TTY):
npx supabase login
npx supabase link --project-ref ebxlyxxudxapswuoonhm --workdir packages/db   # prompts for DB password
```

Create `packages/db/.env` (gitignored) with:

```
SUPABASE_DB_PASSWORD=<project DB password>
GEOCODIO_KEY=<geocod.io key>
CONGRESS_GOV_API_KEY=<api.data.gov key>
```

**DB connection string for seeds/scripts (IPv4 machines):** the direct `db.<ref>.supabase.co` host is IPv6-only. Use the session pooler — and note the host is region-instanced (this project is `aws-1`, not `aws-0`; probe if unsure):

```
postgresql://postgres.ebxlyxxudxapswuoonhm:<PW>@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

## 1. Promote schema

```bash
SUPABASE_DB_PASSWORD=<pw> npx supabase db push --workdir packages/db
```

Applies pending `packages/db/supabase/migrations/*` in order. Verify with `npx supabase migration list --workdir packages/db`.

## 2. Promote the Edge Function

```bash
npx supabase functions deploy calibrate-location --workdir packages/db
npx supabase secrets set GEOCODIO_KEY=<key> --workdir packages/db     # only when the key changes
```

## 3. Auth config (hosted ≠ config.toml, by design)

`packages/db/supabase/config.toml` governs LOCAL/CI only, and deliberately diverges (slice 69): local has `enable_confirmations = false`; hosted must have confirmations **ON**. **Never run `supabase config push`** until that divergence is reconciled — it would silently weaken hosted auth.

Hosted values (set 2026-07-11; change via dashboard → Authentication, or Management API `PATCH /v1/projects/{ref}/config/auth` with the CLI token):

- `mailer_autoconfirm=false` (email confirmations required)
- `password_min_length=8`
- `site_url=https://chiaro-dev-web.vercel.app` — confirmation-email links point here; update if the web URL changes
- `uri_allow_list=https://chiaro-dev-web.vercel.app/**,http://localhost:3000/**`
- Captcha: OFF — pre-public-launch item (audit U18)

## 4. Seeds (order matters)

```bash
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<PW>@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
export SUPABASE_URL="https://<ref>.supabase.co"          # issue-catalog only
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"    # issue-catalog only — different env contract than the DB-URL seeds
pnpm seed:tiger              # ~51 shapefiles; cached in ~/.cache/tiger after first run
pnpm seed:officials          # needs CONGRESS_GOV_API_KEY; 3 DC/territory delegate skips are normal
pnpm seed:state-officials    # needs OPENSTATES_DATA_DIR — see below; expect ~6.3k upserts (NH skips are normal, Gotcha #8)
pnpm seed:issue-catalog      # expect "13 topics / 31 lenses"
```

**`seed:state-officials` prerequisite (undocumented before the G1 spike):** the loader reads ONE flat directory of person YAMLs. Build it from the `openstates/people` repo:

```bash
git clone -c core.longpaths=true --depth 1 https://github.com/openstates/people.git   # longpaths: Windows MAX_PATH, committee filenames
mkdir people-flat && cp people/data/*/legislature/*.yml people-flat/                  # ~8k files; on Windows use PowerShell Copy-Item (fast)
export OPENSTATES_DATA_DIR=<abs path to people-flat>
pnpm seed:state-officials
```

**Timing:** cold TIGER ≈ 15 min; state-officials ≈ 15–25 min over the pooler. All seeds are idempotent — re-run on interruption. Any scheduler (audit C34) must budget accordingly.

## 5. Web (Vercel)

Project settings: Root Directory `apps/web` (include files outside root ON); framework Next.js; default build/install (workspace + pinned `pnpm@9.12.0` are auto-detected). Env vars:

```
NEXT_PUBLIC_SUPABASE_URL=https://ebxlyxxudxapswuoonhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<legacy anon JWT — `npx supabase projects api-keys --project-ref <ref>`>
```

Deploys auto-trigger on push to master once the Git integration is on. If the domain changes, update auth `site_url` + `uri_allow_list` (§3).

## 6. Post-promotion verification (the G1 checks)

1. `https://<web>/` → 307 to `/sign-in`; `/sign-in` → 200.
2. Admin-create a confirmed user (service-role `POST /auth/v1/admin/users`, `email_confirm: true`) → password sign-in works.
3. Direct-API signup with a 7-char password → 422.
4. `POST /functions/v1/calibrate-location` with a real address → 200 + districts; immediate second call → 429.
5. `user_districts` for the test user ≥ 3 rows; cross-user `profiles` SELECT → 0 rows; anon `rpc/get_rep_issue_alignment` → 401.

## Known staging constraints

- Free tier pauses the project after ~1 week idle (dashboard unpause).
- Confirmation emails use Supabase's built-in sender (strict hourly rate limits) — fine for staging; custom SMTP is a pre-launch item.
- Sentry is NOT wired on staging until S70.
