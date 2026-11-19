import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, data: { status: 'up' }, meta: {} }),
    },
  },
})
