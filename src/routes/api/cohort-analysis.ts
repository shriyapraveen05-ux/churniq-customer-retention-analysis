import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/cohort-analysis')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'cohort-analysis'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'cohort-analysis'),
    },
  },
})
