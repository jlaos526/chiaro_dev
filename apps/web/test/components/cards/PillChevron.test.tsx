import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PillChevron } from '@/components/cards/PillChevron'

describe('PillChevron', () => {
  it('renders ▸ when open=false', () => {
    render(<PillChevron open={false} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('renders ▾ when open=true', () => {
    render(<PillChevron open={true} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
  it('applies the small variant when size="sm"', () => {
    const { container } = render(<PillChevron open={false} size="sm" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('18px')
    expect(el.style.height).toBe('18px')
  })
  it('defaults to 20×20 (md)', () => {
    const { container } = render(<PillChevron open={false} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('20px')
    expect(el.style.height).toBe('20px')
  })
})
