import { Client } from 'pg'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  loadOpenStatesBillsDir,
  loadOpenStatesVotesDir,
  parseBillIdentifier,
  parseJurisdictionState,
  type OpenStatesBillEnvelope,
  type OpenStatesVoteEnvelope,
} from './openstates-bills-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_URL = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const DEFAULT_MIN_STATE_BILLS_COUNT = 500

export interface IngestStateBillsVotesOpts {
  fixturesDir?: string
  minStateBillsCount?: number
  skipBills?: boolean
  skipVotes?: boolean
  allowDeletions?: number
}

export interface IngestStateBillsVotesStats {
  billsUpserted: number
  sponsorsUpserted: number
  subjectsUpserted: number
  votesUpserted: number
  positionsUpserted: number
  unmatchedBills: string[]
  unmatchedVoters: string[]
  errors: string[]
}

export async function ingestStateBillsVotes(
  opts: IngestStateBillsVotesOpts = {},
): Promise<IngestStateBillsVotesStats> {
  const fixturesDir = opts.fixturesDir
    ?? process.env.OPENSTATES_BILLS_DATA_DIR
    ?? join(__dirname, 'fixtures', 'openstates-bills')
  const minBills = opts.minStateBillsCount ?? DEFAULT_MIN_STATE_BILLS_COUNT

  const bills = opts.skipBills ? [] : await loadOpenStatesBillsDir(fixturesDir)
  const votes = opts.skipVotes ? [] : await loadOpenStatesVotesDir(fixturesDir)

  if (!opts.skipBills && bills.length < minBills) {
    throw new Error(
      `pre-flight count below threshold: bills=${bills.length} (min ${minBills}). ` +
      `Aborting with zero DB writes.`,
    )
  }

  const stats: IngestStateBillsVotesStats = {
    billsUpserted: 0,
    sponsorsUpserted: 0,
    subjectsUpserted: 0,
    votesUpserted: 0,
    positionsUpserted: 0,
    unmatchedBills: [],
    unmatchedVoters: [],
    errors: [],
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    if (!opts.skipBills) {
      for (const b of bills) {
        await ingestBill(client, b, stats)
      }
    }
    if (!opts.skipVotes) {
      for (const v of votes) {
        await ingestVote(client, v, stats)
      }
    }
  } finally {
    await client.end()
  }
  return stats
}

async function ingestBill(
  client: Client,
  b: OpenStatesBillEnvelope,
  stats: IngestStateBillsVotesStats,
): Promise<void> {
  const state = parseJurisdictionState(b.jurisdiction.id)
  if (!state) {
    stats.errors.push(`bill ${b.id} has no parseable state in jurisdiction`)
    return
  }
  const billType = parseBillIdentifier(b.identifier)
  if (!billType) {
    stats.errors.push(`bill ${b.id} has unparseable identifier '${b.identifier}'`)
    return
  }
  const status = b.actions?.length ? b.actions[b.actions.length - 1]!.description : null
  const introducedAction = b.actions?.find(a => a.classification?.includes('introduction'))
  const introducedDate = introducedAction?.date ?? null
  const latestAction = b.actions?.length ? b.actions[b.actions.length - 1]!.description : null
  const latestActionDate = b.actions?.length ? b.actions[b.actions.length - 1]!.date : null

  const sourceUrl = b.sources[0]?.url ?? b.openstates_url

  const upsert = await client.query<{ id: string }>(`
    insert into public.state_bills (
      openstates_bill_id, state, session, bill_type, number, title, status,
      introduced_date, latest_action, latest_action_date, source_url, openstates_url
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    on conflict (openstates_bill_id) do update set
      title              = excluded.title,
      status             = excluded.status,
      latest_action      = excluded.latest_action,
      latest_action_date = excluded.latest_action_date,
      updated_at         = now()
    returning id
  `, [
    b.id, state, b.session, billType.bill_type, billType.number,
    b.title, status, introducedDate, latestAction, latestActionDate,
    sourceUrl, b.openstates_url,
  ])
  const billId = upsert.rows[0]!.id
  stats.billsUpserted += 1

  if (b.sponsorships?.length) {
    await client.query('delete from public.state_bill_sponsors where bill_id = $1', [billId])
    for (const sp of b.sponsorships) {
      if (!sp.person_id) continue
      const off = await client.query<{ id: string }>(
        'select id from public.officials where openstates_person_id = $1',
        [sp.person_id],
      )
      if (off.rowCount === 0) continue
      const role = sp.classification === 'primary' ? 'sponsor' : 'cosponsor'
      await client.query(
        'insert into public.state_bill_sponsors (bill_id, official_id, role) values ($1, $2, $3) on conflict do nothing',
        [billId, off.rows[0]!.id, role],
      )
      stats.sponsorsUpserted += 1
    }
  }

  if (b.subject?.length) {
    await client.query('delete from public.state_bill_subjects where bill_id = $1', [billId])
    for (const subject of b.subject) {
      await client.query(
        'insert into public.state_bill_subjects (bill_id, subject) values ($1, $2) on conflict do nothing',
        [billId, subject],
      )
      stats.subjectsUpserted += 1
    }
  }
}

async function ingestVote(
  client: Client,
  v: OpenStatesVoteEnvelope,
  stats: IngestStateBillsVotesStats,
): Promise<void> {
  const billRow = await client.query<{ id: string; state: string; session: string }>(
    'select id, state, session from public.state_bills where openstates_bill_id = $1',
    [v.bill_id],
  )
  if (billRow.rowCount === 0) {
    stats.unmatchedBills.push(v.bill_id)
    return
  }
  const { id: billId, state, session } = billRow.rows[0]!

  const chamber =
    v.organization.classification === 'lower'        ? 'state_house' :
    v.organization.classification === 'upper'        ? 'state_senate' :
    v.organization.classification === 'legislature' ? 'state_legislature' :
                                                      null
  if (!chamber) {
    stats.errors.push(`vote ${v.id} has unknown organization.classification '${v.organization.classification}'`)
    return
  }

  const voteUpsert = await client.query<{ id: string }>(`
    insert into public.state_votes (
      openstates_vote_id, bill_id, state, session, chamber,
      vote_date, question, result, source_url
    )
    values ($1, $2, $3, $4, $5::public.official_chamber, $6, $7, $8, $9)
    on conflict (openstates_vote_id) do update set
      question = excluded.question,
      result   = excluded.result
    returning id
  `, [
    v.id, billId, state, session, chamber,
    v.start_date, v.motion_text, v.result, v.sources[0]?.url ?? '',
  ])
  const voteId = voteUpsert.rows[0]!.id
  stats.votesUpserted += 1

  await client.query('delete from public.state_vote_positions where vote_id = $1', [voteId])
  for (const vp of v.votes) {
    if (!vp.voter_id) {
      stats.unmatchedVoters.push(vp.voter_name)
      continue
    }
    const off = await client.query<{ id: string }>(
      'select id from public.officials where openstates_person_id = $1',
      [vp.voter_id],
    )
    if (off.rowCount === 0) {
      stats.unmatchedVoters.push(vp.voter_id)
      continue
    }
    const position = normalizeVoteOption(vp.option)
    if (!position) continue
    await client.query(
      'insert into public.state_vote_positions (vote_id, official_id, position) values ($1, $2, $3) on conflict do nothing',
      [voteId, off.rows[0]!.id, position],
    )
    stats.positionsUpserted += 1
  }
}

function normalizeVoteOption(raw: string): 'yes' | 'no' | 'abstain' | 'not_voting' | 'present' | null {
  const v = raw.toLowerCase().trim()
  if (v === 'yes' || v === 'aye' || v === 'y') return 'yes'
  if (v === 'no' || v === 'nay' || v === 'n') return 'no'
  if (v === 'abstain') return 'abstain'
  if (v === 'not voting' || v === 'absent' || v === 'not_voting') return 'not_voting'
  if (v === 'present') return 'present'
  return null
}

if (import.meta.url === `file://${process.argv[1]!.replace(/\\/g, '/')}`) {
  const skipBills = process.argv.includes('--skip-bills')
  const skipVotes = process.argv.includes('--skip-votes')
  const allowDeletionsArg = process.argv.find(a => a.startsWith('--allow-deletions='))
  const allowDeletions = allowDeletionsArg ? Number(allowDeletionsArg.split('=')[1]) : undefined
  ingestStateBillsVotes({ skipBills, skipVotes, allowDeletions })
    .then(stats => {
      console.log('Ingest summary (state bills + votes):')
      console.log(`  bills upserted:    ${stats.billsUpserted}`)
      console.log(`  sponsors upserted: ${stats.sponsorsUpserted}`)
      console.log(`  subjects upserted: ${stats.subjectsUpserted}`)
      console.log(`  votes upserted:    ${stats.votesUpserted}`)
      console.log(`  positions upsert:  ${stats.positionsUpserted}`)
      console.log(`  unmatched bills:   ${stats.unmatchedBills.length}`)
      console.log(`  unmatched voters:  ${stats.unmatchedVoters.length}`)
      console.log(`  errors:            ${stats.errors.length}`)
      process.exit(stats.errors.length > 0 ? 1 : 0)
    })
    .catch(err => { console.error(err.message); process.exit(1) })
}
