import { createFileRoute } from '@tanstack/react-router'
import { ChurnAnalysisPage } from '@/components/pages/churn-analysis'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/churn')({
  head: () => pageHead('Churn Analysis', 'Overall churn distribution and churn rates across contract, tenure, payment, internet and service categories.'),
  component: ChurnAnalysisPage,
})
