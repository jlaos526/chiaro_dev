// DEPRECATED: legacy slice-4 API back-compat shim. Removed in Task 36 when
// the consuming slice-4 components (ScorecardCard / FinanceCard / etc.) are
// deleted in favor of the new category-driven components.
import type { ReactNode } from 'react'
import { MetricCardShell as NewShell } from '@/components/cards/MetricCardShell'

interface LegacyBase {
  title: string
  value: ReactNode
  caption?: ReactNode
}

type LegacyDrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }

export type MetricCardShellProps = LegacyBase & LegacyDrillDown

/** @deprecated Use `@/components/cards/MetricCardShell` instead. */
export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const labelStr = typeof props.title === 'string' ? props.title : ''
  // Default to 'service-record' for legacy callers (the slice-4 components don't
  // know about categoryId yet). All consumers are deleted in Task 36, so this is
  // a transitional default — never lands in production.
  if ('onExpand' in props && typeof props.onExpand === 'function') {
    return <NewShell value={props.value} label={labelStr} caption={props.caption} categoryId="service-record" onExpand={props.onExpand} />
  }
  return <NewShell value={props.value} label={labelStr} caption={props.caption} categoryId="service-record" externalSourceUrl={props.externalSourceUrl} />

}
