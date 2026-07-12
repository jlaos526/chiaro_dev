'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Slice 80 (S70 follow-up): root-layout render errors bypass app/error.tsx —
 * without this file they never reach Sentry (the SDK warned on every build).
 * global-error REPLACES the root layout, so it must render its own
 * <html>/<body> and cannot use providers/brand hooks — plain inline styles
 * on brand-neutral hexes are the sanctioned exception to the no-inline-hex
 * rule here (documented; the brand token system is unavailable this far up).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.JSX.Element {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: '#efece5',
          color: '#1f1b16',
        }}
      >
        <div style={{ maxWidth: 400, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
            An unexpected error broke this page. It has been reported.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#374f68',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
