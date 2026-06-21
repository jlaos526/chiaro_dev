import type { ChiaroClient } from './client.ts'

export async function signUp(client: ChiaroClient, email: string, password: string) {
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(client: ChiaroClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut(client: ChiaroClient) {
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getSession(client: ChiaroClient) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Resolve the current user's id without a network round-trip.
 *
 * If `userId` is supplied (e.g. a web server component that already gated on a
 * validated `getUser()`), it is returned as-is. Otherwise the id is read from
 * the LOCAL session via `getSession()` — no GoTrue network call, unlike
 * `getUser()`.
 *
 * Behaviourally equivalent to the prior `getUser()` usage: both trust the
 * session's own claimed id for an `.eq` scoping filter. For `user_locations`
 * (0005) / `user_districts` (0060) self-scoped SELECT and the `profiles` UPDATE
 * `with check` (0002), RLS independently enforces ownership server-side. NOTE:
 * `profiles` SELECT is intentionally `using (true)` (authenticated-readable
 * directory), so for `getMyProfile` this `.eq('id', uid)` filter — not RLS — is
 * what scopes the read to the caller's own row; that's the same trust model the
 * old `getUser()` code had, on non-sensitive directory fields.
 */
export async function resolveUserId(
  client: ChiaroClient,
  userId?: string,
): Promise<string | null> {
  if (userId) return userId
  const { data } = await client.auth.getSession() // local read, no network
  return data.session?.user?.id ?? null
}
