import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/customer-risk')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customer-risk'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customer-risk'),
    },
  },
})
