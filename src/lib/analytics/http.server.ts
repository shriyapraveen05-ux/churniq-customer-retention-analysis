// Server-only HTTP layer shared by every /api/* analytics endpoint.
// Requests: GET with filters in the query string (bundled dataset), or POST JSON
// { csv?, name?, filters?, query? } to analyse an uploaded CSV. Responses use one envelope:
//   { ok: true, data, meta } | { ok: false, error }
import { buildAnalysis, type Analysis, type Prepared } from './analysis'
import { SEGMENTS, applyFilters, parseFilters, segmentsOf } from './segments'
import { DatasetError, MAX_UPLOAD_BYTES, resolveDataset } from './store.server'
import type { Customer, Filters, RiskInfo } from './types'

export type Section =
  | 'analysis'
  | 'overview'
  | 'dataset-info'
  | 'churn-analysis'
  | 'customer-behaviour'
  | 'segments'
  | 'retention-factors'
  | 'customer-risk'
  | 'cohort-analysis'
  | 'revenue-impact'
  | 'recommendations'
  | 'model-performance'
  | 'customers'

interface Parsed {
  body: { csv?: unknown; name?: unknown } | null
  query: Record<string, unknown>
}

class BadRequest extends Error {}

async function parseRequest(request: Request): Promise<Parsed> {
  const url = new URL(request.url)
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams)
  if (request.method === 'GET') return { body: null, query: params }
  const len = Number(request.headers.get('content-length') ?? 0)
  if (len > MAX_UPLOAD_BYTES * 1.2) throw new DatasetError('The request exceeds the 8 MB upload limit.')
  let json: Record<string, unknown>
  try {
    json = (await request.json()) as Record<string, unknown>
  } catch {
    throw new BadRequest('Invalid request body — expected JSON.')
  }
  if (!json || typeof json !== 'object') throw new BadRequest('Invalid request body — expected a JSON object.')
  const filters = (json.filters as Record<string, unknown>) ?? {}
  const query = (json.query as Record<string, unknown>) ?? {}
  return { body: { csv: json.csv, name: json.name }, query: { ...params, ...filters, ...query } }
}

function meta(p: Prepared, filters?: Filters) {
  return {
    dataset: p.report.sourceName,
    sourceKind: p.report.sourceKind,
    records: p.customers.length,
    processedAt: p.report.processedAt,
    datasetHash: p.hash,
    riskMethod: p.model.evaluation.method,
    ...(filters ? { filters } : {}),
  }
}

export function ok(data: unknown, m: Record<string, unknown>) {
  return Response.json({ ok: true, data, meta: m }, { headers: { 'Cache-Control': 'no-store' } })
}

export function fail(error: string, status: number) {
  return Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

const SORTERS: Record<string, (c: Customer, r: RiskInfo) => number | string> = {
  id: (c) => c.id,
  tenure: (c) => c.tenure,
  monthlyCharges: (c) => c.monthlyCharges,
  totalCharges: (c) => c.totalCharges,
  contract: (c) => c.contract,
  paymentMethod: (c) => c.paymentMethod,
  riskScore: (_, r) => r.score,
}

export function customerPage(p: Prepared, filters: Filters, q: Record<string, unknown>) {
  let list = applyFilters(p.customers, filters, p.thresholds)

  const status = String(q.status ?? 'all')
  if (status === 'active') list = list.filter((c) => !c.churn)
  else if (status === 'churned') list = list.filter((c) => c.churn)

  const listRisk = String(q.listRisk ?? 'all')
  if (listRisk !== 'all') list = list.filter((c) => p.riskById.get(c.id)?.category === listRisk)

  const listSegment = String(q.listSegment ?? 'all')
  const seg = SEGMENTS.find((s) => s.key === listSegment)
  if (seg) list = list.filter((c) => seg.test(c, p.thresholds))

  const search = String(q.q ?? '').trim().toLowerCase()
  if (search)
    list = list.filter(
      (c) =>
        c.id.toLowerCase().includes(search) ||
        c.contract.toLowerCase().includes(search) ||
        c.paymentMethod.toLowerCase().includes(search) ||
        c.internetService.toLowerCase().includes(search),
    )

  const sortKey = SORTERS[String(q.sort ?? 'riskScore')] ? String(q.sort ?? 'riskScore') : 'riskScore'
  const dir = q.dir === 'asc' ? 1 : -1
  const sorter = SORTERS[sortKey]
  const rows = list
    .map((c) => ({ c, r: p.riskById.get(c.id)! }))
    .sort((a, b) => {
      const va = sorter(a.c, a.r)
      const vb = sorter(b.c, b.r)
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })

  const pageSize = Math.min(100, Math.max(5, Number(q.pageSize ?? q.page_size) || 15))
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1))
  const slice = rows.slice((page - 1) * pageSize, page * pageSize)

  return {
    total,
    page,
    pages,
    pageSize,
    method: p.model.evaluation.method,
    rows: slice.map(({ c, r }) => ({
      ...c,
      risk: r,
      segments: segmentsOf(c, p.thresholds).map((k) => SEGMENTS.find((s) => s.key === k)!.name),
    })),
  }
}

function pick(a: Analysis, section: Section, p: Prepared, filters: Filters, q: Record<string, unknown>): unknown {
  switch (section) {
    case 'analysis':
      return a
    case 'overview':
      return {
        filters: a.filters,
        population: a.population,
        portfolioSize: a.portfolioSize,
        kpis: a.kpis,
        comparison: a.comparison,
        insights: a.insights,
        lifecycleQuarterly: a.lifecycleQuarterly,
        riskCounts: a.risk.counts,
        revenue: { activeMRR: a.revenue.activeMRR, lostMRR: a.revenue.lostMRR, revenueAtRisk: a.revenue.highRiskMRR },
        validation: a.validation,
      }
    case 'dataset-info':
      return a.report
    case 'churn-analysis':
      return {
        kpis: a.kpis,
        breakdowns: a.breakdowns,
        services: a.services,
        lifecycle: a.lifecycle,
        lifecycleQuarterly: a.lifecycleQuarterly,
      }
    case 'customer-behaviour':
      return a.behaviour
    case 'segments':
      return { definitions: a.segmentDefs, segments: a.segments }
    case 'retention-factors':
      return {
        note: 'These are statistical associations measured in a single snapshot; they do not prove that an attribute causes churn.',
        correlation: a.correlation,
        numericTests: a.numericTests,
        categoricalTests: a.categoricalTests,
        featureImportance: a.model.importance,
      }
    case 'customer-risk':
      return {
        method: a.risk.method,
        thresholds: a.risk.thresholds,
        summary: a.risk,
        customers: customerPage(p, filters, q),
      }
    case 'cohort-analysis':
      return a.cohorts
    case 'revenue-impact':
      return a.revenue
    case 'recommendations':
      return { insights: a.insights, recommendations: a.recommendations }
    case 'model-performance':
      return a.model
    case 'customers':
      return customerPage(p, filters, q)
  }
}

export async function handleSection(request: Request, section: Section): Promise<Response> {
  try {
    const { body, query } = await parseRequest(request)
    const p = await resolveDataset(body)
    const filters = parseFilters(query)
    if (section === 'customers') return ok(customerPage(p, filters, query), meta(p, filters))
    const a = buildAnalysis(p, filters)
    return ok(pick(a, section, p, filters, query), meta(p, filters))
  } catch (err) {
    if (err instanceof DatasetError || err instanceof BadRequest) return fail(err.message, 400)
    console.error(`[churniq] ${section} failed`, err)
    return fail('The analysis could not be completed.', 500)
  }
}

/** POST /api/upload-dataset — accepts multipart (field "file"), text/csv, or JSON { csv, name }. */
export async function handleUpload(request: Request): Promise<Response> {
  try {
    const type = request.headers.get('content-type') ?? ''
    let csv = ''
    let name = 'Uploaded dataset'
    if (type.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') throw new DatasetError('Attach the CSV in a form field named “file”.')
      if (file.size > MAX_UPLOAD_BYTES) throw new DatasetError('The file exceeds the 8 MB upload limit.')
      csv = await file.text()
      name = file.name || name
    } else if (type.includes('application/json')) {
      const json = (await request.json().catch(() => null)) as { csv?: unknown; name?: unknown } | null
      if (!json || typeof json.csv !== 'string') throw new DatasetError('Send JSON in the form { "csv": "...", "name": "file.csv" }.')
      csv = json.csv
      if (typeof json.name === 'string') name = json.name
    } else {
      csv = await request.text()
    }
    if (!csv.trim()) throw new DatasetError('The uploaded file is empty.')
    const p = await resolveDataset({ csv, name })
    return ok(
      {
        accepted: true,
        report: p.report,
        model: { method: p.model.evaluation.method, reason: p.model.evaluation.reason ?? null },
      },
      meta(p),
    )
  } catch (err) {
    if (err instanceof DatasetError) return fail(err.message, 400)
    console.error('[churniq] upload failed', err)
    return fail('The dataset could not be processed.', 500)
  }
}
