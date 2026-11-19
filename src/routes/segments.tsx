import { createFileRoute } from '@tanstack/react-router'
import { SegmentsPage } from '@/components/pages/segments'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/segments')({
  head: () => pageHead('Customer Segments', 'Rule-based customer segments with size, churn rate, retention rate, tenure and monthly charges.'),
  component: SegmentsPage,
})
