
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Analysis } from '@/lib/analytics/analysis'
import { DEFAULT_FILTERS, type Filters } from '@/lib/analytics/types'

export interface UploadedDataset {
  name: string
  csv: string
  size: number
}

interface Ctx {
  upload: UploadedDataset | null
  setUpload: (u: UploadedDataset | null) => void
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  resetFilters: () => void
}

const AnalyticsContext = createContext<Ctx | null>(null)

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [upload, setUploadState] = useState<UploadedDataset | null>(null)
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS)

  const setFilters = useCallback((f: Partial<Filters>) => setFiltersState((prev) => ({ ...prev, ...f })), [])
  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), [])
  const setUpload = useCallback((u: UploadedDataset | null) => {
    setUploadState(u)
    setFiltersState(DEFAULT_FILTERS)
  }, [])

  const value = useMemo(
    () => ({ upload, setUpload, filters, setFilters, resetFilters }),
    [upload, setUpload, filters, setFilters, resetFilters],
  )
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalyticsContext() {
  const ctx = useContext(AnalyticsContext)
  if (!ctx) throw new Error('useAnalyticsContext must be used inside AnalyticsProvider')
  return ctx
}

export interface ApiMeta {
  dataset: string
  sourceKind: 'bundled' | 'upload'
  records: number
  processedAt: string
  datasetHash: string
  riskMethod: string
}

/** Calls a CHURNIQ API endpoint and unwraps the { ok, data, meta } envelope. */
export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('The analytics service could not be reached. Check your connection and try again.')
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null
  if (!res.ok || !json || json.ok === false) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json.data as T
}

function datasetKey(upload: UploadedDataset | null) {
  return upload ? `${upload.name}:${upload.size}` : 'default'
}

export function useAnalysis(override?: Partial<Filters>) {
  const { upload, filters } = useAnalyticsContext()
  const effective = { ...filters, ...override }
  const q = useQuery({
    queryKey: ['analysis', datasetKey(upload), JSON.stringify(effective)],
    queryFn: () =>
      postJSON<Analysis>('/api/analysis', {
        filters: effective,
        ...(upload ? { csv: upload.csv, name: upload.name } : {}),
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  return {
    data: q.data,
    error: (q.error ?? undefined) as Error | undefined,
    isLoading: q.isPending,
    isValidating: q.isFetching,
    refetch: q.refetch,
  }
}

export interface CustomerQuery {
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  listRisk?: string
  status?: string
  listSegment?: string
}

export function useCustomers(query: CustomerQuery) {
  const { upload, filters } = useAnalyticsContext()
  const merged = { ...filters, ...query }
  const q = useQuery({
    queryKey: ['customers', datasetKey(upload), JSON.stringify(merged)],
    queryFn: () =>
      postJSON<CustomerPage>('/api/customers', { query: merged, ...(upload ? { csv: upload.csv, name: upload.name } : {}) }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  return { data: q.data, error: (q.error ?? undefined) as Error | undefined, isLoading: q.isPending, isValidating: q.isFetching }
}

export interface CustomerRow {
  id: string
  gender: string
  senior: boolean
  partner: boolean
  dependents: boolean
  tenure: number
  phoneService: boolean
  multipleLines: string
  internetService: string
  onlineSecurity: string
  onlineBackup: string
  deviceProtection: string
  techSupport: string
  streamingTV: string
  streamingMovies: string
  contract: string
  paperlessBilling: boolean
  paymentMethod: string
  monthlyCharges: number
  totalCharges: number
  churn: boolean
  tenureGroup: string
  protectiveAddons: number
  serviceCount: number
  riskScore?: number
  riskCategory?: 'High' | 'Medium' | 'Low'
  segments: string[]
  risk: {
    score: number
    category: 'High' | 'Medium' | 'Low'
    factors: { key: string; label: string; weight: number }[]
    action: string
  }
}

export interface CustomerPage {
  total: number
  page: number
  pages: number
  pageSize: number
  method: string
  rows: CustomerRow[]
}
