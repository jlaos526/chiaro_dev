'use client'

import { useRef } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { StyleSheet } from 'react-native'

/**
 * Slice 80 (T5 CLS follow-through): react-native-web keeps its atomic CSS
 * (the `css-*` / `r-*` classes) in a RUNTIME-injected stylesheet — the SSR
 * HTML carried the class names but never the rules, so every page first
 * painted as unstyled block divs until hydration injected the sheet (~650 ms
 * on the live origin). On /sign-in that unstyled frame let the card's h1 UA
 * margin collapse through the not-yet-flex container, pushing it 21 px down;
 * the style injection then snapped it back — the 0.385 CLS the Lighthouse
 * baseline flagged (and a sitewide flash-of-unstyled-content besides).
 *
 * `useServerInsertedHTML` runs after the server render pass has accumulated
 * every rendered component's styles and streams them into the document head
 * — the App-Router-sanctioned CSS-in-JS extraction hook. On the client it
 * renders nothing (RNW's runtime sheet takes over; the ids match so RNW
 * dedupes against the server-inserted tag).
 */
export function RNWServerStyles({ children }: { children: React.ReactNode }): React.ReactNode {
  // The hook fires once per stream flush; RNW's atomic styles register at
  // module import, so the first flush already carries the full sheet — send
  // it once instead of duplicating ~12 KB per chunk. (A hypothetical
  // late-streamed component adding NEW classes would cover the gap at
  // hydration; no Suspense-streamed RNW subtrees exist today.)
  const sent = useRef(false)
  useServerInsertedHTML(() => {
    if (sent.current) return null
    sent.current = true
    // getSheet is react-native-web's SSR extraction API — absent from RN's
    // types (the webpack alias resolves 'react-native' to RNW at runtime).
    const sheet = (
      StyleSheet as unknown as { getSheet(): { id: string; textContent: string } }
    ).getSheet()
    // biome-ignore lint/security/noDangerouslySetInnerHtml: RNW-generated atomic CSS, no user input.
    return <style id={sheet.id} dangerouslySetInnerHTML={{ __html: sheet.textContent }} />
  })
  return children
}
