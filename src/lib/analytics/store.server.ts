// Server-only dataset store: loads the bundled IBM Telco CSV, runs the pipeline + model once per dataset and caches it.
import bundledCsv from '@/data/telco-customer-churn.csv?raw'
import type { Prepared } from './analysis'
import { buildModel } from './model'
import { DatasetError, runPipeline } from './pipeline'

export const DEFAULT_NAME = 'IBM Telco Customer Churn (WA_Fn-UseC_-Telco-Customer-Churn.csv)'
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const CACHE_LIMIT = 6

const cache = new Map<string, Prepared>()
const pending = new Map<string, Promise<Prepared>>()

export function hashText(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16) + '-' + text.length.toString(16)
}

export function prepare(csv: string, name: string, kind: 'bundled' | 'upload', hash: string): Prepared {
  const data = runPipeline(csv, name, kind)
  const model = buildModel(data.customers, data.thresholds)
  data.customers.forEach((c, i) => {
    c.riskScore = model.risk[i].score
    c.riskCategory = model.risk[i].category
  })
  const riskById = new Map(data.customers.map((c, i) => [c.id, model.risk[i]]))
  return { ...data, model, riskById, hash }
}

async function getOrCreate(hash: string, build: () => Prepared): Promise<Prepared> {
  const hit = cache.get(hash)
  if (hit) return hit
  const inflight = pending.get(hash)
  if (inflight) return inflight
  const promise = Promise.resolve()
    .then(build)
    .then((p) => {
      cache.set(hash, p)
      if (cache.size > CACHE_LIMIT) {
        const oldest = [...cache.keys()].find((k) => k !== 'default')
        if (oldest) cache.delete(oldest)
      }
      return p
    })
    .finally(() => pending.delete(hash))
  pending.set(hash, promise)
  return promise
}

export function getDefaultDataset(): Promise<Prepared> {
  return getOrCreate('default', () => prepare(bundledCsv, DEFAULT_NAME, 'bundled', 'default'))
}

export function getUploadedDataset(csv: string, name: string): Promise<Prepared> {
  if (!csv || typeof csv !== 'string') throw new DatasetError('No CSV content was provided.')
  if (csv.length > MAX_UPLOAD_BYTES) throw new DatasetError('The file exceeds the 8 MB upload limit.')
  const hash = hashText(csv)
  return getOrCreate(hash, () => prepare(csv, name || 'Uploaded dataset', 'upload', hash))
}

export function resolveDataset(body: { csv?: unknown; name?: unknown } | null): Promise<Prepared> {
  if (body && typeof body.csv === 'string' && body.csv.length)
    return getUploadedDataset(body.csv, typeof body.name === 'string' ? body.name : 'Uploaded dataset')
  return getDefaultDataset()
}

export { DatasetError }
