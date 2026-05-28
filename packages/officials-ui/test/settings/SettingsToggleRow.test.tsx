import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsToggleRow } from '../../src/settings/SettingsToggleRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsToggleRow', () => {
  it('renders label and switch element', () => {
    const { getByText, container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Push notifications')).toBeTruthy()
    expect(container.querySelector('[role="switch"]')).not.toBeNull()
  })

  it('calls onChange with the next value when toggled', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={onChange} />,
      { wrapper: withMode('light') },
    )
    const sw = container.querySelector('[role="switch"]') as HTMLElement
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled blocks onChange', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SettingsToggleRow label="Push notifications" value={false} onChange={onChange} disabled />,
      { wrapper: withMode('light') },
    )
    const sw = container.querySelector('[role="switch"]') as HTMLElement
    fireEvent.click(sw)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders description below label when provided', () => {
    const { getByText } = render(
      <SettingsToggleRow
        label="Push notifications"
        description="Send alerts when bills you follow get scheduled"
        value={false}
        onChange={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Send alerts when bills you follow get scheduled')).toBeTruthy()
  })
})
