
import { Link } from '@tanstack/react-router'
import { AlertTriangle, SearchX } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { useAnalysis, useAnalyticsContext } from '@/components/providers/analytics-provider'
import { Card, Skeleton } from './primitives'

export function AnalysisGate({ children }: { children: (a: Analysis) => React.ReactNode }) {
  const { data, error, isLoading } = useAnalysis()
  const { resetFilters, upload, setUpload } = useAnalyticsContext()

  if (error && !data) {
    return (
      <Card className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle className="size-8 text-warning" />
        <h2 className="text-base font-semibold">Analysis could not be computed</h2>
        <p className="text-sm text-muted-foreground text-pretty">{error.message}</p>
        {upload && (
          <button
            type="button"
            onClick={() => setUpload(null)}
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Revert to bundled IBM Telco dataset
          </button>
        )}
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading analysis">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (data.empty) {
    return (
      <Card className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 p-8 text-center">
        <SearchX className="size-8 text-muted-foreground" />
        <h2 className="text-base font-semibold">No customers match these filters</h2>
        <p className="text-sm text-muted-foreground">Widen the tenure range or clear the segment, contract and service filters.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Reset filters
          </button>
          <Link to="/data" className="rounded-lg border border-border px-3 py-1.5 text-xs">
            View data overview
          </Link>
        </div>
      </Card>
    )
  }

  return <>{children(data)}</>
}

export function FilterSummary({ a }: { a: Analysis }) {
  const parts: string[] = []
  const f = a.filters
  if (f.tenureMin > 0 || f.tenureMax < a.options.maxTenure) parts.push(`tenure ${f.tenureMin}–${f.tenureMax} mo`)
  if (f.contract !== 'all') parts.push(f.contract)
  if (f.internet !== 'all') parts.push(`${f.internet} internet`)
  if (f.payment !== 'all') parts.push(f.payment)
  if (f.addon !== 'all') parts.push(a.options.addons.find((x) => x.key === f.addon)?.label ?? f.addon)
  if (f.risk !== 'all') parts.push(`${f.risk} risk`)
  if (f.segment !== 'all') parts.push(a.segmentDefs.find((s) => s.key === f.segment)?.name ?? f.segment)
  return (
    <p className="text-xs text-muted-foreground">
      {a.population.toLocaleString()} of {a.portfolioSize.toLocaleString()} customers
      {parts.length ? ` · ${parts.join(' · ')}` : ' · no filters applied'}
    </p>
  )
}
