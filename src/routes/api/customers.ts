import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/customers')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customers'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'customers'),
    },
  },
})
