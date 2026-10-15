// Validates the whole repo. Exit 0 = clean, 1 = at least one failure. Only dependency: ajv.
//   - every CSV matches datapackage.json (header, types, constraints)
//   - every example validates against schema/pricing-rule.schema.json (and bad ones fail)
//   - Price Index rows: aggregates only, n_businesses >= 30 on every row
//   - no column or value looks like a business name, domain, URL, email, phone or street address
//   - ledger CSVs equal what data/ledger/data.json produces; data.json carries the CC BY 4.0 notice
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { flattenLedger } from './lib/ledger-flatten.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const json = (p) => JSON.parse(read(p))
const errors = []
const fail = (m) => errors.push(m)

const FLOOR = 30

// ---- CSV parsing (RFC 4180 subset) ----
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

// ---- identity guards ----
const BAD_COLUMN = /(^|_)(name|business|company|domain|url|website|site|email|e_?mail|phone|tel|telephone|mobile|address|street|zip|postcode|postal|city|town|page|link|host|source_hash|hash)($|_)/i
const ALLOWED_COLUMN_EXACT = new Set(['cell', 'trade', 'country', 'currency', 'unit'])
const BAD_VALUE = [
  ['url', /\b(https?:\/\/|www\.)\S+/i],
  ['email', /[^\s@,]+@[^\s@,]+\.[a-z]{2,}/i],
  ['domain', /\b[a-z0-9][a-z0-9-]*\.(com|net|org|co|uk|io|ai|us|biz|info|app|dev|ca|au|nz|ie|de|fr|me|site|online|llc)\b/i],
  ['phone', /(\+?\d[\s.()-]*){10,}/],
  ['street address', /\b\d{1,6}\s+(?:[A-Za-z0-9.]+\s+){0,3}(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|hwy|highway)\b\.?/i],
]

function guardIdentity(file, header, rows) {
  for (const h of header) {
    if (!ALLOWED_COLUMN_EXACT.has(h) && BAD_COLUMN.test(h)) fail(`${file}: column "${h}" looks like it could hold identifying data`)
  }
  rows.forEach((r, i) => {
    r.forEach((v, j) => {
      for (const [label, re] of BAD_VALUE) {
        if (re.test(v)) fail(`${file} row ${i + 2} column "${header[j]}": value looks like a ${label}: ${JSON.stringify(v)}`)
      }
    })
  })
}

// ---- datapackage ----
const dp = json('datapackage.json')
const ajv = new Ajv2020({ allErrors: true, strict: false })

function checkType(type, v) {
  if (v === '') return true // empty = not published for this row
  switch (type) {
    case 'string': return true
    case 'any': return true
    case 'integer': return /^-?\d+$/.test(v)
    case 'number': return /^-?\d+(\.\d+)?$/.test(v) && Number.isFinite(Number(v))
    default: return false
  }
}

const csvPaths = new Set()
for (const res of dp.resources) {
  csvPaths.add(res.path)
  if (!existsSync(join(root, res.path))) { fail(`datapackage resource ${res.name}: missing file ${res.path}`); continue }
  const rows = parseCsv(read(res.path))
  const header = rows[0] ?? []
  const names = res.schema.fields.map((f) => f.name)
  if (JSON.stringify(header) !== JSON.stringify(names)) {
    fail(`${res.path}: header [${header.join(',')}] does not match datapackage fields [${names.join(',')}]`)
    continue
  }
  const body = rows.slice(1)
  body.forEach((r, i) => {
    if (r.length !== header.length) { fail(`${res.path} row ${i + 2}: ${r.length} cells, expected ${header.length}`); return }
    res.schema.fields.forEach((f, j) => {
      const v = r[j]
      if (f.constraints?.required && v === '') fail(`${res.path} row ${i + 2}: ${f.name} is required`)
      if (!checkType(f.type, v)) fail(`${res.path} row ${i + 2}: ${f.name}=${JSON.stringify(v)} is not ${f.type}`)
      if (v !== '' && (f.type === 'number' || f.type === 'integer')) {
        const n = Number(v)
        if (v !== '' && f.constraints?.minimum !== undefined && n < f.constraints.minimum) fail(`${res.path} row ${i + 2}: ${f.name}=${v} is below minimum ${f.constraints.minimum}`)
        if (v !== '' && f.constraints?.maximum !== undefined && n > f.constraints.maximum) fail(`${res.path} row ${i + 2}: ${f.name}=${v} is above maximum ${f.constraints.maximum}`)
      }
    })
  })
  guardIdentity(res.path, header, body)

  // Price Index: the 30-business floor, on every row, no exceptions.
  if (res.path.startsWith('data/price-index/')) {
    const k = header.indexOf('n_businesses')
    if (k < 0) fail(`${res.path}: price index files must have an n_businesses column`)
    else body.forEach((r, i) => {
      const n = Number(r[k])
      if (!Number.isInteger(n) || n < FLOOR) fail(`${res.path} row ${i + 2}: n_businesses=${r[k]} is below the floor of ${FLOOR}`)
    })
  }
}

// every CSV in data/ must be described
function walk(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
}
for (const f of walk('data').filter((f) => f.endsWith('.csv'))) {
  if (!csvPaths.has(f)) fail(`${f}: not described in datapackage.json`)
}

// ---- ledger: CSVs equal data.json; data.json is the copy of the site file ----
const ledger = json('data/ledger/data.json')
if (ledger.license !== 'CC BY 4.0' || ledger.license_url !== 'https://creativecommons.org/licenses/by/4.0/') fail('data/ledger/data.json: missing the CC BY 4.0 notice')
if (ledger.residential_only !== true) fail('data/ledger/data.json: residential_only must be true')
if (/commercial/i.test(Object.keys(ledger.tables).join(' '))) fail('data/ledger/data.json: a commercial table is present; commercial pricing stays private')
for (const [file, t] of Object.entries(flattenLedger(ledger))) {
  const p = `data/ledger/${file}`
  if (!existsSync(join(root, p))) { fail(`${p}: missing`); continue }
  if (read(p) !== t.csv) fail(`${p}: differs from what data/ledger/data.json produces; run node scripts/build-ledger-csv.mjs`)
}

// ---- schema + examples ----
const schema = json('schema/pricing-rule.schema.json')
let validate
try { validate = ajv.compile(schema) } catch (e) { fail(`schema does not compile: ${e.message}`) }
if (validate) {
  const exDir = join(root, 'examples')
  const files = readdirSync(exDir).filter((f) => f.endsWith('.json'))
  if (files.length < 3) fail('expected at least 3 examples')
  for (const f of files) {
    const doc = json(`examples/${f}`)
    if (!validate(doc)) fail(`examples/${f}: ${ajv.errorsText(validate.errors)}`)
    if (!/example/i.test(doc.description ?? '')) fail(`examples/${f}: description must label the numbers as an example`)
  }
  // negative controls: the schema must actually reject bad rules
  const good = json('examples/gutter-cleaning.json')
  const bad = [
    ['multiplier without factor', { ...good, rules: [{ name: 'x', effect: 'multiplier', priority: 1 }] }],
    ['per_unit without input_key', { ...good, rules: [{ name: 'x', effect: 'per_unit', amount_cents: 5, priority: 1 }] }],
    ['unknown effect', { ...good, rules: [{ name: 'x', effect: 'discount', priority: 1 }] }],
    ['fractional cents', { ...good, rules: [{ name: 'x', effect: 'flat_add', amount_cents: 1.5, priority: 1 }] }],
  ]
  for (const [label, doc] of bad) if (validate(doc)) fail(`schema wrongly accepted: ${label}`)
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`)
  for (const e of errors) console.error(' - ' + e)
  process.exit(1)
}
console.log(`validate: ok (${dp.resources.length} CSVs, ${walk('examples').length} examples, floor ${FLOOR})`)
