import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const COLORS = {
  blue: '#477DFF',
  violet: '#9270FF',
  teal: '#35C6A0',
  amber: '#F5B94C',
  coral: '#F06C79',
  muted: '#8995AD',
  grid: 'rgba(137,149,173,0.12)',
  card: '#141E32',
}

export const RISK_COLORS = { High: COLORS.coral, Medium: COLORS.amber, Low: COLORS.teal } as const

export function Card({ className, children, ...rest }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('card-surface rounded-xl border border-border', className)} {...rest}>
      {children}
    </section>
  )
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  footer,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
}) {
  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground text-balance">{title}</h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && <div className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{footer}</div>}
    </Card>
  )
}

type Tone = 'blue' | 'violet' | 'teal' | 'amber' | 'coral'
const toneText: Record<Tone, string> = {
  blue: 'text-primary',
  violet: 'text-violet',
  teal: 'text-positive',
  amber: 'text-warning',
  coral: 'text-negative',
}
const toneBg: Record<Tone, string> = {
  blue: 'bg-primary/12',
  violet: 'bg-violet/12',
  teal: 'bg-positive/12',
  amber: 'bg-warning/12',
  coral: 'bg-negative/12',
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  delta,
  deltaGoodWhen = 'up',
  sub,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
  delta?: { value: number; label: string } | null
  deltaGoodWhen?: 'up' | 'down'
  sub?: string
}) {
  const dir = delta ? (Math.abs(delta.value) < 0.0005 ? 0 : delta.value > 0 ? 1 : -1) : 0
  const good = dir === 0 ? null : (dir > 0) === (deltaGoodWhen === 'up')
  return (
    <Card className="group p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', toneBg[tone])}>
          <Icon className={cn('size-4', toneText[tone])} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <div className="mt-2 flex min-h-5 items-center gap-1.5 text-xs">
        {delta ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular',
                good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-positive/12 text-positive' : 'bg-negative/12 text-negative',
              )}
            >
              {dir > 0 ? <ArrowUpRight className="size-3" /> : dir < 0 ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
              {delta.value > 0 ? '+' : ''}
              {(delta.value * 100).toFixed(1)}%
            </span>
            <span className="truncate text-muted-foreground">{delta.label}</span>
          </>
        ) : (
          <span className="truncate text-muted-foreground">{sub}</span>
        )}
      </div>
    </Card>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'blue' | 'violet' | 'teal' | 'amber' | 'coral'
  children: React.ReactNode
  className?: string
}) {
  const map = {
    neutral: 'bg-muted text-muted-foreground border-border',
    blue: 'bg-primary/12 text-primary border-primary/25',
    violet: 'bg-violet/12 text-violet border-violet/25',
    teal: 'bg-positive/12 text-positive border-positive/25',
    amber: 'bg-warning/12 text-warning border-warning/25',
    coral: 'bg-negative/12 text-negative border-negative/25',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', map[tone], className)}>
      {children}
    </span>
  )
}

export function RiskBadge({ category }: { category: 'High' | 'Medium' | 'Low' }) {
  return <Badge tone={category === 'High' ? 'coral' : category === 'Medium' ? 'amber' : 'teal'}>{category} risk</Badge>
}

export function Note({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'amber' }) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3.5 py-3 text-xs leading-relaxed',
        tone === 'blue' ? 'border-primary/20 bg-primary/6 text-foreground/85' : 'border-warning/25 bg-warning/6 text-foreground/85',
      )}
    >
      <Info className={cn('mt-0.5 size-3.5 shrink-0', tone === 'blue' ? 'text-primary' : 'text-warning')} />
      <div className="text-pretty">{children}</div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted/60', className)} />
}

export function StatRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-xs text-muted-foreground/70">{hint}</span>}
      </span>
      <span className="font-medium tabular">{value}</span>
    </div>
  )
}

export function MiniBar({ value, color = COLORS.blue, max = 1 }: { value: number; color?: string; max?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
    </div>
  )
}
