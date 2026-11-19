import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/model-performance')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'model-performance'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'model-performance'),
    },
  },
})
