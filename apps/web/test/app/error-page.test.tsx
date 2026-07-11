// Slice 70 (audit U2-web rider): global route error boundary.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import RouteError from '@/app/error'

describe('app/error.tsx', () => {
  it('renders the branded alert with the error digest', () => {
    const { getByText } = render(
      <RouteError
        error={Object.assign(new Error('boom'), { digest: 'abc123' })}
        reset={() => {}}
      />,
    )
    getByText('This page hit an unexpected error')
    getByText(/ref abc123/)
  })

  it('omits the digest line when absent and calls reset() on Try again', () => {
    const reset = vi.fn()
    const { getByText, queryByText } = render(
      <RouteError error={new Error('boom')} reset={reset} />,
    )
    expect(queryByText(/ref /)).toBeNull()
    fireEvent.click(getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })
})
