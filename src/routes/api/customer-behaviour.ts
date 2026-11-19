import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/customer-behaviour')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customer-behaviour'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customer-behaviour'),
    },
  },
})
