import Link from 'next/link'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <nav aria-label="Settings">
        <Link href="/">← Home</Link>
        <h1>Settings</h1>
      </nav>
      {children}
    </main>
  )
}
