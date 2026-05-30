import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PillChevron } from '../../src/cards/PillChevron.tsx'

describe('PillChevron', () => {
  it('renders ▸ when open=false', () => {
    const { getByText } = render(<PillChevron open={false} />)
    expect(getByText('▸')).toBeTruthy()
  })

  it('renders ▾ when open=true', () => {
    const { getByText } = render(<PillChevron open={true} />)
    expect(getByText('▾')).toBeTruthy()
  })

  it('accepts size="sm" variant', () => {
    const { getByText } = render(<PillChevron open={false} size="sm" />)
    expect(getByText('▸')).toBeTruthy()
  })

  it('bg uses semantic.bg.subtle in light mode (slice 46)', () => {
    const { container } = render(<PillChevron open={false} />)
    const view = container.firstElementChild as HTMLElement | null
    expect(view).not.toBeNull()
    const style = view?.getAttribute('style') ?? ''
    // RNW normalizes #f7efe2 (semantic.bg.subtle light) to rgb(247, 239, 226).
    expect(style).toMatch(/background-color:\s*rgb\(247,\s*239,\s*226\)/)
  })
})
