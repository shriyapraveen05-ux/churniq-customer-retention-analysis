import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '@/components/pages/overview'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/')({
  head: () => pageHead('Overview', 'Customer churn and retention KPIs, drivers and revenue impact calculated from the IBM Telco Customer Churn dataset.'),
  component: OverviewPage,
})
