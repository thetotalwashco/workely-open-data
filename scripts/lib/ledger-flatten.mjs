// Turns data/ledger/data.json (a byte copy of https://www.workely.ai/research/lead-ledger/data.json)
// into flat CSV text, one file per published table. validate.mjs re-runs this and requires the
// committed CSVs to match, so a CSV can never drift from the JSON.

export const LEDGER_FILES = {
  t1_leads_by_channel_quarter: 't1_leads_by_channel_quarter.csv',
  t2_lead_to_quote_rate_by_channel: 't2_lead_to_quote_rate_by_channel.csv',
  t3_quote_outcomes: 't3_quote_outcomes.csv',
  t5_price_bands_by_service: 't5_price_bands_by_service.csv',
  t6_booked_rate_by_quote_total_band: 't6_booked_rate_by_quote_total_band.csv',
  t9_median_ticket_by_quarter: 't9_median_ticket_by_quarter.csv',
}

function esc(v) {
  if (v === undefined || v === null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(columns, rows) {
  const lines = [columns.join(',')]
  for (const r of rows) lines.push(columns.map((c) => esc(r[c])).join(','))
  return lines.join('\n') + '\n'
}

/** Returns { file: { columns, rows, csv } } for every published table. */
export function flattenLedger(data) {
  const out = {}
  for (const [key, file] of Object.entries(LEDGER_FILES)) {
    const t = data.tables[key]
    if (!t) throw new Error(`data.json is missing table ${key}`)
    let rows
    let columns
    if (key === 't1_leads_by_channel_quarter') {
      columns = ['quarter', 'row_n', 'channel', 'leads']
      rows = []
      for (const r of t.rows) {
        for (const [channel, leads] of Object.entries(r.cells)) {
          rows.push({ quarter: r.quarter, row_n: r.n, channel, leads })
        }
      }
    } else {
      columns = []
      for (const r of t.rows) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k)
      rows = t.rows
    }
    out[file] = { columns, rows, csv: toCsv(columns, rows) }
  }
  return out
}
