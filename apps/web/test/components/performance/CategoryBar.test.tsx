import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CategoryBar } from '@/components/performance/CategoryBar'

describe('CategoryBar', () => {
  it('renders category name + teaser line', () => {
    render(
      <CategoryBar
        categoryId="finance"
        teaser="$5.2M raised · top industry: Securities & Investment"
        open={false}
        onToggle={() => {}}
      />
    )
    expect(screen.getByText('Finance')).toBeTruthy()
    expect(screen.getByText('$5.2M raised · top industry: Securities & Investment')).toBeTruthy()
  })

  it('shows pill chevron ▸ when closed', () => {
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })

  it('shows pill chevron ▾ when open', () => {
    render(<CategoryBar categoryId="finance" teaser="x" open={true} onToggle={() => {}} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })

  it('left accent border uses CATEGORY_ACCENT[id]', () => {
    const { container } = render(
      <CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(61, 167, 91)')
    expect(el.style.borderLeftWidth).toBe('2px')
  })

  it('renders anchor id="category-<id>"', () => {
    const { container } = render(
      <CategoryBar categoryId="finance" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(container.querySelector('#category-finance')).toBeTruthy()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('Finance').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('renders teaser placeholder when null ("no data yet")', () => {
    render(<CategoryBar categoryId="finance" teaser={null} open={false} onToggle={() => {}} />)
    expect(screen.getByText('no data yet')).toBeTruthy()
  })
})
