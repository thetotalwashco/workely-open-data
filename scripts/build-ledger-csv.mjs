// Rebuilds data/ledger/*.csv from data/ledger/data.json. Run: node scripts/build-ledger-csv.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { flattenLedger } from './lib/ledger-flatten.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'data/ledger/data.json'), 'utf8'))
for (const [file, t] of Object.entries(flattenLedger(data))) {
  writeFileSync(join(root, 'data/ledger', file), t.csv)
  console.log(`wrote data/ledger/${file} (${t.rows.length} rows)`)
}
