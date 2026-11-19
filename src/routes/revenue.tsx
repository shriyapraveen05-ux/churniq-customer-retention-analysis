import { createFileRoute } from '@tanstack/react-router'
import { RevenuePage } from '@/components/pages/revenue'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/revenue')({
  head: () => pageHead('Revenue Impact', 'Active monthly revenue, revenue lost to churn and estimated revenue at risk, with every formula defined.'),
  component: RevenuePage,
})
