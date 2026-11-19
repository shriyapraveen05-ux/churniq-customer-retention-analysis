import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/segments')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'segments'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'segments'),
    },
  },
})
