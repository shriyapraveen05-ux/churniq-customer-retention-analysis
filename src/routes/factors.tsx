import { createFileRoute } from '@tanstack/react-router'
import { FactorsPage } from '@/components/pages/factors'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/factors')({
  head: () => pageHead('Retention Factors', 'Correlation, chi-square and t-test results showing which attributes are associated with churn.'),
  component: FactorsPage,
})
