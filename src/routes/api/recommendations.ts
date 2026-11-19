import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/recommendations')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'recommendations'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'recommendations'),
    },
  },
})
