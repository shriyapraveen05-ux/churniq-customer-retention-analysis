import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/dataset-info')({
  server: {
    handlers: {
      GET: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'dataset-info'),
      POST: async ({ request }) => (await import('@/lib/analytics/http.server')).handleSection(request, 'dataset-info'),
    },
  },
})
