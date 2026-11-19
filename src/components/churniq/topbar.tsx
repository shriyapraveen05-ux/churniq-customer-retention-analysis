
import { useState } from 'react'
import { Filter, Menu, RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/churniq/ui/sheet'
import { useAnalysis, useAnalyticsContext } from '@/components/providers/analytics-provider'
import { Logo, NavList, Profile } from './sidebar'
import { cn } from '@/lib/utils'
import type { Filters, SegmentKey } from '@/lib/analytics/types'

export const PERIODS = [
  { key: 'all', label: 'All tenures', min: 0, max: 9999 },
  { key: '12', label: 'Tenure ≤ 12 mo', min: 0, max: 12 },
  { key: '24', label: 'Tenure ≤ 24 mo', min: 0, max: 24 },
  { key: '36', label: 'Tenure ≤ 36 mo', min: 0, max: 36 },
  { key: '36+', label: 'Tenure > 36 mo', min: 37, max: 9999 },
]

const selectCls =
  'h-8 rounded-lg border border-border bg-card px-2.5 pr-7 text-xs text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50 appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat'
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238995AD' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} style={{ backgroundImage: chevron }}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterControls() {
  const { filters, setFilters, resetFilters } = useAnalyticsContext()
  const { data } = useAnalysis()
  const maxT = data?.options.maxTenure ?? 72
  const period =
    PERIODS.find((p) => p.min === filters.tenureMin && Math.min(p.max, maxT) === filters.tenureMax)?.key ?? 'custom'
  const dirty =
    filters.contract !== 'all' ||
    filters.internet !== 'all' ||
    filters.payment !== 'all' ||
    filters.addon !== 'all' ||
    filters.risk !== 'all' ||
    filters.segment !== 'all' ||
    filters.tenureMin !== 0 ||
    filters.tenureMax < maxT

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Tenure window"
        value={period}
        onChange={(v) => {
          const p = PERIODS.find((x) => x.key === v)
          if (p) setFilters({ tenureMin: p.min, tenureMax: Math.min(p.max, maxT) })
        }}
        options={[
          ...PERIODS.map((p) => ({ value: p.key, label: p.label })),
          ...(period === 'custom' ? [{ value: 'custom', label: 'Custom tenure range' }] : []),
        ]}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tenure range (mo)</legend>
        <div className="flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2 text-xs">
          <input
            type="number"
            aria-label="Minimum tenure in months"
            min={0}
            max={filters.tenureMax}
            value={filters.tenureMin}
            onChange={(e) => setFilters({ tenureMin: Math.max(0, Math.min(Number(e.target.value) || 0, filters.tenureMax)) })}
            className="w-10 bg-transparent text-center tabular outline-none"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            aria-label="Maximum tenure in months"
            min={filters.tenureMin}
            max={maxT}
            value={Math.min(filters.tenureMax, maxT)}
            onChange={(e) => setFilters({ tenureMax: Math.max(filters.tenureMin, Math.min(Number(e.target.value) || 0, maxT)) })}
            className="w-10 bg-transparent text-center tabular outline-none"
          />
        </div>
      </fieldset>
      <Select
        label="Segment"
        value={filters.segment}
        onChange={(v) => setFilters({ segment: v as SegmentKey | 'all' })}
        options={[{ value: 'all', label: 'All segments' }, ...(data?.segmentDefs ?? []).map((s) => ({ value: s.key, label: s.name }))]}
      />
      <Select
        label="Contract"
        value={filters.contract}
        onChange={(v) => setFilters({ contract: v })}
        options={[{ value: 'all', label: 'All contracts' }, ...(data?.options.contracts ?? []).map((c) => ({ value: c, label: c }))]}
      />
      <Select
        label="Internet"
        value={filters.internet}
        onChange={(v) => setFilters({ internet: v })}
        options={[{ value: 'all', label: 'All internet types' }, ...(data?.options.internet ?? []).map((c) => ({ value: c, label: c }))]}
      />
      <Select
        label="Add-on service"
        value={filters.addon}
        onChange={(v) => setFilters({ addon: v as Filters['addon'] })}
        options={[{ value: 'all', label: 'Any services' }, ...(data?.options.addons ?? []).map((a) => ({ value: a.key, label: a.label }))]}
      />
      <Select
        label="Payment"
        value={filters.payment}
        onChange={(v) => setFilters({ payment: v })}
        options={[{ value: 'all', label: 'All payment methods' }, ...(data?.options.payments ?? []).map((c) => ({ value: c, label: c }))]}
      />
      <Select
        label="Risk"
        value={filters.risk}
        onChange={(v) => setFilters({ risk: v as Filters['risk'] })}
        options={[{ value: 'all', label: 'All risk levels' }, ...(data?.options.risks ?? []).map((c) => ({ value: c, label: `${c} risk` }))]}
      />
      <button
        type="button"
        onClick={resetFilters}
        disabled={!dirty}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCcw className="size-3.5" /> Reset
      </button>
    </div>
  )
}

export function Topbar() {
  const [navOpen, setNavOpen] = useState(false)
  const { data, isValidating } = useAnalysis()
  const updated = data ? new Date(data.report.processedAt) : null

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 md:px-8">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger
            render={<button type="button" className="flex size-9 items-center justify-center rounded-lg border border-border lg:hidden" />}
          >
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetHeader className="h-16 justify-center">
              <SheetTitle render={<div />}>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-3">
              <NavList onNavigate={() => setNavOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <Profile />
            </div>
          </SheetContent>
        </Sheet>
        <div className="lg:hidden">
          <Logo />
        </div>

        <div className="hidden flex-1 lg:block">
          <FilterControls />
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('size-1.5 rounded-full', isValidating ? 'animate-pulse bg-warning' : 'bg-positive')} aria-hidden />
          <span className="hidden sm:inline">{isValidating ? 'Recomputing…' : 'Last updated'}</span>
          {updated && !isValidating && (
            <time dateTime={updated.toISOString()} className="tabular">
              {updated.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time>
          )}
          <Sheet>
            <SheetTrigger
              render={
                <button type="button" className="ml-2 flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-foreground lg:hidden" />
              }
            >
              <Filter className="size-3.5" /> Filters
            </SheetTrigger>
            <SheetContent side="bottom" className="border-border bg-sidebar">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
