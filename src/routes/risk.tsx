import { createFileRoute } from '@tanstack/react-router'
import { RiskPage } from '@/components/pages/risk'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/risk')({
  head: () => pageHead('Risk Assessment', 'Customer-level churn risk scores, risk categories, risk factors and recommended retention actions.'),
  component: RiskPage,
})
