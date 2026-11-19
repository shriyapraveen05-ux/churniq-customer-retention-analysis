import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/analysis')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'analysis'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'analysis'),
    },
  },
})
