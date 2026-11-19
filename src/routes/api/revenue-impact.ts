import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/revenue-impact')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'revenue-impact'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'revenue-impact'),
    },
  },
})
