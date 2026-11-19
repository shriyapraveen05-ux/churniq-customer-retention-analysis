import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/retention-factors')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'retention-factors'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'retention-factors'),
    },
  },
})
