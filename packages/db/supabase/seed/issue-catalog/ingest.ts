import { ISSUE_CATALOG, type TopicSeed } from './catalog-data.ts'

// Minimal structural client surface this ingester needs. Defined locally
// instead of importing `ChiaroClient` from `@chiaro/supabase-client` —
// `@chiaro/supabase-client` depends on `@chiaro/db`, so importing it here
// would create a circular workspace dependency (CLAUDE.md Gotcha #4).
// The CLI passes a real Supabase service client (structurally compatible);
// tests pass a mock with the same `from(table).upsert(rows)` shape.
export interface IssueCatalogUpsertClient {
  from(table: string): {
    upsert(rows: unknown[]): Promise<{ error: { message: string } | null }>
  }
}

export async function ingestIssueCatalog(
  client: IssueCatalogUpsertClient,
  catalog: TopicSeed[] = ISSUE_CATALOG,
): Promise<void> {
  const topicRows = catalog.map((t) => ({
    slug: t.slug, display_name: t.display_name, description: t.description,
    value_tags: t.value_tags, display_order: t.display_order, active: true }))
  const { error: te } = await client.from('issue_topics').upsert(topicRows)
  if (te) throw new Error(`issue_topics upsert: ${te.message}`)
  const lensRows = catalog.flatMap((t) => t.lenses.map((l) => ({
    topic_slug: t.slug, slug: l.slug, label: l.label, lens_type: l.lens_type,
    description: l.description ?? null, measurement_sources: l.measurement_sources,
    evidence_sources: l.evidence_sources, quiz_questions: l.quiz_questions,
    display_order: l.display_order, active: l.active ?? true })))
  const { error: le } = await client.from('issue_lenses').upsert(lensRows)
  if (le) throw new Error(`issue_lenses upsert: ${le.message}`)
}
