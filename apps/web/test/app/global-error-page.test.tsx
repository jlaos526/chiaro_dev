// Slice 80 (S70 follow-up): root-layout error boundary — must report to
// Sentry (app/error.tsx can't catch layout render errors) and offer reset.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

import GlobalError from '@/app/global-error'

describe('app/global-error.tsx', () => {
  it('captures the error to Sentry on mount and calls reset() on Try again', () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('layout boom'), { digest: 'x1' })
    // global-error renders its own <html>/<body>; jsdom logs a DOM-nesting
    // warning for that, which is expected — assert behavior, not markup.
    const { getByText } = render(<GlobalError error={error} reset={reset} />)
    expect(captureException).toHaveBeenCalledWith(error)
    fireEvent.click(getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })
})
