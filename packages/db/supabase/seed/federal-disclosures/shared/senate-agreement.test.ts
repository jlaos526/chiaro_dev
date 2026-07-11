import { describe, expect, it, vi } from 'vitest'
import { acceptSenateAgreement } from './senate-agreement.ts'

describe('acceptSenateAgreement', () => {
  it('extracts CSRF token + cookie from landing then POSTs agreement', async () => {
    const landingHtml = '<form><input name="csrfmiddlewaretoken" value="abc123" /></form>'
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(landingHtml),
        headers: { get: () => 'csrftoken=cookie-abc123; Path=/; HttpOnly' } as unknown as Headers,
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const session = await acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch })
    expect(session.csrfToken).toBe('abc123')
    expect(session.cookie).toBe('csrftoken=cookie-abc123')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('throws when CSRF token not found', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<form></form>'),
      headers: { get: () => '' },
    })
    await expect(
      acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/CSRF token not found/)
  })

  it('throws when landing fetch fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('') })
    await expect(
      acceptSenateAgreement({ fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(/landing fetch failed/)
  })
})
