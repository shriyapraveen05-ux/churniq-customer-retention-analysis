import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/components/pages/settings'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/settings')({
  head: () => pageHead('Settings & API', 'Active dataset, validation checks and the analytics API endpoints that power the dashboard.'),
  component: SettingsPage,
})
