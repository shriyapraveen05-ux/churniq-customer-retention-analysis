import { createFileRoute } from '@tanstack/react-router'
import { DataOverviewPage } from '@/components/pages/data-overview'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/data')({
  head: () => pageHead('Data Overview', 'Dataset loading, validation, cleaning steps, missing values, duplicates and descriptive statistics, with CSV upload.'),
  component: DataOverviewPage,
})
