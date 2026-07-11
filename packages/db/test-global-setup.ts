import { createConnection } from 'node:net'

/**
 * Vitest globalSetup pre-flight (slice 63, audit U10).
 *
 * Every suite in this package's include glob (supabase/seed/.../*.test.ts)
 * writes to the local Supabase Postgres. Without it running, `pnpm test`
 * used to produce hundreds of cryptic per-test connection failures. Probe
 * the DB port once and fail with a single actionable message instead.
 *
 * Escape hatch: set CHIARO_SKIP_DB_PREFLIGHT=1 to skip the probe when
 * deliberately running only DB-free unit files (e.g. shared/cli.test.ts on
 * a runner without Docker).
 */
export default async function preflight(): Promise<void> {
  if (process.env.CHIARO_SKIP_DB_PREFLIGHT === '1') return

  const dbUrl =
    process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  const { hostname, port } = new URL(dbUrl)

  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: hostname, port: Number(port || 5432) })
    const fail = () => {
      socket.destroy()
      reject(
        new Error(
          `Local Supabase Postgres is not reachable at ${hostname}:${port || 5432} — ` +
            'run `pnpm db:start` (and `pnpm db:reset` for a fresh schema) before `pnpm --filter @chiaro/db test`. ' +
            'To run only DB-free unit files, set CHIARO_SKIP_DB_PREFLIGHT=1.',
        ),
      )
    }
    socket.setTimeout(2_000, fail)
    socket.once('error', fail)
    socket.once('connect', () => {
      socket.end()
      resolve()
    })
  })
}
