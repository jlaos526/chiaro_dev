// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertRejects, assertStrictEquals } from 'jsr:@std/assert'
import { scrubEventForTesting, withSentry } from './sentry.ts'

Deno.test('scrubEventForTesting scrubs address field', () => {
  const e: any = { request: { data: { address: '123 Main St', city: 'NY' } } }
  scrubEventForTesting(e)
  assertEquals(e.request.data.address, '[scrubbed]')
  assertEquals(e.request.data.city, 'NY')
})

Deno.test('scrubEventForTesting handles nested address', () => {
  const e: any = { extra: { formInput: { address: '1 Wall St' } } }
  scrubEventForTesting(e)
  assertEquals(e.extra.formInput.address, '[scrubbed]')
})

Deno.test('scrubEventForTesting handles breadcrumbs', () => {
  const e: any = { breadcrumbs: [{ data: { address: 'X' } }] }
  scrubEventForTesting(e)
  assertEquals(e.breadcrumbs[0].data.address, '[scrubbed]')
})

Deno.test('scrubEventForTesting handles cyclic references', () => {
  const cyclic: any = { address: '1 Main St' }
  cyclic.self = cyclic
  const e: any = { extra: { nested: cyclic } }
  scrubEventForTesting(e)
  assertEquals(e.extra.nested.address, '[scrubbed]')
  // self-reference preserved (cycle guard, not removal)
  assertStrictEquals(e.extra.nested.self, cyclic)
})

Deno.test('withSentry rethrows handler errors', async () => {
  const handler = (_req: Request) => Promise.reject(new Error('boom'))
  const wrapped = withSentry(handler)
  await assertRejects(() => wrapped(new Request('http://x')), Error, 'boom')
})

Deno.test('withSentry returns handler response on success', async () => {
  const handler = (_req: Request) => Promise.resolve(new Response('ok', { status: 200 }))
  const wrapped = withSentry(handler)
  const res = await wrapped(new Request('http://x'))
  assertStrictEquals(res.status, 200)
  assertStrictEquals(await res.text(), 'ok')
})
