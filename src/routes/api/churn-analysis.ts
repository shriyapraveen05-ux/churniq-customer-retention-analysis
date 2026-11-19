import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/churn-analysis')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'churn-analysis'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'churn-analysis'),
    },
  },
})
