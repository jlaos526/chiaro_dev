import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCardShell } from '@/components/cards/MetricCardShell'

describe('MetricCardShell', () => {
  it('renders value above label, label has category-color dot', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        caption="Speaker"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/product/pdf/R/R44648"
      />
    )
    const value = screen.getByText('$223,500')
    const label = screen.getByText('Base Salary')
    expect(value.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
  })

  it('exposes the right CTA for internal drill-down', () => {
    const onExpand = vi.fn()
    render(
      <MetricCardShell
        value="50%"
        label="Attendance"
        categoryId="voting-bills"
        onExpand={onExpand}
      />
    )
    expect(screen.getByText('view evidence →')).toBeTruthy()
  })

  it('exposes the right CTA for external source link', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/example"
      />
    )
    expect(screen.getByText('view source →')).toBeTruthy()
  })

  it('placeholder variant renders soft beige + italic muted text', () => {
    render(
      <MetricCardShell
        value="—"
        label="Individual Donors"
        caption="data coming slice 5+"
        categoryId="finance"
        placeholder={true}
      />
    )
    const card = screen.getByText('—').closest('article')
    expect(card?.getAttribute('style')).toContain('background: rgb(246, 244, 237)')
  })

  it('renders the category-color dot tied to categoryId', () => {
    const { container } = render(
      <MetricCardShell
        value="$5.2M"
        label="Total Raised"
        categoryId="finance"
        externalSourceUrl="https://www.opensecrets.org"
      />
    )
    const dot = container.querySelector('[data-testid="category-dot"]') as HTMLElement
    expect(dot.style.background).toContain('rgb(61, 167, 91)')
  })
})
