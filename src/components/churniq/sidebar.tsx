
import { Link } from '@tanstack/react-router'
import { useLocation } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CircleDollarSign,
  Database,
  Grid3x3,
  LayoutDashboard,
  Lightbulb,
  Settings,
  ShieldAlert,
  TrendingDown,
  Users,
  Waypoints,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysis, useAnalyticsContext } from '@/components/providers/analytics-provider'

export const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/data', label: 'Data Overview', icon: Database },
  { href: '/churn', label: 'Churn Analysis', icon: TrendingDown },
  { href: '/behaviour', label: 'Customer Behaviour', icon: Activity },
  { href: '/segments', label: 'Customer Segments', icon: Users },
  { href: '/factors', label: 'Retention Factors', icon: Waypoints },
  { href: '/risk', label: 'Risk Assessment', icon: ShieldAlert },
  { href: '/cohorts', label: 'Cohort Analysis', icon: Grid3x3 },
  { href: '/revenue', label: 'Revenue Impact', icon: CircleDollarSign },
  { href: '/strategies', label: 'Retention Strategies', icon: Lightbulb },
  { href: '/model', label: 'Churn Model', icon: BrainCircuit },
] as const

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2" aria-label="CHURNIQ home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet shadow-lg shadow-primary/25">
        <BarChart3 className="size-4 text-primary-foreground" />
      </span>
      <span className="text-[15px] font-semibold tracking-[0.12em]">
        CHURN<span className="text-primary">IQ</span>
      </span>
    </Link>
  )
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const items = [...NAV, { href: '/settings', label: 'Settings & API', icon: Settings } as const]
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <div key={item.href}>
            {i === NAV.length && <div className="my-3 h-px bg-sidebar-border" />}
            <Link
              to={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
              <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              {item.label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}

function DatasetChip() {
  const { upload } = useAnalyticsContext()
  const { data } = useAnalysis()
  return (
    <div className="rounded-lg border border-sidebar-border bg-background/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active dataset</p>
      <p className="mt-0.5 truncate text-xs font-medium" title={upload?.name ?? 'IBM Telco Customer Churn'}>
        {upload?.name ?? 'IBM Telco Customer Churn'}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{upload ? 'Uploaded CSV · session only' : `Bundled · ${data ? data.portfolioSize.toLocaleString() : '…'} records`}</p>
    </div>
  )
}

export function Profile() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet/80 to-primary/80 text-xs font-semibold text-primary-foreground">
        BA
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">Business Analyst</p>
        <p className="truncate text-[11px] text-muted-foreground">Customer Success · Workspace</p>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-4">
        <Logo />
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Analytics</p>
        <NavList />
      </div>
      <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
        <DatasetChip />
        <Profile />
      </div>
    </aside>
  )
}
