
import { useDeferredValue, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { useCustomers, type CustomerRow } from '@/components/providers/analytics-provider'
import { Badge, Card, RiskBadge } from './primitives'
import { cn } from '@/lib/utils'
import { pct, usd } from '@/lib/format'

type Col = { key: string; label: string; sortable?: boolean; className?: string; render: (r: CustomerRow) => React.ReactNode }

export function CustomerTable({
  title,
  description,
  columns,
  status = 'all',
  defaultSort = 'riskScore',
  toolbar,
  risk,
  listSegment,
  onSelect,
}: {
  title: string
  description?: string
  columns: Col[]
  status?: 'all' | 'active' | 'churned'
  defaultSort?: string
  toolbar?: React.ReactNode
  risk?: string
  listSegment?: string
  onSelect?: (r: CustomerRow) => void
}) {
  const [q, setQ] = useState('')
  const deferredQ = useDeferredValue(q)
  const [sort, setSort] = useState(defaultSort)
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const { data, error, isLoading, isValidating } = useCustomers({ q: deferredQ, sort, dir, page, pageSize: 12, status, listRisk: risk, listSegment })

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(key)
      setDir('desc')
    }
    setPage(1)
  }

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <label className="relative">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search ID, contract, payment…"
              className="h-8 w-56 rounded-lg border border-border bg-background/60 pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
        </div>
      </div>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-2.5 font-medium', c.className)}>
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.label}
                      {sort === c.key && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(isValidating && 'opacity-60 transition-opacity')}>
            {isLoading && !data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td colSpan={columns.length} className="px-4 py-3">
                    <div className="h-4 animate-pulse rounded bg-muted/60" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-negative">
                  {error.message}
                </td>
              </tr>
            ) : data?.rows.length ? (
              data.rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={onSelect ? () => onSelect(r) : undefined}
                  onKeyDown={onSelect ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(r)) : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  className={cn(
                    'border-b border-border/50 last:border-0 transition-colors',
                    onSelect && 'cursor-pointer hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-2.5', c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  No customers match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 tabular">
          {isValidating && <Loader2 className="size-3 animate-spin" />}
          {data ? `${data.total.toLocaleString()} customers · page ${data.page} of ${data.pages}` : '—'}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!data || data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={!data || data.page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

export const commonColumns: Record<string, Col> = {
  id: { key: 'id', label: 'Customer ID', sortable: true, render: (r) => <span className="font-mono text-[11px]">{r.id}</span> },
  contract: { key: 'contract', label: 'Contract', sortable: true, render: (r) => r.contract },
  tenure: { key: 'tenure', label: 'Tenure', sortable: true, className: 'text-right', render: (r) => <span className="tabular">{r.tenure} mo</span> },
  monthly: {
    key: 'monthlyCharges',
    label: 'Monthly',
    sortable: true,
    className: 'text-right',
    render: (r) => <span className="tabular">{usd(r.monthlyCharges, 2)}</span>,
  },
  total: {
    key: 'totalCharges',
    label: 'Total billed',
    sortable: true,
    className: 'text-right',
    render: (r) => <span className="tabular">{usd(r.totalCharges)}</span>,
  },
  payment: { key: 'paymentMethod', label: 'Payment', sortable: true, render: (r) => <span className="whitespace-nowrap">{r.paymentMethod}</span> },
  status: {
    key: 'status',
    label: 'Status',
    render: (r) => <Badge tone={r.churn ? 'coral' : 'teal'}>{r.churn ? 'Churned' : 'Active'}</Badge>,
  },
  score: {
    key: 'riskScore',
    label: 'Risk score',
    sortable: true,
    className: 'text-right',
    render: (r) => <span className="font-medium tabular">{pct(r.risk.score, 0)}</span>,
  },
  category: { key: 'category', label: 'Risk', render: (r) => <RiskBadge category={r.risk.category} /> },
  segments: {
    key: 'segments',
    label: 'Segments',
    render: (r) => (
      <div className="flex max-w-64 flex-wrap gap-1">
        {r.segments.slice(0, 3).map((s) => (
          <Badge key={s} tone="violet">
            {s.replace(' Customers', '')}
          </Badge>
        ))}
      </div>
    ),
  },
}
