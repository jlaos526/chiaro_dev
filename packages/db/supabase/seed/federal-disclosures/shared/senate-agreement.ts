import * as cheerio from 'cheerio'
import { BROWSER_USER_AGENT } from '../../state-ethics/events/ballotpedia-recalls-helpers.ts'

const BASE_URL = 'https://efdsearch.senate.gov'

export interface SenateSession {
  csrfToken: string
  cookie: string
}

export async function acceptSenateAgreement(opts: {
  fetcher?: typeof fetch
}): Promise<SenateSession> {
  const fetcher = opts.fetcher ?? fetch
  // Step 1: GET landing page; extract CSRF token + cookie
  const res = await fetcher(`${BASE_URL}/search/`, {
    headers: { 'User-Agent': BROWSER_USER_AGENT },
  })
  if (!res.ok) throw new Error(`Senate landing fetch failed: ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const csrfToken = $('input[name="csrfmiddlewaretoken"]').attr('value')
  if (!csrfToken) throw new Error('Senate CSRF token not found in landing HTML')
  const cookie = extractCsrfCookie(res.headers.get('set-cookie') ?? '')
  if (!cookie) throw new Error('Senate csrftoken cookie missing from landing Set-Cookie header')
  // Step 2: POST agreement form
  const form = new URLSearchParams({
    csrfmiddlewaretoken: csrfToken,
    prohibition_agreement: '1',
  })
  const post = await fetcher(`${BASE_URL}/search/home/`, {
    method: 'POST',
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Referer: `${BASE_URL}/search/`,
    },
    body: form.toString(),
  })
  if (!post.ok) throw new Error(`Senate agreement POST failed: ${post.status}`)
  return { csrfToken, cookie }
}

function extractCsrfCookie(setCookieHeader: string): string {
  const m = /csrftoken=([^;]+)/.exec(setCookieHeader)
  return m ? `csrftoken=${m[1]}` : ''
}

export interface SenateSearchOpts {
  session: SenateSession
  reportType: '7c' | '11' // 7c = PTR; 11 = annual FD
  year: number
  fetcher?: typeof fetch
}

export interface SenateSearchResult {
  filingId: string
  fullName: string
  reportDate: string
  pdfUrl: string
}

/**
 * Stub — real implementation lands in slice 26 Task 3/4 when PTR + FD
 * Senate adapters need it. POST /search/report/ with session + filter
 * form; parse results HTML via cheerio.
 */
export async function searchSenateEfpfd(_opts: SenateSearchOpts): Promise<SenateSearchResult[]> {
  return []
}
