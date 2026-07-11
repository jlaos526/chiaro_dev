import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { CalibrateScreen } from '../../src/calibrate/CalibrateScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('CalibrateScreen', () => {
  it('renders default title, description, input, CTA, and Skip', () => {
    const { getByText, container } = render(
      <CalibrateScreen onSubmit={async () => {}} onSkip={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Set your home location')).toBeTruthy()
    expect(getByText(/elected officials representing/)).toBeTruthy()
    expect(container.querySelector('input')).not.toBeNull()
    expect(getByText('Calibrate')).toBeTruthy()
    expect(getByText('Skip for now')).toBeTruthy()
  })

  it('omits Skip link when onSkip is not provided', () => {
    const { queryByText } = render(<CalibrateScreen onSubmit={async () => {}} />, {
      wrapper: withMode('light'),
    })
    expect(queryByText('Skip for now')).toBeNull()
  })

  it('calls onSubmit with the typed address when CTA is pressed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { getByText, container } = render(<CalibrateScreen onSubmit={onSubmit} />, {
      wrapper: withMode('light'),
    })
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '123 Main St' } })
    await act(async () => {
      fireEvent.click(getByText('Calibrate'))
    })
    expect(onSubmit).toHaveBeenCalledWith('123 Main St')
  })

  it('shows error message when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Address lookup failed'))
    const { getByText, findByText } = render(<CalibrateScreen onSubmit={onSubmit} />, {
      wrapper: withMode('light'),
    })
    await act(async () => {
      fireEvent.click(getByText('Calibrate'))
    })
    expect(await findByText('Address lookup failed')).toBeTruthy()
  })

  it('disables CTA while loading and shows loadingLabel', async () => {
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveSubmit = res
        }),
    )
    const { getByText } = render(<CalibrateScreen onSubmit={onSubmit} />, {
      wrapper: withMode('light'),
    })
    fireEvent.click(getByText('Calibrate'))
    await waitFor(() => expect(getByText('Calibrating…')).toBeTruthy())
    await act(async () => {
      resolveSubmit()
    })
  })

  it('calls onSkip when Skip link is pressed', () => {
    const onSkip = vi.fn()
    const { getByText } = render(<CalibrateScreen onSubmit={async () => {}} onSkip={onSkip} />, {
      wrapper: withMode('light'),
    })
    fireEvent.click(getByText('Skip for now'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('omits GPS button when onGpsSubmit is not provided', () => {
    const { queryByText } = render(<CalibrateScreen onSubmit={async () => {}} />, {
      wrapper: withMode('light'),
    })
    expect(queryByText('Use my current location')).toBeNull()
  })

  it('renders GPS button when onGpsSubmit is provided', () => {
    const { getByText } = render(
      <CalibrateScreen onSubmit={async () => {}} onGpsSubmit={async () => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Use my current location')).toBeTruthy()
  })

  it('calls onGpsSubmit when GPS button is pressed', async () => {
    const onGpsSubmit = vi.fn().mockResolvedValue(undefined)
    const { getByText } = render(
      <CalibrateScreen onSubmit={async () => {}} onGpsSubmit={onGpsSubmit} />,
      { wrapper: withMode('light') },
    )
    await act(async () => {
      fireEvent.click(getByText('Use my current location'))
    })
    expect(onGpsSubmit).toHaveBeenCalled()
  })

  it('shows error message when onGpsSubmit throws', async () => {
    const onGpsSubmit = vi.fn().mockRejectedValue(new Error('Location access denied'))
    const { getByText, findByText } = render(
      <CalibrateScreen onSubmit={async () => {}} onGpsSubmit={onGpsSubmit} />,
      { wrapper: withMode('light') },
    )
    await act(async () => {
      fireEvent.click(getByText('Use my current location'))
    })
    expect(await findByText('Location access denied')).toBeTruthy()
  })
})
