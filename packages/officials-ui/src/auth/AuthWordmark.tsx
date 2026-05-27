'use client'

import { Logo } from '../Logo.tsx'

export interface AuthWordmarkProps {
  /** `sm` for desktop page-chrome; `md` for mobile in-card. Default `md`. */
  size?: 'sm' | 'md'
}

/**
 * Auth-screen wordmark lockup. Thin wrapper over `<Logo variant="lockup" />`
 * preserved for back-compat with slice-31 callers (AuthScreen, AuthPageChrome).
 *
 *   sm  → Logo size=20  (web page-chrome)
 *   md  → Logo size=32  (mobile in-card)
 */
export function AuthWordmark({ size = 'md' }: AuthWordmarkProps): React.JSX.Element {
  const logoSize = size === 'md' ? 32 : 20
  return <Logo variant="lockup" size={logoSize} />
}
