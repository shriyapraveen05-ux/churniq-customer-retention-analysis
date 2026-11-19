// Exports the TypeScript analysis of the bundled dataset (no filters) so the Python twin can check parity.
// Run: bun scripts/export-ts-reference.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { buildAnalysis, type Prepared } from '../src/lib/analytics/analysis'
import { buildModel } from '../src/lib/analytics/model'
import { runPipeline } from '../src/lib/analytics/pipeline'
import { DEFAULT_FILTERS } from '../src/lib/analytics/types'

const csv = readFileSync(new URL('../src/data/telco-customer-churn.csv', import.meta.url), 'utf8')
const data = runPipeline(csv, 'IBM Telco Customer Churn', 'bundled')
const model = buildModel(data.customers, data.thresholds)
data.customers.forEach((c, i) => {
  c.riskScore = model.risk[i].score
  c.riskCategory = model.risk[i].category
})
const p: Prepared = { ...data, model, riskById: new Map(data.customers.map((c, i) => [c.id, model.risk[i]])), hash: 'default' }
const a = buildAnalysis(p, { ...DEFAULT_FILTERS, tenureMax: 1000 })
const out = new URL('../python/tests/fixtures/ts_reference.json', import.meta.url)
writeFileSync(out, JSON.stringify(a))
console.log('wrote', out.pathname, a.kpis)
