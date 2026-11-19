import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/overview')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'overview'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'overview'),
    },
  },
})
