import { mean, quantile, sortedCopy, std } from './stats'
import type {
  CategoricalSummary,
  ColumnProfile,
  Customer,
  DataReport,
  NumericSummary,
  PipelineStep,
  Thresholds,
} from './types'

export class DatasetError extends Error {}

export function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

type Field = keyof Omit<
  Customer,
  'tenureGroup' | 'chargeBand' | 'totalBand' | 'protectiveAddons' | 'serviceCount'
>

const SCHEMA: { field: Field; header: string; required: boolean; kind: 'id' | 'cat' | 'bool' | 'num' }[] = [
  { field: 'id', header: 'customerID', required: true, kind: 'id' },
  { field: 'gender', header: 'gender', required: false, kind: 'cat' },
  { field: 'senior', header: 'SeniorCitizen', required: false, kind: 'bool' },
  { field: 'partner', header: 'Partner', required: false, kind: 'bool' },
  { field: 'dependents', header: 'Dependents', required: false, kind: 'bool' },
  { field: 'tenure', header: 'tenure', required: true, kind: 'num' },
  { field: 'phoneService', header: 'PhoneService', required: false, kind: 'bool' },
  { field: 'multipleLines', header: 'MultipleLines', required: false, kind: 'cat' },
  { field: 'internetService', header: 'InternetService', required: false, kind: 'cat' },
  { field: 'onlineSecurity', header: 'OnlineSecurity', required: false, kind: 'cat' },
  { field: 'onlineBackup', header: 'OnlineBackup', required: false, kind: 'cat' },
  { field: 'deviceProtection', header: 'DeviceProtection', required: false, kind: 'cat' },
  { field: 'techSupport', header: 'TechSupport', required: false, kind: 'cat' },
  { field: 'streamingTV', header: 'StreamingTV', required: false, kind: 'cat' },
  { field: 'streamingMovies', header: 'StreamingMovies', required: false, kind: 'cat' },
  { field: 'contract', header: 'Contract', required: true, kind: 'cat' },
  { field: 'paperlessBilling', header: 'PaperlessBilling', required: false, kind: 'bool' },
  { field: 'paymentMethod', header: 'PaymentMethod', required: false, kind: 'cat' },
  { field: 'monthlyCharges', header: 'MonthlyCharges', required: true, kind: 'num' },
  { field: 'totalCharges', header: 'TotalCharges', required: false, kind: 'num' },
  { field: 'churn', header: 'Churn', required: true, kind: 'bool' },
]

const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '?'])
const isMissing = (v: string | undefined) => v === undefined || MISSING_TOKENS.has(v.trim().toLowerCase())
const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

function toBool(v: string): boolean | null {
  const s = v.trim().toLowerCase()
  if (['yes', 'y', '1', 'true', 't'].includes(s)) return true
  if (['no', 'n', '0', 'false', 'f'].includes(s)) return false
  return null
}

function toNum(v: string): number | null {
  if (isMissing(v)) return null
  const n = Number(v.trim().replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

function inferRawType(values: string[]): string {
  const present = values.filter((v) => !isMissing(v))
  if (!present.length) return 'empty'
  const numeric = present.every((v) => toNum(v) !== null)
  const ints = numeric && present.every((v) => Number.isInteger(Number(v)))
  const blanks = values.length - present.length
  if (numeric) return blanks ? (ints ? 'int (with blanks)' : 'float (with blanks)') : ints ? 'int64' : 'float64'
  return 'object'
}

export const TENURE_GROUPS = ['0–6 mo', '7–12 mo', '13–24 mo', '25–36 mo', '37–48 mo', '49–60 mo', '61–72 mo']
export function tenureGroup(t: number): string {
  if (t <= 6) return TENURE_GROUPS[0]
  if (t <= 12) return TENURE_GROUPS[1]
  if (t <= 24) return TENURE_GROUPS[2]
  if (t <= 36) return TENURE_GROUPS[3]
  if (t <= 48) return TENURE_GROUPS[4]
  if (t <= 60) return TENURE_GROUPS[5]
  return TENURE_GROUPS[6]
}

export const CHARGE_BANDS = ['< $35', '$35–55', '$55–75', '$75–95', '≥ $95']
function chargeBand(m: number): string {
  if (m < 35) return CHARGE_BANDS[0]
  if (m < 55) return CHARGE_BANDS[1]
  if (m < 75) return CHARGE_BANDS[2]
  if (m < 95) return CHARGE_BANDS[3]
  return CHARGE_BANDS[4]
}

export const TOTAL_BANDS = ['< $500', '$500–2k', '$2k–4k', '$4k–6k', '≥ $6k']
function totalBand(t: number): string {
  if (t < 500) return TOTAL_BANDS[0]
  if (t < 2000) return TOTAL_BANDS[1]
  if (t < 4000) return TOTAL_BANDS[2]
  if (t < 6000) return TOTAL_BANDS[3]
  return TOTAL_BANDS[4]
}

export interface PreparedData {
  customers: Customer[]
  report: DataReport
  thresholds: Thresholds
}

export function runPipeline(csv: string, sourceName: string, sourceKind: 'bundled' | 'upload'): PreparedData {
  const rows = parseCSV(csv)
  if (rows.length < 2) throw new DatasetError('The file contains no data rows.')
  const header = rows[0].map((h) => h.trim())
  const body = rows.slice(1)
  const steps: PipelineStep[] = []
  const warnings: string[] = []

  steps.push({
    title: 'Load dataset',
    detail: `Parsed ${body.length.toLocaleString()} records and ${header.length} attributes from "${sourceName}".`,
    affected: body.length,
  })

  const colIndex = new Map<Field, number>()
  const normalizedHeader = header.map(normalize)
  for (const spec of SCHEMA) {
    const idx = normalizedHeader.indexOf(normalize(spec.header))
    if (idx >= 0) colIndex.set(spec.field, idx)
    else if (spec.required)
      throw new DatasetError(
        `Required column "${spec.header}" was not found. Required columns: ${SCHEMA.filter((s) => s.required)
          .map((s) => s.header)
          .join(', ')}.`,
      )
    else warnings.push(`Optional column "${spec.header}" is missing; values are set to "Unknown"/No.`)
  }

  const ragged = body.filter((r) => r.length !== header.length).length
  if (ragged) warnings.push(`${ragged} rows had an unexpected number of fields; missing cells treated as blank.`)

  // Column profiling on raw data
  const columns: ColumnProfile[] = header.map((name, ci) => {
    const values = body.map((r) => r[ci] ?? '')
    const missing = values.filter(isMissing).length
    const unique = new Set(values).size
    const spec = SCHEMA.find((s) => normalize(s.header) === normalize(name))
    const cleanedType = spec
      ? spec.kind === 'num'
        ? spec.field === 'tenure'
          ? 'int'
          : 'float'
        : spec.kind === 'bool'
          ? 'bool'
          : spec.kind === 'id'
            ? 'string (id)'
            : 'category'
      : 'dropped (unused)'
    return {
      name,
      rawType: inferRawType(values),
      cleanedType,
      missing,
      unique,
      example: values.find((v) => !isMissing(v)) ?? '',
    }
  })
  const missingByColumn = columns
    .filter((c) => c.missing > 0)
    .map((c) => ({ column: c.name, count: c.missing, treatment: '' }))
  const missingTotal = missingByColumn.reduce((s, c) => s + c.count, 0)
  steps.push({
    title: 'Inspect data quality',
    detail: missingTotal
      ? `Found ${missingTotal} missing cell(s) across ${missingByColumn.length} column(s).`
      : 'No missing cells detected.',
    affected: missingTotal,
  })

  // Trim + duplicate detection
  const seenRows = new Set<string>()
  const seenIds = new Set<string>()
  let duplicateRows = 0
  let duplicateIds = 0
  const unique: string[][] = []
  for (const raw of body) {
    const r = header.map((_, i) => (raw[i] ?? '').trim())
    const key = r.join('\u0001')
    if (seenRows.has(key)) {
      duplicateRows++
      continue
    }
    seenRows.add(key)
    const id = r[colIndex.get('id')!]
    if (seenIds.has(id)) {
      duplicateIds++
      continue
    }
    seenIds.add(id)
    unique.push(r)
  }
  steps.push({
    title: 'Remove duplicates',
    detail:
      duplicateRows + duplicateIds
        ? `Removed ${duplicateRows} exact duplicate row(s) and ${duplicateIds} repeated customer ID(s) (first occurrence kept).`
        : 'No duplicate rows or customer IDs found.',
    affected: duplicateRows + duplicateIds,
  })

  // Type conversion & cleaning
  let invalid = 0
  let imputedZero = 0
  let imputedCalc = 0
  let unknownFilled = 0
  const customers: Customer[] = []
  const get = (r: string[], f: Field) => {
    const i = colIndex.get(f)
    return i === undefined ? undefined : r[i]
  }
  const cat = (r: string[], f: Field) => {
    const v = get(r, f)
    if (isMissing(v)) {
      if (colIndex.has(f)) unknownFilled++
      return 'Unknown'
    }
    return v!
  }
  const bool = (r: string[], f: Field) => {
    const v = get(r, f)
    if (isMissing(v)) return false
    return toBool(v!) ?? false
  }

  for (const r of unique) {
    const tenure = toNum(get(r, 'tenure') ?? '')
    const monthly = toNum(get(r, 'monthlyCharges') ?? '')
    const churnRaw = get(r, 'churn')
    const churn = isMissing(churnRaw) ? null : toBool(churnRaw!)
    if (tenure === null || monthly === null || churn === null || tenure < 0 || monthly < 0) {
      invalid++
      continue
    }
    let total = toNum(get(r, 'totalCharges') ?? '')
    if (total === null) {
      if (tenure === 0) {
        total = 0
        imputedZero++
      } else {
        total = Math.round(monthly * tenure * 100) / 100
        imputedCalc++
      }
    }
    const c: Customer = {
      id: get(r, 'id')!,
      gender: cat(r, 'gender'),
      senior: bool(r, 'senior'),
      partner: bool(r, 'partner'),
      dependents: bool(r, 'dependents'),
      tenure: Math.round(tenure),
      phoneService: bool(r, 'phoneService'),
      multipleLines: cat(r, 'multipleLines'),
      internetService: cat(r, 'internetService'),
      onlineSecurity: cat(r, 'onlineSecurity'),
      onlineBackup: cat(r, 'onlineBackup'),
      deviceProtection: cat(r, 'deviceProtection'),
      techSupport: cat(r, 'techSupport'),
      streamingTV: cat(r, 'streamingTV'),
      streamingMovies: cat(r, 'streamingMovies'),
      contract: cat(r, 'contract'),
      paperlessBilling: bool(r, 'paperlessBilling'),
      paymentMethod: cat(r, 'paymentMethod'),
      monthlyCharges: monthly,
      totalCharges: total,
      churn,
      tenureGroup: '',
      chargeBand: '',
      totalBand: '',
      protectiveAddons: 0,
      serviceCount: 0,
    }
    c.tenureGroup = tenureGroup(c.tenure)
    c.chargeBand = chargeBand(c.monthlyCharges)
    c.totalBand = totalBand(c.totalCharges)
    c.protectiveAddons = [c.onlineSecurity, c.onlineBackup, c.deviceProtection, c.techSupport].filter(
      (v) => v === 'Yes',
    ).length
    c.serviceCount =
      (c.phoneService ? 1 : 0) +
      (c.internetService !== 'No' && c.internetService !== 'Unknown' ? 1 : 0) +
      c.protectiveAddons +
      [c.streamingTV, c.streamingMovies, c.multipleLines].filter((v) => v === 'Yes').length
    customers.push(c)
  }

  if (customers.length < 20) throw new DatasetError('Fewer than 20 valid customer records remain after cleaning.')

  const totalMissingCol = missingByColumn.find((m) => normalize(m.column) === 'totalcharges')
  if (totalMissingCol)
    totalMissingCol.treatment = `${imputedZero} with tenure 0 set to $0 (not yet billed)${
      imputedCalc ? `; ${imputedCalc} imputed as monthly × tenure` : ''
    }`
  for (const m of missingByColumn) {
    if (m.treatment) continue
    const spec = SCHEMA.find((s) => normalize(s.header) === normalize(m.column))
    m.treatment = !spec
      ? 'Column not used in analysis'
      : spec.required
        ? 'Record dropped (required field)'
        : spec.kind === 'bool'
          ? 'Filled with "No"'
          : 'Filled with "Unknown"'
  }

  steps.push({
    title: 'Convert data types',
    detail:
      'TotalCharges cast from text to float; SeniorCitizen (0/1) and Yes/No flags cast to boolean; tenure cast to integer; service attributes stored as categories.',
    affected: customers.length,
  })
  steps.push({
    title: 'Treat missing values',
    detail: `TotalCharges: ${imputedZero} blank value(s) for customers with tenure 0 set to $0${
      imputedCalc ? `, ${imputedCalc} imputed as MonthlyCharges × tenure` : ''
    }. ${unknownFilled} blank categorical value(s) filled with "Unknown". ${invalid} record(s) with invalid tenure, charges or churn label dropped.`,
    affected: imputedZero + imputedCalc + unknownFilled + invalid,
  })
  steps.push({
    title: 'Prepare churn label',
    detail: 'Churn mapped Yes → 1 (churned within the observation month) and No → 0 (retained).',
    affected: customers.length,
  })
  steps.push({
    title: 'Engineer features',
    detail:
      'Derived tenure groups, monthly and total charge bands, count of protective add-ons (security, backup, device protection, tech support) and total subscribed services.',
    affected: customers.length,
  })

  const monthlySorted = sortedCopy(customers.map((c) => c.monthlyCharges))
  const thresholds: Thresholds = {
    monthlyMedian: quantile(monthlySorted, 0.5),
    monthlyP75: quantile(monthlySorted, 0.75),
    maxTenure: Math.max(...customers.map((c) => c.tenure)),
  }

  const numericSummary: NumericSummary[] = (
    [
      ['tenure', (c: Customer) => c.tenure],
      ['MonthlyCharges', (c: Customer) => c.monthlyCharges],
      ['TotalCharges', (c: Customer) => c.totalCharges],
    ] as const
  ).map(([column, f]) => {
    const vals = customers.map(f)
    const s = sortedCopy(vals)
    return {
      column,
      count: vals.length,
      mean: mean(vals),
      std: std(vals),
      min: s[0],
      q1: quantile(s, 0.25),
      median: quantile(s, 0.5),
      q3: quantile(s, 0.75),
      max: s[s.length - 1],
    }
  })

  const catCols: [string, (c: Customer) => string][] = [
    ['gender', (c) => c.gender],
    ['SeniorCitizen', (c) => (c.senior ? 'Yes' : 'No')],
    ['Partner', (c) => (c.partner ? 'Yes' : 'No')],
    ['Dependents', (c) => (c.dependents ? 'Yes' : 'No')],
    ['PhoneService', (c) => (c.phoneService ? 'Yes' : 'No')],
    ['MultipleLines', (c) => c.multipleLines],
    ['InternetService', (c) => c.internetService],
    ['OnlineSecurity', (c) => c.onlineSecurity],
    ['OnlineBackup', (c) => c.onlineBackup],
    ['DeviceProtection', (c) => c.deviceProtection],
    ['TechSupport', (c) => c.techSupport],
    ['StreamingTV', (c) => c.streamingTV],
    ['StreamingMovies', (c) => c.streamingMovies],
    ['Contract', (c) => c.contract],
    ['PaperlessBilling', (c) => (c.paperlessBilling ? 'Yes' : 'No')],
    ['PaymentMethod', (c) => c.paymentMethod],
    ['Churn', (c) => (c.churn ? 'Yes' : 'No')],
  ]
  const categoricalSummary: CategoricalSummary[] = catCols.map(([column, f]) => {
    const counts = new Map<string, number>()
    for (const c of customers) counts.set(f(c), (counts.get(f(c)) ?? 0) + 1)
    const values = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
    return { column, unique: values.length, top: values[0].value, freq: values[0].count, values }
  })

  const churned = customers.filter((c) => c.churn).length
  const report: DataReport = {
    sourceName,
    sourceKind,
    processedAt: new Date().toISOString(),
    rawRecords: body.length,
    rawAttributes: header.length,
    finalRecords: customers.length,
    missingTotal,
    missingByColumn,
    duplicateRows,
    duplicateIds,
    invalidRecords: invalid,
    columns,
    steps,
    warnings,
    numericSummary,
    categoricalSummary,
    preview: body.slice(0, 8).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))),
    churnDistribution: [
      { label: 'Retained', count: customers.length - churned, share: (customers.length - churned) / customers.length },
      { label: 'Churned', count: churned, share: churned / customers.length },
    ],
  }

  return { customers, report, thresholds }
}
