import { createFileRoute } from '@tanstack/react-router'
import { BehaviourPage } from '@/components/pages/behaviour'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/behaviour')({
  head: () => pageHead('Customer Behaviour', 'Churned versus retained customers compared on tenure, charges, contracts, payment methods and services.'),
  component: BehaviourPage,
})
