import { createFileRoute } from '@tanstack/react-router'
import { CohortsPage } from '@/components/pages/cohorts'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/cohorts')({
  head: () => pageHead('Cohort Analysis', 'Tenure-based survival analysis with Kaplan–Meier curves and clearly stated data limitations.'),
  component: CohortsPage,
})
