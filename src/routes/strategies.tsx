import { createFileRoute } from '@tanstack/react-router'
import { StrategiesPage } from '@/components/pages/strategies'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/strategies')({
  head: () => pageHead('Retention Strategies', 'Data-driven retention recommendations with findings, supporting data, segments, implications and priority.'),
  component: StrategiesPage,
})
