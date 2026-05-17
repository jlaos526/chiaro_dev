import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

describe('SubCascadeBar', () => {
  it('renders sub-name + teaser', () => {
    render(
      <SubCascadeBar
        categoryId="issue-positions"
        subId="environment"
        name="Environment"
        teaser="LCV Strongly Aligned · Sierra Club Strongly Aligned"
        open={false}
        onToggle={() => {}}
      />
    )
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('LCV Strongly Aligned · Sierra Club Strongly Aligned')).toBeTruthy()
  })

  it('chevron is plain ▸ (no pill) when closed', () => {
    const { container } = render(
      <SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(screen.getByText('▸')).toBeTruthy()
    expect(container.querySelector('[style*="background: rgb(240, 238, 229)"]')).toBeNull()
  })

  it('renders anchor id="subcat-<categoryId>-<subId>"', () => {
    const { container } = render(
      <SubCascadeBar categoryId="finance" subId="top-industries" name="Top Industries" teaser="x" open={false} onToggle={() => {}} />
    )
    expect(container.querySelector('#subcat-finance-top-industries')).toBeTruthy()
  })

  it('default accent uses SUB_CASCADE_ACCENT[categoryId]', () => {
    const { container } = render(
      <SubCascadeBar categoryId="issue-positions" subId="environment" name="Environment" teaser="x" open={false} onToggle={() => {}} />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(135, 170, 224)')
  })

  it('accept accentOverride to support Finance sub-section shades', () => {
    const { container } = render(
      <SubCascadeBar
        categoryId="finance"
        subId="pacs"
        name="PACs"
        teaser="x"
        open={false}
        onToggle={() => {}}
        accentOverride="#a8d2b1"
      />
    )
    const el = container.querySelector('button')!
    expect(el.style.borderLeftColor).toContain('rgb(168, 210, 177)')
  })

  it('placeholder variant renders soft beige + italic teaser, not clickable', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <SubCascadeBar
        categoryId="finance"
        subId="individual-donors"
        name="Individual Donors"
        teaser="data coming slice 5+"
        open={false}
        onToggle={onToggle}
        placeholder={true}
      />
    )
    const el = container.querySelector('button')! as HTMLButtonElement
    expect(el.disabled).toBe(true)
    expect(el.style.background).toContain('rgb(246, 244, 237)')
    fireEvent.click(el)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('calls onToggle when clicked (non-placeholder)', () => {
    const onToggle = vi.fn()
    render(
      <SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByText('PACs').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
