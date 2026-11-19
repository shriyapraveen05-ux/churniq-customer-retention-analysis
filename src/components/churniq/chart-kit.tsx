
import type { TooltipContentProps } from 'recharts'

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: '#8995AD', fontSize: 11 },
} as const

export const tooltipCursor = { fill: 'rgba(71,125,255,0.06)' }

type Fmt = (v: number, name: string) => string

export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: Partial<TooltipContentProps<number, string>> & { format?: Fmt; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-lg border border-border bg-tooltip px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && label !== '' && (
        <p className="mb-1.5 font-medium text-foreground">{labelFormat ? labelFormat(String(label)) : String(label)}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: (p.color as string) ?? (p.payload?.fill as string) }} />
              {p.name}
            </span>
            <span className="font-medium tabular text-foreground">
              {format ? format(Number(p.value), String(p.name)) : String(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
