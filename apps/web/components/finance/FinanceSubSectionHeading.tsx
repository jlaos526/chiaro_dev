export interface FinanceSubSectionHeadingProps {
  label: string
  textColor: string
  ruleColor: string
}

export function FinanceSubSectionHeading({ label, textColor, ruleColor }: FinanceSubSectionHeadingProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 6px' }}>
      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: textColor }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: ruleColor }} />
    </div>
  )
}
